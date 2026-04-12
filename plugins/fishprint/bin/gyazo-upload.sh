#!/bin/bash
# Usage: gyazo-upload.sh <image_path>
# Prints the Gyazo image URL to stdout.
set -euo pipefail

IMAGE="$1"
if [ -z "$IMAGE" ]; then
  echo "Usage: gyazo-upload.sh <image_path>" >&2
  exit 1
fi

if [ "$(uname)" = "Darwin" ]; then
  TOKEN=$(security find-generic-password -a gyazo -s fishprint -w 2>/dev/null || true)
else
  TOKEN=$(secret-tool lookup service fishprint key gyazo 2>/dev/null || true)
fi

if [ -z "$TOKEN" ]; then
  echo "Error: Gyazo token not found. Set it with:" >&2
  echo "  macOS: security add-generic-password -a gyazo -s fishprint -w YOUR_TOKEN -U" >&2
  echo "  Linux: secret-tool store --label=fishprint service fishprint key gyazo" >&2
  exit 1
fi

curl -s -X POST https://upload.gyazo.com/api/upload \
  -F "access_token=$TOKEN" \
  -F "imagedata=@$IMAGE" \
  | grep -o '"url":"[^"]*"' | cut -d'"' -f4
