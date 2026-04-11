---
name: write
description: Generate a Markdown digest from captured 魚拓 screenshots. Called by /scrapbook:go after capture phase.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(ls *)
---

# /scrapbook:write — Generate Markdown digest

Arguments: `$ARGUMENTS` (output path, theme, date, language)

## What this does

Assemble captured 魚拓 screenshots into a dense, readable Markdown file. Each article gets a heading, its screenshots, links to referenced sources, and a link to the original.

## Flow

### 1. Parse arguments

Arguments are passed as key=value pairs or free text:
- `output`: file path (e.g. `scrapbook_2026_04_11.md`). `{{date}}` is replaced with `YYYY_MM_DD`.
- `theme`: the topic
- `lang`: language for headings and text
- `images`: directory or URL prefix where screenshots were saved
- `instructions`: any custom directives from scrapbook.json

### 2. Gather captured images

Use `ls` on the images directory (e.g. `./scrapbook_images/`) to list all captured screenshots. The caller should also provide context about which images belong to which article.

### 3. Write Markdown

Write the file using the `Write` tool. Structure:

```markdown
# Scrapbook: {theme} — {date}

## Article title (in user's language)

![](screenshot_1.png)

![](screenshot_2.png)

![](screenshot_3.png)

### Referenced: Paper or repo title

![](linked_source_screenshot.png)

→ [Primary source](https://arxiv.org/abs/...)

→ [Source](https://example.com/article)

---
```

## Rules for output

- `##` heading: article title in user's language
- Screenshots of translated page fragments (魚拓) — the screenshots themselves are already translated
- Link to original source article
- `---` between articles
- Dense layout — no unnecessary whitespace or commentary between screenshots
- If `instructions` from scrapbook.json are provided, follow them
