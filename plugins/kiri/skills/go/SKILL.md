---
name: go
description: Collect information from the web on a given theme and generate a scrapbook with translated screenshots. Use when asked to "research", "summarize", "collect", or "look into" something.
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

# Kiri — Clip, translate, and compile web content

Arguments: `$ARGUMENTS`

## Philosophy

**Images are primary. Text is secondary.**

Kiri produces a scrapbook. It clips important parts of web pages as screenshots, injects translations, and arranges them so the reader gets the full feel of the original source.

- Clip generously. More is better
- Titles, body text, charts, figures, photos, tweets — clip everything as screenshots
- Translations are injected into the screenshots, so readers understand just by looking at the images
- Text commentary only when images alone can't convey necessary context — 1-2 lines max

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
  "instructions": "Write in Japanese. Always clip cute cat photos."
}
```

- `images`: `"gyazo"` or `"local"`. Gyazo requires a token in the OS keychain
- `sources`: Array of sources. Default `["web"]`
  - `"web"` → WebSearch
  - `"x"` → Browse X timeline via Chrome (requires claude-in-chrome MCP)
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

Browse the user's **Following timeline only**. X search is unreliable — don't use it.

1. `tabs_context_mcp` to check current tabs
2. `tabs_create_mcp` to open `https://x.com/home` (Following tab)
3. `javascript_tool` to extract tweet URLs and text
4. Pick theme-related tweets and links
5. Scroll down and extract more (repeat 3-5 times to get enough content)

### Phase 2: Select

Pick the **3–5 most important** URLs. Judge by theme relevance.

Aim for diversity — don't pick articles that all say the same thing from different angles.

### Phase 3: Research (per topic)

Research background for each topic. The goal is **not** to write long commentary — it's to decide **what to clip**.

- **WebSearch** for related context
- **WebFetch** to read article text (no browser needed, fast)
- For tweets, check the full thread, quoted tweets, and replies

### Phase 4: Capture

**This is the most important phase. Clip a lot.**

Use the MCP tools `kiri_open` and `kiri_capture`. The browser stays alive between calls — no restart cost.

**For each URL:**

**Step 1: Open the page**

Call `kiri_open(url, translate?)`.

- If the page is in a foreign language, set `translate` to the target language (e.g. `"ja"` for Japanese). **Google Translate auto-translates the entire page — no need to write translations manually.**
- If the page is already in the target language, omit `translate`

Returns:
- Page text content (already translated if `translate` was set)
- DOM structure hints (which elements exist: h1, p, img, figure, etc.)

Use these hints to decide selectors. No guessing.

**Step 2: Capture**

Call `kiri_capture(selectors, localDir?)`. Just pass CSS selectors — the page is already translated.

```json
{
  "selectors": [
    "h1",
    "article p:nth-of-type(1)",
    "article p:nth-of-type(2)",
    "article p:nth-of-type(3)",
    "figure:nth-of-type(1)",
    "article img:nth-of-type(1)",
    "article img:nth-of-type(2)",
    "blockquote"
  ],
  "localDir": "/path/to/kiri_images"
}
```

- **Be generous: 5-10 selectors per page**

**If selectors miss, adjust and call `kiri_capture` again** — the page is still open.

**Step 3: Move to the next URL**

Call `kiri_open(next_url)`. The previous page closes automatically. Repeat Step 1-2.

**Step 4: OCR translation overlay (when needed)**

For images with foreign-language text, call `kiri_ocr(imagePath)` to get text + bounding boxes, then call again with translations to create the overlay.

### Phase 5: Generate Markdown

Create a Markdown file at the output path. **Image-heavy. Minimal text.**

```markdown
![](title clipping)
![](lead paragraph clipping)
![](photo)
![](body text clipping)
![](chart)
Context note only if truly needed — one line
→ [Source](original URL)

---

![](next page title clipping)
![](photo)
![](body clipping)
→ [Source](original URL)
```

- **Don't write titles as text. Clip the title element as an image**
- Stack images. Let images tell the story
- Separate topics with `---`
- Text commentary only when images can't convey the context alone
- Always include source link

## Rules

- No duplicates: don't clip the same topic from multiple sources
- Judge freshness by theme (breaking news → recent only; research → any time period)
- Translate faithfully. Don't summarize
- On error, skip and move on
- If Chrome is unavailable, fall back to WebSearch only
