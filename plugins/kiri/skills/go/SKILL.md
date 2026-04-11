---
name: go
description: Collect information from the web on a given theme. Screenshots for highlights, text for summaries. Use when asked to "research", "summarize", "collect", or "look into" something.
user-invocable: true
allowed-tools:
  - WebSearch
  - WebFetch
  - Read
  - Write
  - Bash(mkdir *)
  - Bash(ls *)
  - mcp__kiri__*
  - mcp__claude-in-chrome__*
---

# Kiri — Clip highlights, summarize the rest

Arguments: `$ARGUMENTS`

## Philosophy

**Screenshots for highlights. Text for everything else.**

Kiri produces a digest. Important visuals (tweets, charts, hero images, key quotes) are captured as screenshots. Context and summaries are written as text. Translations are done in text, not injected into images.

- Screenshots: tweets, embedded images, charts, infographics, key UI elements
- Text: summaries, translations, context, commentary
- Embedded images in articles should always be captured
- Foreign content is translated as text alongside the screenshot

## Theme

Priority:
1. **If arguments are provided** → use as theme (e.g., `/kiri:go latest EV market trends`)
2. **If `./kiri.json` exists** → read theme, output, images from it
3. **Neither** → ask the user what they want

Defaults when using arguments only:
- `output`: `kiri_{{date}}.md` (current directory)
- `images`: `local` (`./kiri_images/`)

## kiri.json (optional)

For recurring themes, place a config file at project root.

```json
{
  "name": "Cat News",
  "theme": "Funny cat stories, viral videos, cat cafes, rescue cats",
  "output": "cat_news_{{date}}.md",
  "images": "local",
  "sources": ["web", "x"],
  "instructions": "Write in Japanese. Always capture cute cat photos."
}
```

- `images`: `"gyazo"` or `"local"`. Gyazo requires a token in the OS keychain
- `sources`: Array of sources. Default `["web"]`
  - `"web"` → WebSearch
  - `"x"` → Browse X Following timeline via Chrome (requires claude-in-chrome MCP)
- `instructions` → Custom directives applied to all phases

**If `./kiri.json` exists, always follow `instructions`.**

## Flow

### Phase 0: Load config

**First, check if `./kiri.json` exists.** If it does, read it with the Read tool and use its values for all subsequent phases. Pay special attention to:
- `theme` — overrides the argument
- `sources` — determines which sources to use in Phase 1. **Only use sources listed here.**
- `instructions` — must be followed in all phases

### Phase 1: Gather

**Only use the sources specified in `sources` config.** If `sources` is `["x"]`, do NOT use WebSearch. If `sources` is `["web"]`, do NOT browse X.

**If `"web"` is included (default):**
- **Always search in English first** — English sources are broader, more up-to-date, and cover more ground. Then search in the user's language for local perspectives
- Generate multiple search queries (different angles, synonyms, related terms)
- Use WebSearch
- Seek diverse sources (not just mainstream — blogs, specialist sites, social media too)

**If `"x"` is included (requires claude-in-chrome MCP):**

Collect from **two sources on X**:

**A. Following timeline:**
1. `tabs_context_mcp` to check current tabs
2. `navigate` to `https://x.com/home`, then click the "Following" tab via `javascript_tool`
3. **Incremental scroll collection** — X virtualizes the DOM (only ~5-7 tweets exist at a time). You MUST:
   a. Initialize a global collector: `window.__kiriTweets = {}`
   b. Run a loop: collect visible tweets into `__kiriTweets`, then `scrollBy(0, 800)` — small scroll to avoid skipping
   c. Each iteration is a **separate `javascript_tool` call** (NOT async/await in one call — it will timeout)
   d. Repeat 15-20 times to collect 30+ tweets
   e. After collection, read all results from `window.__kiriTweets`

**B. Explore / Trending:**
1. `navigate` to `https://x.com/explore/tabs/trending`
2. Use the same incremental scroll collection to gather trending tweets
3. Also check `https://x.com/explore/tabs/news` for news-related trending topics
4. Collect tweet URLs and text

5. Merge results from A and B, pick theme-related tweets and links

### Phase 2: Select

Pick the **3–5 most important** URLs/tweets. Judge by theme relevance.

Aim for diversity — don't pick items that all say the same thing.

### Phase 3: Research (per topic)

Research background for each topic to write informed summaries.

- **WebSearch** for related context
- **WebFetch** to read article text (no browser needed, fast)
- For tweets, check the full thread, quoted tweets, and replies

### Phase 4: Capture highlights

Use `kiri_open` and `kiri_capture` for visual highlights only. The browser stays alive between calls.

**What to capture as screenshots:**
- Tweets (the `article[data-testid="tweet"]` element)
- Embedded images and photos in articles (`img`, `figure`)
- Charts, graphs, infographics
- Key UI elements or product screenshots

**What NOT to capture — write as text instead:**
- Article titles → write as `## heading`
- Body text → summarize/translate as text
- Quotes → write as `> blockquote`

**For each page:**

1. Call `kiri_open(url)` — returns DOM structure. Use it to find image/figure/tweet selectors
2. Call `kiri_capture(selectors, localDir?)` — capture only visual elements
3. If selectors miss, adjust and call `kiri_capture` again

### Phase 5: Generate Markdown

**Do NOT call kiri_done for this.** Write the Markdown yourself, mixing text and captured images.

```markdown
## Topic title (written as text)

Summary of the topic in the user's language. 2-3 sentences of context.

![](captured_tweet.png)

> Key quote translated to user's language

![](chart_from_article.png)

Further explanation as needed.

→ [Source](original URL)

---

## Next topic

...
```

**Output rules:**
- Headings and summaries as text
- Screenshots for visual highlights (tweets, images, charts)
- Translate foreign text content in text, not in screenshots
- Actively capture all embedded images from articles
- `---` between topics
- Always include source link

## Rules

- No duplicates: don't clip the same topic from multiple sources
- Judge freshness by theme (breaking news → recent only; research → any time period)
- Translate faithfully. Don't summarize source quotes
- On error, skip and move on
- If Chrome is unavailable, fall back to WebSearch only
