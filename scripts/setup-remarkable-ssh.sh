#!/usr/bin/env bash
# One-time: store the reMarkable SSH password in the macOS keyring for RemarkableSync.
set -euo pipefail

RMS_PY="${HOME}/Library/Application Support/remarkablesync/venv/bin/python"
CFG="${HOME}/Library/Application Support/remarkablesync/config.json"

if [[ ! -x "$RMS_PY" ]]; then
  echo "RemarkableSync venv not found at:" >&2
  echo "  $RMS_PY" >&2
  echo "Install with: python3.12 -m venv … && pip install remarkablesync rmrl" >&2
  exit 1
fi

echo "Password is under Settings → Help → Copyrights and licenses on the tablet."
read -r -s -p "reMarkable SSH password: " PASS
echo
if [[ -z "$PASS" ]]; then
  echo "No password entered." >&2
  exit 1
fi

"$RMS_PY" - "$PASS" <<'PY'
import json
import sys
from pathlib import Path

password = sys.argv[1]
try:
    import keyring
except ImportError:
    sys.exit("keyring package missing in RemarkableSync venv")

ok = keyring.set_password("reMarkableSync", "reMarkable_ssh", password)
if ok is False:
    sys.exit("Failed to store password in keyring")

cfg_path = Path.home() / "Library/Application Support/remarkablesync/config.json"
cfg = {}
if cfg_path.exists():
    cfg = json.loads(cfg_path.read_text())
cfg["password_in_keyring"] = True
cfg_path.parent.mkdir(parents=True, exist_ok=True)
cfg_path.write_text(json.dumps(cfg, indent=2) + "\n")
print("Saved SSH password to macOS keyring (service=reMarkableSync).")
PY

echo "Done. Try: npm run studies:sync"
