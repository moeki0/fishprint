#!/bin/bash
# Wrapper for agent-browser that resolves PATH in Claude Code environments
# where Homebrew bin is not on PATH by default.
set -euo pipefail

for candidate in \
  "$(which agent-browser 2>/dev/null)" \
  /opt/homebrew/bin/agent-browser \
  /usr/local/bin/agent-browser \
  "$HOME/.npm/bin/agent-browser" \
  "$HOME/.bun/bin/agent-browser"; do
  if [ -x "$candidate" ] 2>/dev/null; then
    exec "$candidate" "$@"
  fi
done

echo "Error: agent-browser not found. Install with: brew install agent-browser && agent-browser install" >&2
exit 1
