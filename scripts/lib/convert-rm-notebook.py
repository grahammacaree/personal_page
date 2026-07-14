#!/usr/bin/env python3
"""Convert a reMarkable notebook to PDF via rmrl, then compress for the web.

Notebooks on post-2023 firmware often use formatVersion 2 (``cPages``).
rmrl only reads the legacy ``pages`` array. This wrapper builds a temporary
v1-shaped tree when needed, invokes rmrl, then rasterises pages to grayscale
JPEG (handwriting compresses poorly as vector paths).
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
from pathlib import Path

DEFAULT_DPI = 150
DEFAULT_JPEG_QUALITY = 75


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
        # rmrl only understands the v1 page list shape
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

    from rmrl import render

    with tempfile.TemporaryDirectory(prefix="rmrl-shim-") as tmp:
        tmp_path = Path(tmp)
        work_meta = prepare_notebook(meta, tmp_path)
        stream = render(str(work_meta))
        vector_pdf = tmp_path / "vector.pdf"
        with open(vector_pdf, "wb") as fh:
            shutil.copyfileobj(stream, fh)
        compress_pdf(vector_pdf, out, dpi=dpi, jpeg_quality=jpeg_quality)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
