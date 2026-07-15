#!/usr/bin/env python3
"""Convert a reMarkable notebook to PDF, then compress for the web.

Supports mixed notebooks:
  - formatVersion 2 ``cPages`` (shimmed for rmrl)
  - .rm stroke files version 3/5 (via rmrl) and version 6 (via rmc → SVG → PDF)

rmrl alone dies on the first v6 page; we fall back to per-page conversion when
any v6 page is present.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

# reMarkable portrait is ~226 dpi; 200/88 keeps handwriting sharp without huge files.
DEFAULT_DPI = 200
DEFAULT_JPEG_QUALITY = 88
RM_HEADER_RE = re.compile(rb"version=(\d+)")


def legacy_page_ids(content: dict) -> list[str]:
    pages = content.get("pages") or []
    if pages:
        return [str(p) for p in pages]

    cpages = (content.get("cPages") or {}).get("pages") or []
    ids: list[str] = []
    for page in cpages:
        if isinstance(page, str):
            ids.append(page)
        elif isinstance(page, dict) and page.get("id"):
            ids.append(str(page["id"]))
    return ids


def rm_version(rm_path: Path) -> int:
    head = rm_path.read_bytes()[:96]
    match = RM_HEADER_RE.search(head)
    return int(match.group(1)) if match else -1


def prepare_notebook(meta_path: Path, work: Path) -> Path:
    """Copy/symlink notebook into work; return path to metadata to render."""
    uuid = meta_path.stem
    src_dir = meta_path.parent

    content_src = src_dir / f"{uuid}.content"
    content = json.loads(content_src.read_text(encoding="utf-8"))
    page_ids = legacy_page_ids(content)
    if not page_ids:
        raise SystemExit(f"No pages found in {content_src}")

    needs_shim = not (content.get("pages") or [])
    if needs_shim:
        content = dict(content)
        content["pages"] = page_ids
        content["formatVersion"] = 1

    for suffix in (".metadata", ".content", ".pagedata"):
        src = src_dir / f"{uuid}{suffix}"
        dst = work / f"{uuid}{suffix}"
        if not src.is_file():
            continue
        if suffix == ".content" and needs_shim:
            dst.write_text(json.dumps(content, indent=4) + "\n", encoding="utf-8")
        else:
            dst.symlink_to(src.resolve())

    pages_dir = src_dir / uuid
    if pages_dir.is_dir():
        (work / uuid).symlink_to(pages_dir.resolve())

    return work / f"{uuid}.metadata"


def notebook_page_paths(meta_path: Path) -> list[Path]:
    uuid = meta_path.stem
    src_dir = meta_path.parent
    content = json.loads((src_dir / f"{uuid}.content").read_text(encoding="utf-8"))
    pages_dir = src_dir / uuid
    paths: list[Path] = []
    for page_id in legacy_page_ids(content):
        rm = pages_dir / f"{page_id}.rm"
        if rm.is_file():
            paths.append(rm)
    return paths


def compress_pdf(
    src: Path,
    dest: Path,
    *,
    dpi: int = DEFAULT_DPI,
    jpeg_quality: int = DEFAULT_JPEG_QUALITY,
) -> None:
    """Rewrite PDF as grayscale JPEG pages (much smaller for handwriting)."""
    import fitz

    src_doc = fitz.open(src)
    out_doc = fitz.open()
    try:
        for page in src_doc:
            pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
            img = pix.tobytes("jpeg", jpg_quality=jpeg_quality)
            rect = page.rect
            new_page = out_doc.new_page(width=rect.width, height=rect.height)
            new_page.insert_image(rect, stream=img)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out_doc.save(dest, garbage=4, deflate=True, clean=True)
    finally:
        out_doc.close()
        src_doc.close()


def render_with_rmrl(meta_path: Path, vector_pdf: Path) -> None:
    from rmrl import render

    with tempfile.TemporaryDirectory(prefix="rmrl-shim-") as tmp:
        work_meta = prepare_notebook(meta_path, Path(tmp))
        stream = render(str(work_meta))
        with open(vector_pdf, "wb") as fh:
            shutil.copyfileobj(stream, fh)


def render_v6_page_pdf(rm_path: Path, out_pdf: Path) -> None:
    from rmc import rm_to_svg
    from reportlab.graphics import renderPDF
    from svglib.svglib import svg2rlg

    with tempfile.TemporaryDirectory(prefix="rmc-v6-") as tmp:
        svg_path = Path(tmp) / "page.svg"
        rm_to_svg(str(rm_path), str(svg_path))
        drawing = svg2rlg(str(svg_path))
        if drawing is None:
            raise RuntimeError(f"svglib failed to parse SVG for {rm_path.name}")
        renderPDF.drawToFile(drawing, str(out_pdf))


def render_filtered_rmrl(meta_path: Path, keep_ids: list[str], vector_pdf: Path) -> None:
    """rmrl-render a notebook containing only the given page ids (in order)."""
    from rmrl import render

    uuid = meta_path.stem
    src_dir = meta_path.parent
    pages_dir = src_dir / uuid

    with tempfile.TemporaryDirectory(prefix="rmrl-filter-") as tmp:
        work = Path(tmp)
        content = {
            "fileType": "notebook",
            "formatVersion": 1,
            "pages": keep_ids,
            "pageCount": len(keep_ids),
        }
        (work / f"{uuid}.content").write_text(
            json.dumps(content, indent=2) + "\n", encoding="utf-8"
        )
        meta_src = src_dir / f"{uuid}.metadata"
        if meta_src.is_file():
            (work / f"{uuid}.metadata").symlink_to(meta_src.resolve())
        else:
            (work / f"{uuid}.metadata").write_text("{}\n", encoding="utf-8")
        page_data = src_dir / f"{uuid}.pagedata"
        if page_data.is_file():
            (work / f"{uuid}.pagedata").symlink_to(page_data.resolve())

        page_work = work / uuid
        page_work.mkdir()
        for page_id in keep_ids:
            rm_src = pages_dir / f"{page_id}.rm"
            (page_work / f"{page_id}.rm").symlink_to(rm_src.resolve())
            layer_meta = pages_dir / f"{page_id}-metadata.json"
            if layer_meta.is_file():
                (page_work / f"{page_id}-metadata.json").symlink_to(
                    layer_meta.resolve()
                )

        stream = render(str(work / f"{uuid}.metadata"))
        with open(vector_pdf, "wb") as fh:
            shutil.copyfileobj(stream, fh)


def render_hybrid(meta_path: Path, vector_pdf: Path) -> None:
    """Merge v3/v5 (rmrl bulk) with v6 (rmc) pages in original order."""
    import fitz

    page_rms = notebook_page_paths(meta_path)
    if not page_rms:
        raise SystemExit(f"No .rm pages for {meta_path}")

    versions = [rm_version(p) for p in page_rms]
    print(
        f"hybrid convert: {len(page_rms)} pages, "
        f"v6={sum(1 for v in versions if v >= 6)}, "
        f"legacy={sum(1 for v in versions if v in (3, 5))}",
        file=sys.stderr,
    )

    legacy_ids = [
        p.stem for p, v in zip(page_rms, versions) if v in (3, 5)
    ]
    if any(v not in (3, 5) and v < 6 for v in versions):
        unknown = sorted({v for v in versions if v not in (3, 5) and v < 6})
        raise SystemExit(f"Unsupported .rm version(s): {unknown}")

    with tempfile.TemporaryDirectory(prefix="rm-hybrid-") as tmp:
        tmp_path = Path(tmp)
        legacy_pdf = tmp_path / "legacy.pdf"
        legacy_doc = None
        legacy_i = 0
        if legacy_ids:
            render_filtered_rmrl(meta_path, legacy_ids, legacy_pdf)
            legacy_doc = fitz.open(legacy_pdf)

        out_doc = fitz.open()
        try:
            for i, (rm_path, ver) in enumerate(zip(page_rms, versions)):
                if ver >= 6:
                    page_pdf = tmp_path / f"v6-{i:04d}.pdf"
                    render_v6_page_pdf(rm_path, page_pdf)
                    page_doc = fitz.open(page_pdf)
                    try:
                        out_doc.insert_pdf(page_doc)
                    finally:
                        page_doc.close()
                else:
                    if legacy_doc is None or legacy_i >= legacy_doc.page_count:
                        raise SystemExit("legacy page index out of range")
                    out_doc.insert_pdf(
                        legacy_doc, from_page=legacy_i, to_page=legacy_i
                    )
                    legacy_i += 1
            out_doc.save(vector_pdf, garbage=4, deflate=True)
        finally:
            out_doc.close()
            if legacy_doc is not None:
                legacy_doc.close()


def main() -> int:
    if len(sys.argv) not in (3, 5):
        print(
            f"Usage: {sys.argv[0]} <notebook.metadata> <out.pdf> [dpi] [jpeg_quality]",
            file=sys.stderr,
        )
        return 2

    meta = Path(sys.argv[1]).expanduser().resolve()
    out = Path(sys.argv[2]).expanduser().resolve()
    dpi = int(sys.argv[3]) if len(sys.argv) >= 4 else DEFAULT_DPI
    jpeg_quality = int(sys.argv[4]) if len(sys.argv) >= 5 else DEFAULT_JPEG_QUALITY

    if not meta.is_file():
        print(f"Missing metadata: {meta}", file=sys.stderr)
        return 1

    page_rms = notebook_page_paths(meta)
    needs_hybrid = any(rm_version(p) >= 6 for p in page_rms)

    with tempfile.TemporaryDirectory(prefix="rmrl-out-") as tmp:
        tmp_path = Path(tmp)
        vector_pdf = tmp_path / "vector.pdf"
        if needs_hybrid:
            render_hybrid(meta, vector_pdf)
        else:
            render_with_rmrl(meta, vector_pdf)
        compress_pdf(vector_pdf, out, dpi=dpi, jpeg_quality=jpeg_quality)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
