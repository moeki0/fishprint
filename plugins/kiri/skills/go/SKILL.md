---
name: go
description: Collect information from the web on a given theme and generate a scrapbook with translated screenshots. Use when asked to "research", "summarize", "collect", or "look into" something.
user-invocable: true
allowed-tools:
  - WebSearch
  - Read
  - Write
  - Bash(kiri-capture *)
  - Bash(kiri-ocr *)
  - Bash(mkdir *)
  - Bash(ls *)
  - Bash(head *)
  - Write(/tmp/*)
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

### Phase 1: Gather

Search **broadly** based on the theme. Don't stop at one query — vary angles, languages, and source types.

Behave according to `sources` config.

**If `"web"` is included (default):**
- Generate multiple search queries from the theme (different angles, both English and the user's language)
- Use WebSearch
- Seek diverse sources (not just mainstream — blogs, specialist sites, social media too)

**If `"x"` is included (requires claude-in-chrome MCP):**
1. `tabs_context_mcp` to check current tabs
2. `tabs_create_mcp` to open `https://x.com/home`
3. `javascript_tool` to extract tweet URLs and text
4. Pick theme-related tweets and links
5. Scroll for more if needed

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

Claude Code decides selectors and translations based on page content. Aim for 5–10 clippings per page.

**For speed: read all pages first with WebFetch (parallel), then batch capture all at once.**

**Step 1: Read all pages**

Use **WebFetch** for each URL to get text content. Call multiple WebFetch in parallel — no browser needed, fast.

**Step 2: Write translation JSON (use the Write tool, not cat)**

Use the Write tool to create `/tmp/sections.json`. **Be generous with clippings.**

```json
[
  { "selector": "h1", "translated": "Translated title" },
  { "selector": "article p:nth-of-type(1)", "translated": "Translated lead" },
  { "selector": "article p:nth-of-type(2)", "translated": "Translated paragraph 2" },
  { "selector": "article p:nth-of-type(3)", "translated": "Translated paragraph 3" },
  { "selector": "article p:nth-of-type(4)", "translated": "Translated paragraph 4" },
  { "selector": "figure:nth-of-type(1)", "translated": "" },
  { "selector": "figure:nth-of-type(2)", "translated": "" },
  { "selector": "article img:nth-of-type(1)", "translated": "" },
  { "selector": "article img:nth-of-type(2)", "translated": "" },
  { "selector": "blockquote", "translated": "Translated quote" },
  { "selector": "table", "translated": "" }
]
```
- Empty `translated` → no translation injection (clip as-is, good for images/tables)
- `capture: false` → inject translation but don't screenshot (e.g., translate tweet text, screenshot the tweet article)
- If the page is already in the target language, no translation needed — just clip

**Step 3: Capture**

**Prefer batch mode** — process all URLs with a single browser launch.

Write all pages' sections to a single batch JSON with the Write tool:
```json
[
  { "url": "https://...", "sections": [ { "selector": "h1", "translated": "..." }, ... ] },
  { "url": "https://...", "sections": [ { "selector": "h1", "translated": "..." }, ... ] }
]
```

```bash
kiri-capture /tmp/batch.json --local <output_dir>
```

Single URL mode also works:
```bash
kiri-capture "<url>" /tmp/sections.json --local <output_dir>
```

→ All pages are captured in parallel with one browser. Returns image URLs or local paths.

**Step 4: OCR translation overlay (when needed)**

For charts or figures with text in a foreign language:
```bash
kiri-ocr <image_path>
```
→ Returns OCR results with bounding boxes. Create translation JSON and apply overlay:
```bash
kiri-ocr <image_path> /tmp/translations.json
```

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

- **Never chain Bash commands with `&&` or `|`.** Call them one at a time so permission patterns match
- No duplicates: don't clip the same topic from multiple sources
- Judge freshness by theme (breaking news → recent only; research → any time period)
- Translate faithfully. Don't summarize
- On error, skip and move on
- If Chrome is unavailable, fall back to WebSearch only
