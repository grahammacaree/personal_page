#!/usr/bin/env python3
"""
Syllabus-driven searchable study PDFs (macOS + Apple Vision).

For each course in studies.config.json with a non-empty `syllabus`:
  - OCR page images via scripts/lib/vision-ocr.swift
  - Rebuild PDF with invisible text layer (Cmd-F) + outline bookmarks
  - Prefer LECTURE N headers as outline anchors; fall back to term hits

Usage (from repo root, RemarkableSync venv python with pymupdf):
  path/to/venv/bin/python scripts/lib/index-study-pdf.py
  path/to/venv/bin/python scripts/lib/index-study-pdf.py --pdf introduction-to-algorithms.pdf
  path/to/venv/bin/python scripts/lib/index-study-pdf.py --force
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "studies.config.json"
VISION = Path(__file__).resolve().parent / "vision-ocr.swift"
DEFAULT_CACHE = (
    Path.home()
    / "Library"
    / "Application Support"
    / "remarkablesync"
    / "index-cache"
)

# Vision often mangles LECTURE → LEGTURE / LECTUR / LECT
LECTURE_HEADER = re.compile(r"l(?:ec|eg|e)t(?:ure|ur|u)?\s*(\d+)\b", re.IGNORECASE)


def _fitz():
    try:
        import fitz
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "pymupdf (fitz) required — use remarkable.rmrlPython from studies.config.json"
        ) from exc
    return fitz


def normalize(s: str) -> str:
    s = s.lower().replace("’", "'").replace("‘", "'")
    s = re.sub(r"\s+", " ", s)
    return s


def term_pattern(term: str) -> str:
    """Plain phrases become escaped literals; `re:…` is a raw regex.

    Single-token plain terms get word boundaries so ``sorting`` does not
    fire inside longer OCR junk as often; multi-word phrases stay substrings.
    """
    raw = term.strip()
    if raw.startswith("re:"):
        return raw[3:]
    esc = re.escape(raw)
    if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9'/-]*", raw):
        return rf"\b{esc}\b"
    return esc


def expand_topics(syllabus: list[dict[str, Any]]) -> list[dict[str, Any]]:
    topics: list[dict[str, Any]] = []
    for row in syllabus:
        tid = str(row["id"])
        title = str(row["title"])
        terms = [term_pattern(t) for t in (row.get("terms") or []) if str(t).strip()]
        lecture = row.get("lecture")
        if lecture is None:
            m = re.fullmatch(r"L(\d+)", tid, flags=re.IGNORECASE)
            if m:
                lecture = int(m.group(1))
        if lecture is not None:
            terms = [rf"lecture\s*{int(lecture)}\b", *terms]
        topics.append(
            {
                "id": tid,
                "title": title,
                "lecture": int(lecture) if lecture is not None else None,
                "terms": terms,
            }
        )
    return topics


def match_topics(page_text: str, topics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    hay = normalize(page_text)
    hits = []
    for topic in topics:
        found = [
            term
            for term in topic["terms"]
            if re.search(term, hay, flags=re.IGNORECASE)
        ]
        if found:
            hits.append({"id": topic["id"], "title": topic["title"], "matched": found})
    return hits


def find_lecture_headers(page_records: list[dict[str, Any]]) -> dict[int, int]:
    headers: dict[int, int] = {}
    for rec in page_records:
        for match in LECTURE_HEADER.finditer(rec["text"]):
            n = int(match.group(1))
            headers.setdefault(n, rec["page"])
    return headers


def monotonic_headers(headers: dict[int, int]) -> dict[int, int]:
    """Keep the longest run of headers whose pages rise with lecture number.

    Notebooks are chronological, so a header that goes backwards is almost
    always an OCR misread (a stray "L30" on the MGF page, say). Dropping the
    outliers is safer than letting one bad anchor reorder the outline.
    """
    if not headers:
        return {}
    lectures = sorted(headers)
    pages = [headers[n] for n in lectures]

    # O(n^2) longest strictly increasing subsequence — syllabi are tiny.
    best = [1] * len(pages)
    prev = [-1] * len(pages)
    for i in range(len(pages)):
        for j in range(i):
            if pages[j] < pages[i] and best[j] + 1 > best[i]:
                best[i] = best[j] + 1
                prev[i] = j
    end = max(range(len(pages)), key=lambda i: best[i])
    keep: list[int] = []
    while end != -1:
        keep.append(end)
        end = prev[end]
    return {lectures[i]: pages[i] for i in reversed(keep)}


def resolve_topic_anchors(
    page_records: list[dict[str, Any]], topics: list[dict[str, Any]]
) -> tuple[dict[str, int], dict[str, list[int]], dict[str, str]]:
    """Anchor each topic on its LECTURE N header, else an in-order term hit.

    Term hits are only trusted when they land between the anchors of the
    surrounding lectures. A topic with no confident anchor is left out of the
    outline entirely — a missing bookmark beats one pointing at the wrong page.
    """
    headers = monotonic_headers(find_lecture_headers(page_records))
    topic_pages: dict[str, list[int]] = {t["id"]: [] for t in topics}
    topic_first_page: dict[str, int] = {}
    topic_source: dict[str, str] = {}

    for rec in page_records:
        for hit in rec["hits"]:
            topic_pages[hit["id"]].append(rec["page"])

    for topic in topics:
        n = topic.get("lecture")
        if n is not None and n in headers:
            topic_first_page[topic["id"]] = headers[n]
            topic_source[topic["id"]] = "lecture-header"

    last_page = max((rec["page"] for rec in page_records), default=1)
    # Lecture order drives the bounds; unnumbered topics keep config order.
    ordered = sorted(
        topics,
        key=lambda t: (t.get("lecture") is None, t.get("lecture") or 0),
    )
    for i, topic in enumerate(ordered):
        tid = topic["id"]
        if tid in topic_first_page:
            continue
        pages = topic_pages[tid]
        if not pages:
            continue
        lower = max(
            (
                topic_first_page[o["id"]]
                for o in ordered[:i]
                if o["id"] in topic_first_page
            ),
            default=1,
        )
        upper = min(
            (
                topic_first_page[o["id"]]
                for o in ordered[i + 1 :]
                if o["id"] in topic_first_page
            ),
            default=last_page,
        )
        candidate = next((p for p in pages if lower <= p <= upper), None)
        if candidate is not None:
            topic_first_page[tid] = candidate
            topic_source[tid] = "term-fallback"

    return topic_first_page, topic_pages, topic_source


def syllabus_hash(syllabus: list[dict[str, Any]]) -> str:
    blob = json.dumps(syllabus, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def page_image_fingerprint(doc) -> str:
    fitz = _fitz()
    h = hashlib.sha256()
    for page in doc:
        images = page.get_images(full=True)
        if images:
            xref = images[0][0]
            h.update(doc.xref_stream(xref) or b"")
        else:
            pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
            h.update(pix.tobytes("png"))
        h.update(b"\0")
    return h.hexdigest()


def extract_page_png(doc, page_index: int, out: Path) -> None:
    fitz = _fitz()
    page = doc[page_index]
    images = page.get_images(full=True)
    if images:
        xref = images[0][0]
        pix = fitz.Pixmap(doc, xref)
        if pix.n - pix.alpha > 3:
            pix = fitz.Pixmap(fitz.csRGB, pix)
        pix.save(out.as_posix())
    else:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        pix.save(out.as_posix())


def ocr_page(image: Path) -> str:
    proc = subprocess.run(
        ["swift", str(VISION), str(image)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        err = (proc.stderr or "").strip() or f"exit {proc.returncode}"
        raise RuntimeError(f"OCR failed for {image.name}: {err}")
    return proc.stdout.strip()


def insert_page_image(out_page, src, page_index: int) -> None:
    fitz = _fitz()
    page = src[page_index]
    images = page.get_images(full=True)
    if images:
        xref = images[0][0]
        pix = fitz.Pixmap(src, xref)
        if pix.n - pix.alpha > 3:
            pix = fitz.Pixmap(fitz.csRGB, pix)
        out_page.insert_image(out_page.rect, pixmap=pix)
    else:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        out_page.insert_image(out_page.rect, pixmap=pix)


def build_searchable_pdf(
    src_path: Path,
    page_texts: list[str],
    topic_first_page: dict[str, int],
    topics: list[dict[str, Any]],
    dest_path: Path,
) -> None:
    """Rebuild from page images so re-indexing never doubles the text layer."""
    fitz = _fitz()
    src = fitz.open(src_path)
    out = fitz.open()
    try:
        for i, text in enumerate(page_texts):
            page = src[i]
            new = out.new_page(width=page.rect.width, height=page.rect.height)
            insert_page_image(new, src, i)
            if text.strip():
                new.insert_textbox(
                    new.rect,
                    text,
                    fontsize=8,
                    fontname="helv",
                    color=(0, 0, 0),
                    render_mode=3,
                    align=fitz.TEXT_ALIGN_LEFT,
                    overlay=True,
                )

        toc = []
        ordered = sorted(
            (
                (topic_first_page[t["id"]], t)
                for t in topics
                if t["id"] in topic_first_page
            ),
            key=lambda pair: (pair[0], pair[1].get("lecture") or 0),
        )
        for page_1based, topic in ordered:
            toc.append([1, f"{topic['id']}: {topic['title']}", page_1based])
        if toc:
            out.set_toc(toc)

        fd, tmp_name = tempfile.mkstemp(
            suffix=".pdf", prefix=".index-", dir=str(dest_path.parent)
        )
        os.close(fd)
        tmp_path = Path(tmp_name)
        try:
            out.save(tmp_path.as_posix(), garbage=4, deflate=True)
            os.replace(tmp_path, dest_path)
        finally:
            if tmp_path.exists():
                tmp_path.unlink(missing_ok=True)
    finally:
        out.close()
        src.close()


def read_index_stamp(path: Path) -> tuple[str, str, str] | None:
    if not path.is_file():
        return None
    lines = path.read_text(encoding="utf-8").splitlines()
    if len(lines) < 3:
        return None
    return lines[0].strip(), lines[1].strip(), lines[2].strip()


def write_index_stamp(
    path: Path, image_fp: str, syl_hash: str, pdf_sha: str
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{image_fp}\n{syl_hash}\n{pdf_sha}\n", encoding="utf-8")


def index_course(
    course: dict[str, Any],
    *,
    studies_dir: Path,
    cache_root: Path,
    stamp_dir: Path,
    force: bool,
) -> dict[str, Any] | None:
    syllabus = course.get("syllabus") or []
    if not syllabus:
        return None

    pdf_name = course["pdf"]
    pdf_path = studies_dir / pdf_name
    if not pdf_path.is_file():
        return {
            "pdf": pdf_name,
            "status": "missing",
            "message": f"missing {pdf_path}",
        }

    topics = expand_topics(syllabus)
    syl_hash = syllabus_hash(syllabus)
    stamp_path = stamp_dir / f"{pdf_name}.index.stamp"

    fitz = _fitz()
    doc = fitz.open(pdf_path)
    try:
        image_fp = page_image_fingerprint(doc)
        page_count = doc.page_count
    finally:
        doc.close()

    pdf_sha = sha256_file(pdf_path)
    stamp = None if force else read_index_stamp(stamp_path)
    if stamp and stamp == (image_fp, syl_hash, pdf_sha):
        return {
            "pdf": pdf_name,
            "status": "unchanged",
            "pages": page_count,
            "topics_total": len(topics),
        }

    cache_dir = cache_root / Path(pdf_name).stem
    pages_dir = cache_dir / "pages"
    ocr_json = cache_dir / "ocr-pages.json"
    cache_dir.mkdir(parents=True, exist_ok=True)
    pages_dir.mkdir(parents=True, exist_ok=True)

    print(f"index {pdf_name} ({page_count} pages)…", flush=True)
    doc = fitz.open(pdf_path)
    try:
        page_paths: list[Path] = []
        for i in range(doc.page_count):
            out = pages_dir / f"page-{i + 1:03d}.png"
            # Re-extract when image fingerprint changed (force or notebook update).
            if force or not out.exists() or not stamp or stamp[0] != image_fp:
                extract_page_png(doc, i, out)
            page_paths.append(out)
            if (i + 1) % 20 == 0:
                print(f"  extracted {i + 1}/{doc.page_count}", flush=True)
    finally:
        doc.close()

    page_records: list[dict[str, Any]] = []
    reuse_ocr = False
    if ocr_json.exists() and not force:
        cached = json.loads(ocr_json.read_text(encoding="utf-8"))
        meta = cached.get("_meta") or {}
        records = cached.get("pages") or cached
        if (
            isinstance(records, list)
            and meta.get("image_fp") == image_fp
            and len(records) == len(page_paths)
        ):
            print(f"  reusing OCR cache ({ocr_json})", flush=True)
            page_records = records
            reuse_ocr = True

    if not reuse_ocr:
        if platform.system() != "Darwin":
            raise RuntimeError("Apple Vision OCR requires macOS")
        if not VISION.is_file():
            raise RuntimeError(f"missing {VISION}")
        print("  OCR via Apple Vision…", flush=True)
        page_records = []
        for i, path in enumerate(page_paths):
            text = ocr_page(path)
            page_records.append(
                {
                    "page": i + 1,
                    "chars": len(text),
                    "text": text,
                    "hits": [],
                }
            )
            print(
                f"  page {i + 1}/{len(page_paths)} — {len(text)} chars",
                flush=True,
            )
        ocr_json.write_text(
            json.dumps(
                {"_meta": {"image_fp": image_fp, "pdf": pdf_name}, "pages": page_records},
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    for rec in page_records:
        rec["hits"] = match_topics(rec["text"], topics)
        rec["chars"] = len(rec["text"])

    topic_first_page, topic_pages, topic_source = resolve_topic_anchors(
        page_records, topics
    )
    headers = find_lecture_headers(page_records)
    print(
        f"  lecture headers: {len(headers)} — "
        + ", ".join(f"L{n}@p{p}" for n, p in sorted(headers.items())),
        flush=True,
    )

    build_searchable_pdf(
        pdf_path,
        [r["text"] for r in page_records],
        topic_first_page,
        topics,
        pdf_path,
    )
    new_sha = sha256_file(pdf_path)
    write_index_stamp(stamp_path, image_fp, syl_hash, new_sha)

    matched = [t for t in topics if t["id"] in topic_first_page]
    missed = [t for t in topics if t["id"] not in topic_first_page]
    report = {
        "pdf": pdf_name,
        "status": "updated",
        "pages": len(page_records),
        "topics_total": len(topics),
        "topics_matched": len(matched),
        "lecture_headers": {f"L{n}": p for n, p in sorted(headers.items())},
        "matched": [
            {
                "id": t["id"],
                "title": t["title"],
                "first_page": topic_first_page[t["id"]],
                "anchor": topic_source[t["id"]],
                "pages": topic_pages[t["id"]],
            }
            for t in matched
        ],
        "missed": [{"id": t["id"], "title": t["title"]} for t in missed],
        "ocr_chars_total": sum(r["chars"] for r in page_records),
        "sha256": new_sha,
    }
    (cache_dir / "report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"  matched {len(matched)}/{len(topics)} topics → {pdf_path}",
        flush=True,
    )
    return report


def load_config(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG,
        help="studies.config.json path",
    )
    parser.add_argument(
        "--pdf",
        action="append",
        default=[],
        help="Only index this course.pdf (repeatable)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-OCR and rebuild even when stamps match",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=None,
        help="OCR cache root (default: Application Support/…/index-cache)",
    )
    parser.add_argument(
        "--stamp-dir",
        type=Path,
        default=None,
        help="Index stamp directory",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Write JSON summary to this path",
    )
    args = parser.parse_args(argv)

    cfg = load_config(args.config)
    rm = cfg.get("remarkable") or {}
    cache_root = args.cache_dir or Path(
        os.path.expanduser(rm.get("indexCacheDir") or str(DEFAULT_CACHE))
    )
    stamp_dir = args.stamp_dir or Path(
        os.path.expanduser(
            rm.get("indexStampDir")
            or str(
                Path.home()
                / "Library"
                / "Application Support"
                / "remarkablesync"
                / "index-stamps"
            )
        )
    )
    studies_dir = ROOT / "studies"
    want = set(args.pdf) if args.pdf else None

    results: list[dict[str, Any]] = []
    for course in cfg.get("courses") or []:
        if not course.get("syllabus"):
            continue
        if want is not None and course.get("pdf") not in want:
            continue
        try:
            row = index_course(
                course,
                studies_dir=studies_dir,
                cache_root=cache_root,
                stamp_dir=stamp_dir,
                force=args.force,
            )
        except Exception as exc:  # noqa: BLE001 — surface per-course failure
            print(f"index failed for {course.get('pdf')}: {exc}", file=sys.stderr)
            return 1
        if row:
            results.append(row)
            if row.get("status") == "missing":
                print(f"  skip {row['pdf']}: {row.get('message')}", flush=True)

    if want and not results:
        print("no matching courses with syllabus", file=sys.stderr)
        return 1

    summary = {
        "results": results,
        "updated": [r["pdf"] for r in results if r.get("status") == "updated"],
        "unchanged": [r["pdf"] for r in results if r.get("status") == "unchanged"],
    }
    if args.report:
        args.report.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    if not results:
        print("no courses with syllabus to index")
    else:
        print(
            f"index done — updated {len(summary['updated'])}, "
            f"unchanged {len(summary['unchanged'])}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
