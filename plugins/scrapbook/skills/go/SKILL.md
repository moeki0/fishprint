---
name: go
description: Browse curated media (Hacker News, etc.), capture interesting text fragments as screenshots (魚拓) with translations. Use when asked for "news", "what's happening", "scrapbook", or to research a topic.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(mkdir *)
  - Bash(ls *)
  - mcp__scrapbook__*
---

# Scrapbook — Web 魚拓 with Translation

Arguments: `$ARGUMENTS`

## What Scrapbook does

1. Browse curated media sites for a given theme/topic
2. Pick the most interesting/noteworthy text fragments (phrases, paragraphs, headlines)
3. Screenshot each fragment (魚拓 / web archive snapshot)
4. Write a Markdown digest: each screenshot immediately followed by its Japanese translation

## Sources

Browse these curated media sites (in order of priority):

1. **Hacker News** — `https://news.ycombinator.com/`
   - Front page for general tech topics
   - Use `https://hn.algolia.com/?q=QUERY` for specific themes
   - Follow interesting links to their source articles
2. **Lobsters** — `https://lobste.rs/`
3. **Reddit** — relevant subreddits for the theme (e.g. `https://old.reddit.com/r/programming/`)
4. **Source articles** — follow links from aggregators to original blog posts, papers, news articles

**Do NOT use X/Twitter. Do NOT use web search APIs.** Browse the sites directly via Playwright (kiri_open).

## Output

- Default output: `scrapbook_{{date}}.md` (current directory)
- Default images: `local` (`./scrapbook_images/`)

If `./scrapbook.json` exists, read `output`, `images`, and `instructions` from it.

## Flow

### Phase 0: Load config (optional)

Check if `./scrapbook.json` exists. If it does, read `output`, `images`, and `instructions` from it.

### Phase 1: Browse curated media

Use `kiri_open` to browse the curated media sites listed above.

1. Start with Hacker News front page
2. If `$ARGUMENTS` specifies a theme, also search HN Algolia for that theme
3. Read the DOM structure returned by `kiri_open` to find interesting posts related to the theme
4. Follow links to source articles that look promising

Collect **at least 10-15 candidate links** before selecting.

### Phase 2: Select & Deep-read

Pick **5-8 of the most relevant/interesting articles** for the theme.

For each selected article:
1. `kiri_open(article_url)` — open and read the content
2. Identify the most interesting/important text fragments:
   - Key paragraphs that capture the main insight
   - Notable quotes or statements
   - Important technical details or findings

### Phase 3: Capture 魚拓

For each interesting text fragment:

1. Identify the CSS selector for the element containing the text
2. `kiri_capture([selector], localDir)` — screenshot the fragment
3. Note the text content for translation

**Aim for 1-3 captures per article, 10-20 total.**

### Phase 4: Generate Markdown

Write the Markdown yourself. Structure:

```markdown
# Scrapbook: {theme} — {date}

## Article title or topic

![](fragment_screenshot.png)

> 日本語訳: ここにスクリーンショットのテキストの日本語訳を書く。段落全体を翻訳する。

![](another_fragment.png)

> 日本語訳: 別の断片の翻訳。

→ [Source](https://example.com/article)

---
```

**Rules for output:**
- `##` heading: article title or topic label
- Screenshot of the text fragment (魚拓)
- **Immediately after each screenshot**: blockquote with `日本語訳:` followed by the full Japanese translation of the captured text
- Every captured fragment MUST have its translation directly below it — no exceptions
- Link to original source article
- `---` between articles

## Rules

- **Every screenshot must be immediately followed by its Japanese translation** — this is the core feature
- Translations are full paragraph translations, not summaries
- If the original text is already in Japanese, still include it as a blockquote (no `日本語訳:` prefix needed, just quote the text)
- Browse curated media sites directly — do NOT use web search APIs or X/Twitter
- Use Playwright via `kiri_open` / `kiri_capture` for all browsing and screenshots
- No duplicates
- On error (page won't load, element not found), skip and move on
- If `$ARGUMENTS` is empty, capture whatever is interesting on Hacker News front page right now
