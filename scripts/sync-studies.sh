#!/usr/bin/env bash
# Sync study notebooks → local studies/*.pdf, optionally publish to Google Drive.
#
# Usage:
#   scripts/sync-studies.sh --from-cloud           # rmapi cloud → convert
#   scripts/sync-studies.sh --from-cloud --publish # then upload Drive
#   scripts/sync-studies.sh                       # LAN backup + convert (manual)
#   scripts/sync-studies.sh --skip-backup         # convert from local backup only
#   scripts/sync-studies.sh --publish             # (+ Drive upload)
#   scripts/sync-studies.sh --push                # alias for --publish
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/studies.config.json"
STUDIES_DIR="$ROOT/studies"
LOG_DIR="${HOME}/Library/Application Support/remarkablesync/logs"
CLOUD_CACHE="${HOME}/Library/Application Support/rmapi/cloud-cache"
UNPACK_PY="$ROOT/scripts/lib/unpack-rmdoc.py"
mkdir -p "$LOG_DIR" "$STUDIES_DIR"

SKIP_BACKUP=0
DO_PUBLISH=0
FROM_CLOUD=0
for arg in "$@"; do
  case "$arg" in
    --skip-backup) SKIP_BACKUP=1 ;;
    --from-cloud) FROM_CLOUD=1 ;;
    --publish|--push) DO_PUBLISH=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
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
    text = str(value)
    return f"{name}={json.dumps(text)}"

cfg = json.loads(Path(sys.argv[1]).read_text())
rm = cfg["remarkable"]
folder = rm.get("tabletFolder") or "Studies"
cloud_folder = str(rm.get("cloudFolder") or f"/{folder}").strip() or f"/{folder}"
if not cloud_folder.startswith("/"):
    cloud_folder = "/" + cloud_folder
rmapi = expand(rm.get("rmapiBin") or str(Path.home() / ".local/bin/rmapi"))
lines = [
    sh_assign("TABLET_FOLDER", folder),
    sh_assign("CLOUD_FOLDER", cloud_folder),
    sh_assign("BACKUP_DIR", expand(rm["backupDir"])),
    sh_assign("RMS_BIN", expand(rm["rmsBin"])),
    sh_assign("RMRL_PY", expand(rm["rmrlPython"])),
    sh_assign("RMAPI_BIN", rmapi),
    sh_assign("PDF_DPI", int(rm.get("pdfDpi", 150))),
    sh_assign("PDF_JPEG_QUALITY", int(rm.get("pdfJpegQuality", 75))),
]
for i, c in enumerate(cfg["courses"]):
    lines.append(sh_assign(f"COURSE_{i}_UUID", c["notebookUuid"]))
    lines.append(sh_assign(f"COURSE_{i}_PDF", c["pdf"]))
    lines.append(sh_assign(f"COURSE_{i}_NAME", c.get("notebookName") or c["pdf"]))
lines.append(sh_assign("COURSE_COUNT", len(cfg["courses"])))
Path(sys.argv[2]).write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
# shellcheck disable=SC1090
source "$CONFIG_ENV"
rm -f "$CONFIG_ENV"

NOTEBOOKS="${BACKUP_DIR}/Notebooks"
DISCOVER_PY="$ROOT/scripts/lib/discover-remarkable.py"
RMS_CONFIG="${HOME}/Library/Application Support/remarkablesync/config.json"

if [[ ! -x "$RMRL_PY" ]]; then
  echo "rmrl python not found: $RMRL_PY" >&2
  exit 1
fi

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

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
  local py="$RMRL_PY"
  if [[ ! -x "$py" ]]; then
    py="$(command -v python3)"
  fi
  "$py" "$DISCOVER_PY" "$CONFIG"
}

cloud_path_for() {
  # Prefer /Studies/<notebookName>; CLOUD_FOLDER may already include leading /
  local name="$1"
  local base="${CLOUD_FOLDER%/}"
  [[ "$base" == /* ]] || base="/$base"
  printf '%s/%s\n' "$base" "$name"
}

fetch_from_cloud() {
  mkdir -p "$CLOUD_CACHE"
  if [[ ! -x "$RMAPI_BIN" ]]; then
    echo "rmapi not found: $RMAPI_BIN (run: bash scripts/setup-rmapi.sh)" >&2
    exit 1
  fi
  if ! "$RMAPI_BIN" -ni ls >/dev/null 2>&1; then
    echo "rmapi not authenticated. Run: bash scripts/setup-rmapi.sh" >&2
    exit 1
  fi

  local i=0
  local fetched=0
  local skipped=0
  while [[ "$i" -lt "$COURSE_COUNT" ]]; do
    eval "uuid=\$COURSE_${i}_UUID"
    eval "name=\$COURSE_${i}_NAME"
    eval "pdf=\$COURSE_${i}_PDF"
    local remote
    remote="$(cloud_path_for "$name")"
    local work="${CLOUD_CACHE}/${uuid}"
    mkdir -p "$work"
    rm -f "$work/meta.path"
    log "Cloud download ${remote}…"

    # Without Connect, files unused ~50d drop out of cloud — skip, keep prior PDF.
    if ! (
      cd "$work"
      shopt -s nullglob
      rm -f -- ./*.rmdoc
      if ! "$RMAPI_BIN" -ni get "$remote" 2>/dev/null; then
        log "  path miss; trying get --id ${uuid}"
        "$RMAPI_BIN" -ni get --id "$uuid" 2>/dev/null || true
      fi
      local rmdoc=""
      local f
      for f in ./*.rmdoc; do
        rmdoc="$f"
        break
      done
      if [[ -z "$rmdoc" || ! -f "$rmdoc" ]]; then
        exit 1
      fi
      meta="$("$RMRL_PY" "$UNPACK_PY" "$rmdoc" "$work")"
      printf '%s\n' "$meta" >"$work/meta.path"
    ); then
      log "  skip ${name} (${pdf}) — not on cloud (inactive ~50d without Connect, wrong path, or auth). Keeping prior studies/${pdf} if present."
      skipped=$((skipped + 1))
    else
      fetched=$((fetched + 1))
    fi
    i=$((i + 1))
  done

  if [[ "$fetched" -eq 0 ]]; then
    log "No notebooks fetched from cloud (${skipped} skipped). Leaving studies/ unchanged."
    exit 0
  fi
  log "Cloud fetch done (${fetched} ok, ${skipped} skipped)."
}

backup_from_wifi() {
  if [[ ! -x "$RMS_BIN" ]]; then
    echo "reMarkableSync not found: $RMS_BIN" >&2
    exit 1
  fi
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
}

if [[ "$FROM_CLOUD" -eq 1 ]]; then
  fetch_from_cloud
elif [[ "$SKIP_BACKUP" -eq 0 ]]; then
  backup_from_wifi
else
  log "Skipping tablet backup."
fi

changed=0
UPDATED_PDFS=()
i=0
while [[ "$i" -lt "$COURSE_COUNT" ]]; do
  eval "uuid=\$COURSE_${i}_UUID"
  eval "pdf=\$COURSE_${i}_PDF"

  if [[ "$FROM_CLOUD" -eq 1 ]]; then
    if [[ ! -f "${CLOUD_CACHE}/${uuid}/meta.path" ]]; then
      log "Skip convert ${pdf} (no fresh cloud copy)."
      i=$((i + 1))
      continue
    fi
    meta="$(cat "${CLOUD_CACHE}/${uuid}/meta.path")"
  else
    meta="${NOTEBOOKS}/${uuid}.metadata"
  fi

  if [[ ! -f "$meta" ]]; then
    log "Missing notebook metadata: $meta"
    i=$((i + 1))
    continue
  fi

  # BSD mktemp: Xs must be last; avoid nesting quotes with ${pdf} in the template.
  tmp="$(mktemp "${TMPDIR:-/tmp}/rm-studies.XXXXXXXX")" || exit 1
  log "Converting ${uuid} -> ${pdf} at ${PDF_DPI}dpi via rmrl/rmc hybrid"
  if ! "$RMRL_PY" "$ROOT/scripts/lib/convert-rm-notebook.py" "$meta" "$tmp" "$PDF_DPI" "$PDF_JPEG_QUALITY"; then
    log "convert failed for $uuid"
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
    UPDATED_PDFS+=("$pdf")
  fi
  i=$((i + 1))
done

if [[ "$DO_PUBLISH" -eq 0 ]]; then
  if [[ "$changed" -eq 0 ]]; then
    log "No PDF changes."
  else
    log "PDFs updated under studies/. Re-run with --publish to upload to Drive."
  fi
  exit 0
fi

if [[ "${#UPDATED_PDFS[@]}" -eq 0 ]]; then
  log "No PDF bytes changed — skipping Drive upload."
  exit 0
fi

# Only push notebooks whose local PDF changed this run (md5 check is a second gate).
log "Uploading ${#UPDATED_PDFS[@]} updated PDF(s) to Google Drive…"
cd "$ROOT"
node "$ROOT/scripts/studies-drive.mjs" --upload -- "${UPDATED_PDFS[@]}"
log "Drive upload done. Site picks them up on the next Actions sync (daily cron or manual run)."
