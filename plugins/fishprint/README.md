# Fishprint

> Primary-source scrapbook for the web.

A Claude Code plugin that browses curated media (Hacker News, Lobsters, Reddit, arXiv, …), 魚拓 (screenshots) key sentences from each source, and writes a citation-driven topic digest in Markdown. Each 魚拓 shows the original page exactly as published; a translation is rendered directly below as a blockquote.

## What it does

1. Browses curation sites and extracts a list of distinct topics
2. Spawns one subagent per topic — each opens its sources, selects thesis-bearing sentences, captures 魚拓, and writes its own section
3. Assembles all sections into one dated Markdown file

## Install

```
/plugin marketplace add moeki0/claude-code-scrapbook
/plugin install fishprint@fishprint
```

### Setup

```bash
cd ~/.claude/plugins/cache/fishprint/fishprint/*/
bun install && bunx playwright install chromium
```

### Gyazo (required for 魚拓 upload)

```bash
# macOS
security add-generic-password -a gyazo -s fishprint -w YOUR_GYAZO_TOKEN -U
# Linux
secret-tool store --label=fishprint service fishprint key gyazo
```

(A `scrapbook` service entry still works as a fallback if you set it up under the old plugin name.)

## Usage

```
/fishprint:go AI agents
/fishprint:go Rust async
/fishprint:go              # no theme — whatever is interesting on major curation sites right now
```

Output: `fishprint_YYYY_MM_DD.md` in your working directory. Each quote is a Gyazo-hosted screenshot of the original element, followed by a natural translation as a blockquote.

## License

MIT
