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
resolve_topic_anchors = index_study_pdf.resolve_topic_anchors
term_pattern = index_study_pdf.term_pattern


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
        pages = [
            {
                "page": 1,
                "text": "LEGTURE 1\npeak finding",
                "hits": match_topics("LEGTURE 1\npeak finding", self.topics),
            },
            {
                "page": 6,
                "text": "linked list notes",
                "hits": match_topics("linked list notes", self.topics),
            },
            {
                "page": 10,
                "text": "LECTURE 2",
                "hits": match_topics("LECTURE 2", self.topics),
            },
        ]
        headers = find_lecture_headers(pages)
        self.assertEqual(headers[1], 1)
        self.assertEqual(headers[2], 10)
        first, _, source = resolve_topic_anchors(pages, self.topics)
        self.assertEqual(first["L1"], 1)
        self.assertEqual(source["L1"], "lecture-header")
        self.assertEqual(first["L2"], 10)
        self.assertEqual(source["L2"], "lecture-header")

    def test_term_fallback_and_diskstra(self):
        pages = [
            {
                "page": 89,
                "text": "DISKSTRA shortest paths",
                "hits": match_topics("DISKSTRA shortest paths", self.topics),
            }
        ]
        first, _, source = resolve_topic_anchors(pages, self.topics)
        self.assertEqual(first["L13"], 89)
        self.assertEqual(source["L13"], "term-fallback")


if __name__ == "__main__":
    unittest.main()
