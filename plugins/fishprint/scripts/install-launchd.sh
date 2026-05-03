#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.moeki.fishprint.plist"
LOG_DIR="$HOME/Library/Logs/fishprint"
BUN_BIN="$(command -v bun)"

mkdir -p "$(dirname "$PLIST")" "$LOG_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.moeki.fishprint</string>

  <key>ProgramArguments</key>
  <array>
    <string>${BUN_BIN}</string>
    <string>--cwd</string>
    <string>${ROOT}</string>
    <string>daemon.ts</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>FISHPRINT_HOST</key>
    <string>127.0.0.1</string>
    <key>FISHPRINT_PORT</key>
    <string>3847</string>
    <key>PATH</key>
    <string>$(dirname "${BUN_BIN}"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/daemon.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/daemon.err.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/com.moeki.fishprint"

echo "Installed and started fishprint daemon"
echo "  plist: $PLIST"
echo "  health: curl http://127.0.0.1:3847/health"
