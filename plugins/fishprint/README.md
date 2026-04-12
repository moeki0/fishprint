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
npm install -g fishprint
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

No MCP server. Subagents use **agent-browser** CLI for browser automation and **html2canvas** (injected via eval) for element-level screenshots. Gyazo uploads go through `bin/gyazo-upload.sh`.

## License

MIT
