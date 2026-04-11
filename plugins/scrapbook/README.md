# Scrapbook

A Claude Code plugin that browses curated media (Hacker News, Lobsters, etc.), captures interesting text fragments as screenshots (魚拓), and writes a digest with Japanese translations.

## What it does

1. Browses curated media sites (HN, Lobsters, Reddit, source articles)
2. Picks the most interesting text fragments for a given theme
3. Screenshots each fragment (魚拓 / web archive snapshot)
4. Generates a Markdown digest: screenshot + Japanese translation for each fragment

## Install

```
/plugin marketplace add moeki0/claude-code-scrapbook
/plugin install scrapbook@scrapbook
```

### Setup

```bash
cd ~/.claude/plugins/cache/scrapbook/scrapbook/*/
bun install && bunx playwright install chromium
```

### Optional: Gyazo

```bash
# macOS
security add-generic-password -a gyazo -s scrapbook -w YOUR_GYAZO_TOKEN -U
# Linux
secret-tool store --label=scrapbook service scrapbook key gyazo
```

## Usage

```
/scrapbook:go AI agents
/scrapbook:go Rust async
/scrapbook:go            # no theme — captures whatever is interesting on HN right now
```

Output: `scrapbook_YYYY_MM_DD.md` with fragment screenshots in `./scrapbook_images/`.

Each captured text fragment is immediately followed by its Japanese translation.

## Configuration (optional)

Place `scrapbook.json` at project root to customize output:

```json
{
  "output": "news/digest_{{date}}.md",
  "images": "gyazo",
  "instructions": "Write in Japanese."
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `output` | Output path. `{{date}}` → `YYYY_MM_DD` | `scrapbook_{{date}}.md` |
| `images` | `"gyazo"` or `"local"` | `"local"` |
| `instructions` | Custom directives | None |

## License

MIT
