---
name: capture
description: Open a web page, translate it, and capture small text-focused screenshots (魚拓) in bulk. Called by /scrapbook:go or directly.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - mcp__scrapbook__*
---

# /scrapbook:capture — Translated 魚拓

Arguments: `$ARGUMENTS` (URL and optional language code, e.g. `https://example.com/article ja`)

## What this does

Open a web page with Google Translate, then capture many small, text-focused screenshots (魚拓). Each capture = 1 paragraph, 1 quote, 1 comment. NOT full sections.

## Flow

### 1. Parse arguments

- First argument: URL to capture
- Second argument (optional): language code for translation (e.g. `ja`, `en`, `ko`). If omitted, no translation.

### 2. Open the page with translation

```
open(url, translate=LANG)
```

If no language code, open without translate: `open(url)`

### 3. Identify capture targets

Read the DOM structure returned by `open`. **Capture the smallest possible elements.** Each screenshot should contain only a few lines of text — one idea, one quote, one point.

Target individual text elements using **specific CSS selectors**:

- Single paragraphs: `p`, `p:nth-of-type(3)`, `article > p:first-of-type`
- Lists as a whole: `ul`, `ol` (keep the list together — do NOT split into individual `li`)
- Single blockquotes: `blockquote`
- Individual headings: `h1`, `h2`, `h3`
- Single code blocks: `pre`, `code`
- Individual comments: `.comment`, `.athing` (HN), `.comment__body` (Lobsters)

**NEVER use broad selectors like `div`, `section`, `article`, `main`.** These produce large screenshots that are hard to read. If an element is too big, target its children instead.

### 4. Capture 魚拓

```
capture([selector1, selector2, selector3, ...])
```

Pass as many selectors as possible in each call. **Aim for 5-10+ captures per page.**

### 5. Follow outbound links (1-hop expansion)

Look for outbound links to primary sources in the page content:
- Papers, preprints (arxiv, etc.)
- GitHub repositories (README, key code)
- Official documentation or announcements

For the most important ones:
1. `open(linked_url, translate=LANG)` — open the primary source translated
2. `capture(...)` — capture key fragments
3. Report these as sub-captures of the parent article

### 6. Return

Report all captured image paths/URLs back so the caller can assemble the Markdown.

## Rules

- **Each 魚拓 = small, text-focused, 1 topic** — individual paragraphs, quotes, comments. Never capture large containers
- **Capture massively** — more is always better. The user wants large amounts of information in small bites
- **Translate before capturing** — use `open(url, translate=LANG)` for pages not in the target language
- If the page is already in the target language, open without translate
- **NEVER invoke Python, Node, or any programming language via Bash.** Bash is for simple commands (ls, mkdir) only. Do not write or execute scripts.
- **If open returns only empty containers with no visible text content, the page failed to render (SPA issue). Skip it immediately** — do not attempt to capture empty containers
- On error (page won't load, element not found), skip and move on
