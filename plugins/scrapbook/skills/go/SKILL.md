---
name: go
description: Browse curated media (Hacker News, etc.), capture translated screenshots (魚拓) in bulk. Use when asked for "news", "what's happening", "scrapbook", or to research a topic.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - mcp__scrapbook__*
  - Skill(scrapbook:capture)
  - Skill(scrapbook:write)
---

# Scrapbook — Web 魚拓 with Translation

Arguments: `$ARGUMENTS`

## What Scrapbook does

1. Browse curated media sites for a given theme/topic
2. Collect candidate article URLs
3. Hand off to `/scrapbook:capture` to open, translate, and screenshot each article
4. Hand off to `/scrapbook:write` to generate the Markdown digest

**Goal: produce a single page packed with information. Quantity matters. Capture aggressively.**

**Language: detect the language the user used in `$ARGUMENTS` (or the conversation). Use that language code for all subsequent steps.**

## Sources

**Choose curated media sites appropriate for the theme.** Do not rely on a fixed list — pick sources where the topic is actively discussed. Examples:

- **Tech general**: Hacker News (`news.ycombinator.com`, `hn.algolia.com/?q=QUERY`), Lobsters (`lobste.rs`)
- **AI/ML**: /r/MachineLearning, /r/LocalLLaMA, Papers With Code
- **Security**: /r/netsec, Krebs on Security
- **Design**: Designer News, /r/design
- **Science**: /r/science, Phys.org
- **Academic / Papers**: arXiv (`arxiv.org/list/{subject}/recent`), Semantic Scholar (`semanticscholar.org`), Google Scholar (`scholar.google.com`), Papers With Code, ACM Digital Library, OpenReview (`openreview.net`)
- **Programming languages**: respective community forums, Weekly newsletters
- **Any topic**: Reddit (`old.reddit.com/r/{topic}`) works as a universal curation layer
- **X/Twitter**: if curated sites link to tweets, follow and capture them (public tweets work without login)

**For global/international topics, use English-language sources only.** English sources have the highest volume, fastest updates, and best coverage for tech, science, AI, security, etc. Only use non-English sources when the topic is specifically regional (e.g. Japanese domestic policy, local events).

**Finding sources:** Use DuckDuckGo via Playwright to discover good pages for any topic. Open `https://duckduckgo.com/?q=QUERY` with `open`, read the results, and follow links to quality sources. This works for any theme — not just tech. Also try Wikipedia as a starting point and follow its references for well-sourced material.

## Flow

### Phase 0: Load config and init — MANDATORY, DO NOT SKIP

**You MUST do all of the following before anything else:**

1. Use the `Read` tool to read `./scrapbook.json`. This file controls image storage and output settings.
2. Call `init` with the settings from scrapbook.json:
   - `init({ images: "gyazo" })` if scrapbook.json has `"images": "gyazo"`
   - `init({ images: "local" })` otherwise
3. Remember `output`, `instructions`, and `images` from scrapbook.json for later phases.

If `./scrapbook.json` does not exist, call `init({ images: "local" })` with defaults.

**Do NOT proceed to Phase 1 without completing Phase 0.**

### Phase 1: Browse curated media

Use `open` (without translate) to browse the index/listing pages.

1. Choose as many curated media sites as possible for the theme — the more sources, the better
2. Browse their front pages and/or search for the theme
3. Read the DOM structure returned by `open` to find interesting posts related to the theme
4. Follow links to source articles that look promising

Collect **as many candidate article URLs as possible** (20+) before proceeding. More sources = better coverage.

### Phase 2: Capture

For each candidate article, invoke `/scrapbook:capture` with the article URL and language code. The capture skill handles opening, translating, and screenshotting.

### Phase 3: Write

Invoke `/scrapbook:write` with the output path, theme, date, language, images directory, and any instructions from scrapbook.json. The write skill generates a **text-driven article** where screenshots and prose alternate — text explains the narrative, screenshots serve as evidence.

## Rules

- **For global/international topics, use English-language sources only**
- Browse curated media sites directly — do NOT use web search APIs
- **NEVER invoke Python, Node, or any programming language via Bash.** Bash is for simple commands (ls, mkdir) only. Do not write or execute scripts.
- No duplicates
- On error, skip and move on
- If `$ARGUMENTS` is empty, capture whatever is interesting on major tech curation sites right now
