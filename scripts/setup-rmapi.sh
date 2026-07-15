#!/usr/bin/env bash
# Install / locate rmapi and walk through one-time cloud login.
set -euo pipefail

RMAPI_BIN="${RMAPI_BIN:-$HOME/.local/bin/rmapi}"
RELEASE="v0.0.34"
ARCH="$(uname -m)"
case "$ARCH" in
  arm64|aarch64) ZIP="rmapi-macos-arm64.zip" ;;
  x86_64) ZIP="rmapi-macos-intel.zip" ;;
  *)
    echo "Unsupported arch: $ARCH" >&2
    exit 1
    ;;
esac

if [[ ! -x "$RMAPI_BIN" ]]; then
  echo "Installing rmapi ${RELEASE} → ${RMAPI_BIN}"
  mkdir -p "$(dirname "$RMAPI_BIN")"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/rmapi.zip" \
    "https://github.com/ddvk/rmapi/releases/download/${RELEASE}/${ZIP}"
  unzip -o -q "$tmp/rmapi.zip" -d "$tmp"
  install -m 755 "$tmp/rmapi" "$RMAPI_BIN"
  rm -rf "$tmp"
fi

mkdir -p "$HOME/Library/Application Support/rmapi"

echo "rmapi: $("$RMAPI_BIN" version)"
if ! "$RMAPI_BIN" -ni ls >/dev/null 2>&1; then
  cat <<EOF

One-time login required:
  1. Open https://my.remarkable.com/device/browser/connect
  2. Run:  $RMAPI_BIN
  3. Paste the 8-character code when prompted
  4. Re-run: npm run studies:cloud

EOF
  exit 1
fi

echo "Already authenticated. Try: npm run studies:cloud"
"$RMAPI_BIN" -ni ls
