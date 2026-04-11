#!/bin/bash
SELF="$0"
while [ -L "$SELF" ]; do
  DIR="$(cd "$(dirname "$SELF")" && pwd)"
  SELF="$(readlink "$SELF")"
  [[ "$SELF" != /* ]] && SELF="$DIR/$SELF"
done
PLUGIN_ROOT="$(cd "$(dirname "$SELF")/../.." && pwd)"
cd "$PLUGIN_ROOT"

eval "$(${SHELL:-/bin/zsh} -lc 'echo export PATH="$PATH"' 2>/dev/null)"
if [ ! -d node_modules ]; then
  echo "Installing dependencies..." >&2
  bun install >&2
  bunx playwright install chromium >&2
fi
if ! command -v tesseract &>/dev/null; then
  echo "Error: tesseract is required for OCR. Install with: brew install tesseract" >&2
  exit 1
fi
bun run ocr.ts "$@"
