#!/usr/bin/env bash
# Sync study notebooks from the reMarkable (RemarkableSync backup + rmrl PDF),
# copy into studies/, optionally commit + push so Pages picks them up.
#
# Usage:
#   scripts/sync-studies.sh              # backup + convert + copy
#   scripts/sync-studies.sh --skip-backup  # convert from existing backup only
#   scripts/sync-studies.sh --push       # also commit studies/*.pdf and push
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/studies.config.json"
STUDIES_DIR="$ROOT/studies"
LOG_DIR="${HOME}/Library/Application Support/remarkablesync/logs"
mkdir -p "$LOG_DIR" "$STUDIES_DIR"

SKIP_BACKUP=0
DO_PUSH=0
for arg in "$@"; do
  case "$arg" in
    --skip-backup) SKIP_BACKUP=1 ;;
    --push) DO_PUSH=1 ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      exit 2
      ;;
  esac
done

CONFIG_ENV="$(mktemp -t studies-config.XXXXXX)"
python3 - "$CONFIG" "$CONFIG_ENV" <<'PY'
import json
import sys
from pathlib import Path

def expand(p: str) -> str:
    return str(Path(p).expanduser())

def sh_assign(name: str, value) -> str:
    # Safe shell assignment for values without newlines.
    text = str(value)
    return f"{name}={json.dumps(text)}"

cfg = json.loads(Path(sys.argv[1]).read_text())
rm = cfg["remarkable"]
folder = rm.get("tabletFolder") or "Studies"
lines = [
    sh_assign("TABLET_FOLDER", folder),
    sh_assign("BACKUP_DIR", expand(rm["backupDir"])),
    sh_assign("RMS_BIN", expand(rm["rmsBin"])),
    sh_assign("RMRL_PY", expand(rm["rmrlPython"])),
    sh_assign("PDF_DPI", int(rm.get("pdfDpi", 150))),
    sh_assign("PDF_JPEG_QUALITY", int(rm.get("pdfJpegQuality", 75))),
]
for i, c in enumerate(cfg["courses"]):
    lines.append(sh_assign(f"COURSE_{i}_UUID", c["notebookUuid"]))
    lines.append(sh_assign(f"COURSE_{i}_PDF", c["pdf"]))
lines.append(sh_assign("COURSE_COUNT", len(cfg["courses"])))
Path(sys.argv[2]).write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
# shellcheck disable=SC1090
source "$CONFIG_ENV"
rm -f "$CONFIG_ENV"

NOTEBOOKS="${BACKUP_DIR}/Notebooks"
DISCOVER_PY="$ROOT/scripts/lib/discover-remarkable.py"
RMS_CONFIG="${HOME}/Library/Application Support/remarkablesync/config.json"

if [[ ! -x "$RMS_BIN" ]]; then
  echo "reMarkableSync not found: $RMS_BIN" >&2
  exit 1
fi
if [[ ! -x "$RMRL_PY" ]]; then
  echo "rmrl python not found: $RMRL_PY" >&2
  exit 1
fi

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# Keep RemarkableSync's folder filter in sync with studies.config.json
sync_rms_folder_filter() {
  python3 - "$RMS_CONFIG" "$TABLET_FOLDER" <<'PY'
import json, sys
from pathlib import Path

cfg_path = Path(sys.argv[1])
folder = sys.argv[2]
cfg = {}
if cfg_path.is_file():
    cfg = json.loads(cfg_path.read_text())
cfg["folders"] = [folder]
cfg_path.parent.mkdir(parents=True, exist_ok=True)
cfg_path.write_text(json.dumps(cfg, indent=2) + "\n")
print(folder)
PY
}

discover_wifi_host() {
  # Prefer the RemarkableSync venv (has paramiko + keyring)
  local py="$RMRL_PY"
  if [[ ! -x "$py" ]]; then
    py="$(command -v python3)"
  fi
  "$py" "$DISCOVER_PY" "$CONFIG"
}

if [[ "$SKIP_BACKUP" -eq 0 ]]; then
  log "Setting RemarkableSync folder filter → ${TABLET_FOLDER}"
  sync_rms_folder_filter >/dev/null
  log "Discovering tablet on LAN…"
  if ! WIFI_HOST="$(discover_wifi_host)"; then
    log "Could not find tablet (asleep/offline/VPN?). Leaving studies/ unchanged."
    exit 0
  fi
  log "Backing up tablet via RemarkableSync (wifi ${WIFI_HOST}, folder ${TABLET_FOLDER})…"
  if ! "$RMS_BIN" backup \
      --wifi --wifi-host "$WIFI_HOST" \
      -d "$BACKUP_DIR" \
      -l inf; then
    log "Backup failed after discovery. Leaving studies/ unchanged."
    exit 0
  fi
else
  log "Skipping tablet backup."
fi

changed=0
i=0
while [[ "$i" -lt "$COURSE_COUNT" ]]; do
  eval "uuid=\$COURSE_${i}_UUID"
  eval "pdf=\$COURSE_${i}_PDF"
  meta="${NOTEBOOKS}/${uuid}.metadata"
  if [[ ! -f "$meta" ]]; then
    log "Missing notebook metadata: $meta"
    i=$((i + 1))
    continue
  fi

  tmp="$(mktemp -t "studies-${pdf}.XXXXXX.pdf")"
  log "Converting ${uuid} → ${pdf} via rmrl (then compress ${PDF_DPI}dpi)…"
  if ! "$RMRL_PY" "$ROOT/scripts/lib/convert-rm-notebook.py" "$meta" "$tmp" "$PDF_DPI" "$PDF_JPEG_QUALITY"; then
    log "rmrl failed for $uuid"
    rm -f "$tmp"
    exit 1
  fi

  dest="${STUDIES_DIR}/${pdf}"
  if [[ -f "$dest" ]] && cmp -s "$tmp" "$dest"; then
    log "Unchanged: $pdf"
    rm -f "$tmp"
  else
    mv "$tmp" "$dest"
    log "Updated: $pdf"
    changed=1
  fi
  i=$((i + 1))
done

if [[ "$changed" -eq 0 ]]; then
  log "No PDF changes."
  exit 0
fi

if [[ "$DO_PUSH" -eq 0 ]]; then
  log "PDFs updated under studies/. Re-run with --push to commit and push."
  exit 0
fi

cd "$ROOT"
git add -- studies/*.pdf
if git diff --cached --quiet; then
  log "Nothing staged to commit."
  exit 0
fi

git commit -m "$(cat <<'EOF'
Refresh study notebook PDFs from reMarkable.

EOF
)"
git push origin HEAD
log "Pushed study PDF updates."
