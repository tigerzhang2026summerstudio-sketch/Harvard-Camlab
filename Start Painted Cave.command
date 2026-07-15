#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
#  THE PAINTED CAVE — one-click launcher
#  Double-click this file. It starts the show and opens the browser.
#  Close this window (or press Ctrl+C) to stop the show.
#  No terminal knowledge needed — everything is automatic.
# ─────────────────────────────────────────────────────────────────────
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$DIR/tools/node-v22.17.0-darwin-arm64/bin"
export PATH="$NODE_BIN:$PATH"
PORT=5173
URL="http://localhost:$PORT"

open_browser() {
  [ -n "$NO_OPEN" ] && return 0
  # Web MIDI needs Chrome or Edge; fall back to the default browser.
  open -a "Google Chrome" "$URL" 2>/dev/null \
    || open -a "Microsoft Edge" "$URL" 2>/dev/null \
    || open "$URL"
}

# Already running (e.g. launched twice)? Just open the browser.
if curl -s --max-time 2 -o /dev/null "$URL"; then
  echo "The Painted Cave is already running — opening your browser."
  open_browser
  exit 0
fi

if [ ! -x "$NODE_BIN/node" ]; then
  echo "The bundled Node runtime is missing from tools/."
  echo "See README.md ('Run' section) to restore it."
  read -r -n1 -p "Press any key to close…"
  exit 1
fi

cd "$DIR" || exit 1

# First run only: fetch the two JS libraries the piece uses.
if [ ! -d node_modules ]; then
  echo "First run — installing dependencies (about a minute)…"
  "$NODE_BIN/npm" install --no-fund --no-audit || {
    echo "Install failed (are you online?)."
    read -r -n1 -p "Press any key to close…"
    exit 1
  }
fi

echo
echo "  ✦ The Painted Cave ✦"
echo "  Starting… your browser will open by itself."
echo "  Leave this window open during the show; close it to stop."
echo

# Open the browser as soon as the server answers.
( for _ in $(seq 1 60); do
    curl -s --max-time 1 -o /dev/null "$URL" && { open_browser; exit 0; }
    sleep 0.5
  done ) &

exec "$NODE_BIN/node" node_modules/vite/bin/vite.js --port $PORT --strictPort
