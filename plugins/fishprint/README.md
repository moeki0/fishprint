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

### Setup

```bash
brew install agent-browser
agent-browser install
```

### Gyazo (required — 魚拓 are uploaded here)

```bash
# macOS
security add-generic-password -a gyazo -s fishprint -w YOUR_GYAZO_TOKEN -U
# Linux
secret-tool store --label=fishprint service fishprint key gyazo
```

Get a token at [gyazo.com/oauth/applications](https://gyazo.com/oauth/applications).

## Usage

```
/fishprint:go AI agents
/fishprint:go Rust async
/fishprint:go              # no theme — whatever is interesting on major curation sites right now
```

Output: `fishprint_YYYY_MM_DD.md` in your current working directory.

## Output shape

```markdown
# Fishprint: AI agents — 2026-04-12

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

## Tools exposed

The plugin registers a `fishprint` MCP server with four tools the main agent and subagents share:

| Tool | Purpose |
|------|---------|
| `open(url)` | Playwright-backed page load; returns a DOM summary and a page ID. Up to 4 concurrent. |
| `capture({ id, selectors })` | Screenshot each selector on the open page, upload to Gyazo in parallel, return `{ captured, rejected }`. Elements taller than 600px or containing more than 1200 chars are rejected so the caller picks a narrower selector. |
| `close(id)` | Free the page's browser context. |
| `assemble({ sectionDir, output, title, preamble?, appendix? })` | Concatenate section files into a single Markdown file, with optional scope preamble and "also seen" appendix. |

## License

MIT
