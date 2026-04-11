---
name: write
description: Generate a Markdown digest from captured 魚拓 screenshots. Called by /scrapbook:go after capture phase.
user-invocable: true
allowed-tools:
  - Read
  - Write
---

# /scrapbook:write — Generate Markdown digest

Arguments: `$ARGUMENTS` (output path, theme, date, language)

## What this does

Write a text-driven article that weaves 魚拓 screenshots into the narrative as evidence. The text tells the story; the screenshots prove it.

## Flow

### 1. Parse arguments

Arguments are passed as key=value pairs or free text:
- `output`: file path (e.g. `scrapbook_2026_04_11.md`). `{{date}}` is replaced with `YYYY_MM_DD`.
- `theme`: the topic
- `lang`: language for headings and text
- `images`: directory or URL prefix where screenshots were saved
- `instructions`: any custom directives from scrapbook.json

### 2. Gather captured images

Use `ls` on the images directory (e.g. `./scrapbook_images/`) to list all captured screenshots. The caller should also provide context about which images belong to which article and what each screenshot contains.

### 3. Write Markdown

Write the file using the `Write` tool. **The output is a text-driven article, not an image gallery.** Text and screenshots alternate — text explains, screenshots prove.

```markdown
# Scrapbook: {theme} — {date}

## Article title

This article argues that LLM agents need better memory systems.
The author identifies three main failure modes:

![](screenshot_temporal_error.png)

The first is temporal errors — LLMs struggle with time-series reasoning,
often confusing the order of events. The author gives a concrete example
from their production system where an agent "remembered" a meeting
that hadn't happened yet.

![](screenshot_priority_error.png)

Second, priority miscalibration. Early in a session, agents can't tell
what matters. They save trivial details and miss critical context.
This gets worse as memory accumulates.

![](screenshot_factual_error.png)

Third, plain factual errors. The author found that Claude Code's memory
summaries exhibited all three failure types, and proposes a hybrid
approach using structured metadata alongside free-text memory.

→ [Source](https://example.com/article)

---

## Next article title

The discussion picks up from a different angle...

![](screenshot_hn_comment.png)

A top HN commenter pushes back on the premise, pointing out that...

![](screenshot_counterpoint.png)

...

→ [Source](https://news.ycombinator.com/item?id=...)

---
```

## Rules for output

- **Text drives the narrative, screenshots are evidence.** Never put screenshots back-to-back without text between them.
- Write in the user's language. Explain what each screenshot shows and why it matters.
- Text between screenshots should:
  - Summarize or contextualize what the screenshot contains
  - Connect it to the broader argument or theme
  - Transition to the next point
- `##` heading: article title in user's language
- `---` between articles
- Link to original source at the end of each article section
- Include as many screenshots as possible — but always with connecting text
- If `instructions` from scrapbook.json are provided, follow them
