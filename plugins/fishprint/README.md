# Fishprint

> Primary-source 魚拓 archive for the web.

A Claude Code plugin that browses curated media (Hacker News, Lobsters, Reddit, arXiv, …), captures 魚拓 (screenshots) of the key sentences it quotes, and writes a citation-driven topic digest in Markdown.

Each 魚拓 shows the original page **exactly as published** — original language, original layout. A natural translation is rendered directly below as a blockquote. You get both: the primary-source evidence *and* the readable summary.

## How it works

```
Phase 1 — Browse & select
  main agent visits curation sites, extracts ~15〜20 candidate topics,
  picks ~8 strongest, keeps the rejected ones as "also seen"

Phase 2 — Research in parallel
  one general-purpose subagent per topic, dispatched concurrently.
  each subagent: open sources → pick thesis sentences → capture 魚拓 → write section

Phase 3 — Assemble
  concatenate sections, prepend a scope-framing preamble
  (sources surveyed) and a list of rejected candidates as the appendix
```

**Scaling.** The main agent only holds the topic list. All heavy context (DOMs, quotes, translations) lives inside subagents, so a run that covers 8〜12 topics stays in bounds.

**Anti-FOMO design.** Every digest explicitly states this is one curator's view (not a complete index), lists which sources were surveyed, and shows candidates that were considered and rejected with reasons. Visible selection beats hidden selection.

## Install

```
/plugin marketplace add moeki0/claude-code-fishprint
/plugin install fishprint@fishprint
```

### Prerequisites

```bash
brew install oven-sh/bun/bun
```

### Gyazo token (required — 魚拓 are uploaded here)

Store your Gyazo API token in the OS keychain:

```bash
# macOS
security add-generic-password -a gyazo -s fishprint -w YOUR_GYAZO_TOKEN -U

# Linux
secret-tool store --label=fishprint service fishprint key gyazo
```

Get a token at [gyazo.com/oauth/applications](https://gyazo.com/oauth/applications).

### Playwright

Playwright is installed as a dependency. On first run you may need to install browsers:

```bash
bunx playwright install chromium
```

## Daemon

Fishprint runs as a local daemon (not MCP) on `127.0.0.1:3847`.

```bash
# foreground
bun run daemon

# macOS LaunchAgent (auto-start + keepalive)
bun run daemon:install

# stop/remove LaunchAgent
bun run daemon:uninstall

# check
curl http://127.0.0.1:3847/health
```

API endpoints:

- `POST /open` `{ "url": "https://example.com" }`
- `POST /capture` `{ "id": "1", "selectors": ["article p:nth-of-type(4)"] }`
- `POST /close` `{ "id": "1" }`
- `POST /assemble` `{ "sectionDir": "/tmp/fishprint_x", "output": "/abs/out.md", "preamble": "...", "appendix": "..." }`

## Usage

```
/fishprint AI agents
/fishprint Rust async
/fishprint              # no theme — whatever is interesting on major curation sites right now
```

Output: `{theme}_YYYY-MM-DD.md` (or `fishprint_YYYY-MM-DD.md` if no theme given) in your current working directory.

## Output shape

```markdown
> One curator's view of AI agents on 2026-04-12 — eight items lifted from today's haystack, not a complete index.

**Surveyed today:**
- [Hacker News front page](https://news.ycombinator.com/)
- [Lobsters](https://lobste.rs/)
- [/r/MachineLearning](https://old.reddit.com/r/MachineLearning/)

---

## Topic 1 title (in your language)

Narrative text explaining context and significance.

![Original-language quote, as shown on the page](https://i.gyazo.com/xxx.png)

> A natural translation rendered directly under the image.

More narrative connecting this to the next 魚拓.

**Sources:**
- → [Primary source](https://example.com/article)

---

## Topic 2 title

…

---

## Also seen (not selected)

- [Yet another JS framework](https://…) — not substantively new
- [Reddit thread about IDE preferences](https://…) — opinion, no news
```

## How it works internally

A local HTTP daemon (`daemon.ts`) wraps Playwright for headless browsing and exposes four actions: `open` (visit a page, return DOM structure), `capture` (screenshot CSS-selected elements and upload to Gyazo via API), `close` (free page), and `assemble` (concatenate section files into the final digest). Gyazo uploads use the REST API directly — no external CLI needed.

## License

MIT
