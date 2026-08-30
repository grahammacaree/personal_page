#!/usr/bin/env python3
"""Unit tests for syllabus matching (no Vision / no PDF I/O)."""
from __future__ import annotations

import importlib.util
import re
import unittest
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "index_study_pdf",
    Path(__file__).resolve().parent / "index-study-pdf.py",
)
assert _SPEC is not None and _SPEC.loader is not None
index_study_pdf = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(index_study_pdf)

expand_topics = index_study_pdf.expand_topics
find_lecture_headers = index_study_pdf.find_lecture_headers
match_topics = index_study_pdf.match_topics
monotonic_headers = index_study_pdf.monotonic_headers
resolve_topic_anchors = index_study_pdf.resolve_topic_anchors
term_pattern = index_study_pdf.term_pattern


def records(pages: list[tuple[int, str]], topics: list[dict]) -> list[dict]:
    return [
        {"page": n, "text": text, "hits": match_topics(text, topics)}
        for n, text in pages
    ]


class TermPatternTests(unittest.TestCase):
    def test_plain_word_gets_boundaries(self):
        self.assertEqual(term_pattern("sorting"), r"\bsorting\b")

    def test_plain_phrase_is_substring(self):
        self.assertEqual(term_pattern("peak finding"), re.escape("peak finding"))

    def test_raw_regex(self):
        self.assertEqual(term_pattern("re:dij?k?s?tra"), r"dij?k?s?tra")


class ExpandTopicsTests(unittest.TestCase):
    def test_adds_lecture_header_term(self):
        topics = expand_topics(
            [{"id": "L13", "title": "Dijkstra", "lecture": 13, "terms": ["diskstra"]}]
        )
        self.assertEqual(topics[0]["lecture"], 13)
        self.assertTrue(any("13" in t for t in topics[0]["terms"]))
        self.assertIn(r"\bdiskstra\b", topics[0]["terms"])

    def test_id_infers_lecture(self):
        topics = expand_topics([{"id": "L2", "title": "DS", "terms": []}])
        self.assertEqual(topics[0]["lecture"], 2)


class MatchAndResolveTests(unittest.TestCase):
    def setUp(self):
        self.topics = expand_topics(
            [
                {
                    "id": "L1",
                    "title": "Introduction",
                    "lecture": 1,
                    "terms": ["peak finding"],
                },
                {
                    "id": "L2",
                    "title": "Data Structures",
                    "lecture": 2,
                    "terms": ["linked list"],
                },
                {
                    "id": "L13",
                    "title": "Dijkstra",
                    "lecture": 13,
                    "terms": ["re:dij?k?s?tra", "diskstra"],
                },
            ]
        )

    def test_lecture_header_preferred(self):
        pages = records(
            [
                (1, "LEGTURE 1\npeak finding"),
                (6, "linked list notes"),
                (10, "LECTURE 2"),
            ],
            self.topics,
        )
        headers = find_lecture_headers(pages)
        self.assertEqual(headers[1], 1)
        self.assertEqual(headers[2], 10)
        first, _, source = resolve_topic_anchors(pages, self.topics)
        self.assertEqual(first["L1"], 1)
        self.assertEqual(source["L1"], "lecture-header")
        self.assertEqual(first["L2"], 10)
        self.assertEqual(source["L2"], "lecture-header")

    def test_term_fallback_and_diskstra(self):
        pages = records([(89, "DISKSTRA shortest paths")], self.topics)
        first, _, source = resolve_topic_anchors(pages, self.topics)
        self.assertEqual(first["L13"], 89)
        self.assertEqual(source["L13"], "term-fallback")

    def test_out_of_order_term_hit_is_rejected(self):
        """A late lecture's term appearing on page 1 must not anchor there."""
        pages = records(
            [
                (1, "LECTURE 1 peak finding, dijkstra mentioned in passing"),
                (5, "LECTURE 2 linked list"),
            ],
            self.topics,
        )
        first, _, _ = resolve_topic_anchors(pages, self.topics)
        self.assertEqual(first["L1"], 1)
        self.assertEqual(first["L2"], 5)
        self.assertNotIn("L13", first)

    def test_in_range_term_hit_is_accepted(self):
        pages = records(
            [
                (1, "LECTURE 1 peak finding"),
                (4, "dijkstra shortest paths"),
                (9, "LECTURE 14 johnson"),
            ],
            self.topics,
        )
        first, _, source = resolve_topic_anchors(pages, self.topics)
        self.assertEqual(first["L13"], 4)
        self.assertEqual(source["L13"], "term-fallback")


class MonotonicHeaderTests(unittest.TestCase):
    def test_drops_backwards_outlier(self):
        headers = {16: 81, 17: 82, 18: 85, 19: 92, 20: 94, 30: 82}
        self.assertEqual(
            monotonic_headers(headers), {16: 81, 17: 82, 18: 85, 19: 92, 20: 94}
        )

    def test_keeps_already_increasing(self):
        headers = {1: 1, 3: 17, 6: 27}
        self.assertEqual(monotonic_headers(headers), headers)

    def test_empty(self):
        self.assertEqual(monotonic_headers({}), {})


if __name__ == "__main__":
    unittest.main()
