#!/bin/bash
# Sync the Desktop source of truth into the session scratchpad copy that the
# preview dev server actually runs from. Needed because macOS TCC blocks the
# preview harness from reading ~/Desktop (see project memory). Vite's watcher
# picks up the copied files and hot-reloads.
# Usage: ./sync-preview.sh <scratchpad-painted-cave-path>
DEST="${1:?usage: sync-preview.sh <dest>}"
# Excludes are anchored (/dist not dist) so node_modules/vite/dist still syncs.
rsync -a --delete --exclude /.git --exclude "/dist" --exclude /node_modules \
  "$(dirname "$0")/" "$DEST/"
echo "synced → $DEST"
