---
name: read
description: Extract text content from a web page using Playwright. Use when asked to "read a page" or "get article content".
user-invocable: true
allowed-tools:
  - Bash(kiri-read *)
  - Bash(mkdir *)
  - Bash(ls *)
  - Bash(head *)
---

# /kiri:read — Read web page text

Arguments: `$ARGUMENTS`

Opens a page with Playwright and extracts the main text content.

## Usage

```bash
kiri-read "<url>"
```

Take the URL from arguments. If none provided, ask the user.
