#!/usr/bin/env bash
# Index study PDFs with syllabus[] → invisible text + outline (macOS / Vision).
# Usage: scripts/index-studies.sh [--force] [--pdf name.pdf] …
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/studies.config.json"
RMRL_PY="$(python3 -c "
import json
from pathlib import Path
cfg = json.loads(Path('$CONFIG').read_text())
print(Path(cfg['remarkable']['rmrlPython']).expanduser())
")"
if [[ ! -x "$RMRL_PY" ]]; then
  echo "rmrl python not found: $RMRL_PY" >&2
  exit 1
fi
exec "$RMRL_PY" "$ROOT/scripts/lib/index-study-pdf.py" --config "$CONFIG" "$@"
