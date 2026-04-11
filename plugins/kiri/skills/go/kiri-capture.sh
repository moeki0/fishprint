#!/bin/bash
PLUGIN_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PLUGIN_ROOT"
eval "$(${SHELL:-/bin/zsh} -lc 'echo export PATH="$PATH"' 2>/dev/null)"
if [ ! -d node_modules ]; then
  echo "Installing dependencies..." >&2
  bun install >&2
  bunx playwright install chromium >&2
fi
bun run capture.ts "$@"
