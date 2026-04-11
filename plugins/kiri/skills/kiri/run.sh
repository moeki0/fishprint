#!/bin/bash
# CLAUDE_SKILL_DIR（skills/kiri/）から2つ上がプラグインルート
PLUGIN_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PLUGIN_ROOT"

# ユーザーのログインシェルからPATHを継承
eval "$(${SHELL:-/bin/zsh} -lc 'echo export PATH="$PATH"' 2>/dev/null)"

# 依存関係の自動インストール
if [ ! -d node_modules ]; then
  echo "Installing dependencies..." >&2
  bun install >&2
  bunx playwright install chromium >&2
fi

if [ "$1" = "ocr" ] && ! command -v tesseract &>/dev/null; then
  echo "Error: tesseract is required for OCR. Install with: brew install tesseract" >&2
  exit 1
fi

bun run capture.ts "$@"
