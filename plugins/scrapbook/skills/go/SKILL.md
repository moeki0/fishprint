---
name: go
description: Browse curated media (Hacker News, etc.), capture translated screenshots (魚拓) in bulk. Use when asked for "news", "what's happening", "scrapbook", or to research a topic.
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
2. Open source articles **with Google Translate** (`open(url, translate=LANG)`) so the page itself is translated to the user's language
3. Screenshot translated fragments in bulk (魚拓)
4. Write a dense Markdown digest with translated screenshots

**Goal: produce a single page packed with information. Quantity matters. Capture aggressively.**

**Language: detect the language the user used in `$ARGUMENTS` (or the conversation). Use that language code for `translate` and for all text output (headings, transcriptions, etc.).**

## Sources

**Choose curated media sites appropriate for the theme.** Do not rely on a fixed list — pick sources where the topic is actively discussed. Examples:

- **Tech general**: Hacker News (`news.ycombinator.com`, `hn.algolia.com/?q=QUERY`), Lobsters (`lobste.rs`)
- **AI/ML**: /r/MachineLearning, /r/LocalLLaMA, Papers With Code
- **Security**: /r/netsec, Krebs on Security
- **Design**: Designer News, /r/design
- **Science**: /r/science, Phys.org
- **Programming languages**: respective community forums, Weekly newsletters
- **Any topic**: Reddit (`old.reddit.com/r/{topic}`) works as a universal curation layer
- **X/Twitter**: if curated sites link to tweets, follow and capture them (public tweets work without login)

**Do NOT use web search APIs.** Browse the sites directly via Playwright (open).

## Output

- Default output: `scrapbook_{{date}}.md` (current directory)
- Default images: `local` (`./scrapbook_images/`)

If `./scrapbook.json` exists, read `output`, `images`, and `instructions` from it.

## Flow

### Phase 0: Load config (optional)

Check if `./scrapbook.json` exists. If it does, read `output`, `images`, and `instructions` from it.

### Phase 1: Browse curated media

Use `open` (without translate) to browse the index/listing pages.

1. Choose as many curated media sites as possible for the theme — the more sources, the better
2. Browse their front pages and/or search for the theme
3. Read the DOM structure returned by `open` to find interesting posts related to the theme
4. Follow links to source articles that look promising

Collect **as many candidate links as possible** (20+) before selecting. More sources = better coverage.

### Phase 2: Select & Deep-read with Translation

Pick **10-15 of the most relevant/interesting articles** for the theme.

For each selected article:
1. `open(article_url, translate=LANG)` — open the article **translated to Japanese via Google Translate**
2. Read the translated DOM structure to understand the content
3. Identify ALL important sections to capture — be generous, not selective:
   - Title and lead paragraph
   - Key arguments and insights
   - Code examples, diagrams, data
   - Notable quotes or conclusions
   - Comments/discussion highlights (on HN, Lobsters, Reddit)

### Phase 3: Capture 魚拓

For each article, capture multiple sections from the **translated** page:

1. Identify CSS selectors for each important section
2. `capture([selector1, selector2, ...])` — screenshot multiple elements at once

**Aim for 3-5 captures per article, 30-50+ total across all articles.**

### Phase 3.5: Follow outbound links (1-hop expansion)

While reading articles, look for outbound links to primary sources:
- Papers, preprints (arxiv, etc.)
- GitHub repositories (README, key code)
- Official documentation or announcements
- Data sources, benchmarks

For the most important ones:
1. `open(linked_url, translate=LANG)` — open the primary source translated
2. `capture(...)` — capture the key sections
3. In the final Markdown, nest these under the parent article as `###` subsections

### Phase 4: Generate Markdown

Write the Markdown yourself. Structure:

```markdown
# Scrapbook: {theme} — {date}

## Article title (in user's language)

![](translated_screenshot_1.png)

![](translated_screenshot_2.png)

![](translated_screenshot_3.png)

### Referenced: Paper or repo title

![](linked_source_screenshot.png)

→ [Primary source](https://arxiv.org/abs/...)

→ [Source](https://example.com/article)

---
```

**Rules for output:**
- `##` heading: article title in user's language
- Screenshots of translated page fragments (魚拓) — the screenshots themselves are already translated
- Link to original source article
- `---` between articles

## Rules

- **Translate pages before capturing** — use `open(url, translate=LANG)` for articles not in the user's language
- **Capture generously** — more is better. Aim for 30-50+ screenshots total. The user wants to consume large amounts of information
- If the original text is already in the user's language, capture without translate
- Browse curated media sites directly — do NOT use web search APIs
- Use Playwright via `open` / `capture` for all browsing and screenshots
- No duplicates
- On error (page won't load, element not found), skip and move on
- If `$ARGUMENTS` is empty, capture whatever is interesting on major tech curation sites right now
