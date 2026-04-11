---
name: capture
description: Take translated screenshots of web page elements. Use when asked to "screenshot", "capture", or "clip a page".
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(scrapbook-read *)
  - Bash(scrapbook-capture *)
  - Bash(mkdir *)
  - Bash(ls *)
  - Bash(head *)
  - Write(/tmp/*)
---

# /scrapbook:capture — Translated screenshots

Arguments: `$ARGUMENTS`

Inject translations into page elements and capture element-level screenshots to Gyazo or local storage.

## Flow

1. Read page text with `scrapbook-read "<url>"`
2. Decide which sections to clip and translate
3. Write `/tmp/sections.json` using the Write tool (not cat)
4. Capture

```bash
scrapbook-capture "<url>" /tmp/sections.json
scrapbook-capture "<url>" /tmp/sections.json --local <dir>
```

- Empty `translated` → no translation injection
- `capture: false` → inject translation only, don't screenshot

Take URL from arguments. If none provided, ask the user.
