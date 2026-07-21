#!/usr/bin/env python3
"""Fingerprint a reMarkable notebook for convert-skip decisions.

Hashes ordered page ids (from .content) and each page's .rm bytes — not the
full .content / .pagedata / .metadata sidecars, which can change without new
ink. Includes dpi + jpeg quality so settings changes force a rebuild.

Usage:
  notebook-fingerprint.py <notebook.metadata> [dpi] [jpeg_quality]
Prints a single-line stamp to stdout.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


def page_ids(content: Path) -> list[str]:
    """Ordered page ids — same rules as convert-rm-notebook.legacy_page_ids."""
    if not content.is_file():
        return []
    data = json.loads(content.read_text(encoding="utf-8"))
    pages = data.get("pages") or []
    if pages:
        return [str(p) for p in pages]
    cpages = (data.get("cPages") or {}).get("pages") or []
    ids: list[str] = []
    for page in cpages:
        if isinstance(page, str):
            ids.append(page)
        elif isinstance(page, dict) and page.get("id"):
            ids.append(str(page["id"]))
    return ids


def fingerprint(meta: Path, dpi: int, jpeg_quality: int) -> str:
    uuid = meta.stem
    root = meta.parent
    pages_dir = root / uuid
    content = root / f"{uuid}.content"

    h = hashlib.sha256()
    h.update(f"dpi={dpi}\njpeg={jpeg_quality}\n".encode())

    ids = page_ids(content)
    if not ids and pages_dir.is_dir():
        # Fallback: filesystem order when .content has no page list
        ids = sorted(p.stem for p in pages_dir.glob("*.rm"))

    h.update(b"pages=")
    h.update("\n".join(ids).encode())
    h.update(b"\0")

    for pid in ids:
        rm = pages_dir / f"{pid}.rm"
        h.update(pid.encode())
        h.update(b"\0")
        if rm.is_file():
            h.update(rm.read_bytes())
        h.update(b"\0")

    return h.hexdigest()


def main() -> None:
    if len(sys.argv) < 2:
        print(
            f"Usage: {sys.argv[0]} <notebook.metadata> [dpi] [jpeg_quality]",
            file=sys.stderr,
        )
        raise SystemExit(2)
    meta = Path(sys.argv[1])
    if not meta.is_file():
        raise SystemExit(f"Missing metadata: {meta}")
    dpi = int(sys.argv[2]) if len(sys.argv) >= 3 else 150
    jpeg_quality = int(sys.argv[3]) if len(sys.argv) >= 4 else 75
    print(fingerprint(meta, dpi, jpeg_quality))


if __name__ == "__main__":
    main()
