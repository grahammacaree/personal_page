#!/usr/bin/env python3
"""Unpack an rmapi .rmdoc (zip) into a RemarkableSync-like notebook layout.

Returns the path to ``<uuid>.metadata`` on stdout.
"""

from __future__ import annotations

import json
import shutil
import sys
import zipfile
from pathlib import Path


def find_uuid(extract_root: Path) -> str:
    metas = list(extract_root.rglob("*.metadata"))
    if not metas:
        raise SystemExit(f"No .metadata in {extract_root}")
    # Prefer a file whose stem matches a sibling .content
    for meta in metas:
        sibling = meta.with_suffix(".content")
        if sibling.is_file() or (meta.parent / f"{meta.stem}.content").is_file():
            return meta.stem
    return metas[0].stem


def normalize_layout(extract_root: Path, out_dir: Path, uuid: str) -> Path:
    """Produce ``out_dir/<uuid>.metadata`` + ``out_dir/<uuid>/*.rm``."""
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    # Case A: already looks like RemarkableSync (uuid.metadata + uuid/*.rm)
    meta_src = extract_root / f"{uuid}.metadata"
    pages_src = extract_root / uuid
    if meta_src.is_file() and pages_src.is_dir():
        for suffix in (".metadata", ".content", ".pagedata"):
            src = extract_root / f"{uuid}{suffix}"
            if src.is_file():
                shutil.copy2(src, out_dir / src.name)
        shutil.copytree(pages_src, out_dir / uuid)
        return out_dir / f"{uuid}.metadata"

    # Case B: nested single folder
    nested = [p for p in extract_root.iterdir() if p.is_dir()]
    if len(nested) == 1 and (nested[0] / f"{uuid}.metadata").is_file():
        return normalize_layout(nested[0], out_dir, uuid)

    # Case C: flat .rm files next to .content / .metadata
    meta = next(extract_root.rglob(f"{uuid}.metadata"), None) or next(
        extract_root.rglob("*.metadata")
    )
    content = meta.with_suffix(".content")
    if not content.is_file():
        content = meta.parent / f"{meta.stem}.content"
    uuid = meta.stem

    for src in meta.parent.glob(f"{uuid}.*"):
        if src.suffix in {".metadata", ".content", ".pagedata"}:
            shutil.copy2(src, out_dir / src.name)

    pages_dir = out_dir / uuid
    pages_dir.mkdir(parents=True, exist_ok=True)

    # Pages may live in uuid/ or flat alongside metadata
    candidates = []
    if (meta.parent / uuid).is_dir():
        candidates.extend((meta.parent / uuid).iterdir())
    candidates.extend(meta.parent.glob("*.rm"))
    candidates.extend(meta.parent.glob("*-metadata.json"))

    seen: set[str] = set()
    for src in candidates:
        if not src.is_file():
            continue
        if src.name in seen:
            continue
        seen.add(src.name)
        shutil.copy2(src, pages_dir / src.name)

    content_path = out_dir / f"{uuid}.content"
    if content_path.is_file():
        data = json.loads(content_path.read_text(encoding="utf-8"))
        # ensure pages exist
        pages = data.get("pages") or []
        if not pages:
            cpages = (data.get("cPages") or {}).get("pages") or []
            pages = [
                p if isinstance(p, str) else str(p.get("id", ""))
                for p in cpages
                if (isinstance(p, str) or p.get("id"))
            ]
        missing = [
            pid
            for pid in pages
            if pid and not (pages_dir / f"{pid}.rm").is_file()
        ]
        if missing and len(missing) == len(pages):
            raise SystemExit(
                f"Unpacked rmdoc but found no .rm pages for {uuid} "
                f"(looked under {meta.parent})"
            )

    return out_dir / f"{uuid}.metadata"


def main() -> int:
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <notebook.rmdoc> <out_dir>", file=sys.stderr)
        return 2
    rmdoc = Path(sys.argv[1]).expanduser().resolve()
    out_dir = Path(sys.argv[2]).expanduser().resolve()
    if not rmdoc.is_file():
        print(f"Missing rmdoc: {rmdoc}", file=sys.stderr)
        return 1

    extract = out_dir / "_extract"
    if extract.exists():
        shutil.rmtree(extract)
    extract.mkdir(parents=True)

    with zipfile.ZipFile(rmdoc) as zf:
        zf.extractall(extract)

    uuid = find_uuid(extract)
    meta = normalize_layout(extract, out_dir / "notebook", uuid)
    shutil.rmtree(extract, ignore_errors=True)
    print(meta)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
