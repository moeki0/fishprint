---
name: go
description: Browse the web, collect quotes, and write a text-driven digest with citations. Use when asked for "news", "what's happening", "scrapbook", or to research a topic.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - mcp__scrapbook__*
  - Skill(scrapbook:write)
---

# Scrapbook — Web Research & Citation Digest

Arguments: `$ARGUMENTS`

## What Scrapbook does

1. Browse the web for a given theme/topic
2. For each article, read it, capture translated screenshots of key quotes ("魚拓"), and invoke `/scrapbook:write` to generate a section that embeds those images in place of blockquote citations
3. Concatenate all sections into a single Markdown digest

**Output format: narrative text with translated-screenshot citations (魚拓), all in the user's language.** Each citation is a Gyazo-hosted screenshot of the original element with its text replaced by the translation — preserving the source's layout/typography while being readable in the user's language.

**Language: detect the language the user used in `$ARGUMENTS` (or the conversation). Write everything in that language.**

## Sources

**Choose sources appropriate for the theme.** Do not rely on a fixed list — pick sources where the topic is actively discussed. Examples:

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

**Finding sources:** Use DuckDuckGo via `open("https://duckduckgo.com/?q=QUERY")` to discover good pages for any topic. Also try Wikipedia as a starting point and follow its references.

## Flow

### Phase 0: Reset — MANDATORY, DO NOT SKIP

Call `reset` to create a new session. It returns:

```json
{ "sessionId": "...", "sectionDir": "/tmp/scrapbook_..." }
```

**Remember both values.** Pass `sectionDir` to `/scrapbook:write` calls and `sessionId` to `assemble`.

### Phase 1: Browse & collect URLs

Use `open(url)` to browse sites. Read the DOM structure to find interesting posts and articles.

1. Choose as many sources as possible for the theme
2. Browse front pages and/or search for the theme
3. Follow links to source articles

Collect **as many candidate article URLs as possible** (20+).

### Phase 2: Read articles, capture 魚拓, generate sections

**Run everything in parallel.** Open pages, read content, capture translated screenshots, and generate sections concurrently:

1. Call `open(url)` for up to 4 articles in parallel — each returns a page ID
2. As each page loads, read its DOM structure and identify 1〜3 quote-worthy elements per article (specific `p`, `blockquote`, `li`, `h2` selectors). Prepare a natural translation for each into the user's language.
3. Call `capture({ id, sections: [{ selector, translated }, ...] })` for each page — returns an array of `{ selector, url }`. The Gyazo URL points to a screenshot of that element with its text replaced by the translation. Capture calls run in parallel with other pages.
4. Invoke `/scrapbook:write` for each article in parallel, passing the captured image URLs, `sectionDir`, and a unique section number — the write skill saves the section to `{sectionDir}/section_N.md`.
5. `close(id)` to free pages when done.

**Maximize concurrency.** open / capture / write calls all run in parallel since each article is independent.

### Phase 3: Assemble final digest — MANDATORY, DO NOT SKIP

Call the `assemble` MCP tool:

```
assemble({ sessionId: "...", output: "./scrapbook_YYYY_MM_DD.md", title: "Scrapbook: {theme} — {date}" })
```

This concatenates all section files in the session dir (in numeric order), prepends the title as an `#` heading, saves to the output path, and cleans up the session directory.

**Do not end the session without calling assemble.**

## Rules

- **For global/international topics, use English-language sources only**
- **Citations must be translated to the user's language** — translate quotes naturally, not machine-translation style
- **NEVER use WebSearch or WebFetch tools.** All browsing must go through the `open` MCP tool.
- **NEVER invoke Python, Node, or any programming language via Bash.** Bash is for simple commands (ls, mkdir) only.
- No duplicates
- On error, skip and move on
- If `$ARGUMENTS` is empty, cover whatever is interesting on major tech curation sites right now
