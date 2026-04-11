---
name: write
description: Generate a text-driven Markdown digest with original-language citations. Called by /scrapbook:go after research phase.
user-invocable: true
allowed-tools:
  - Read
  - Write
---

# /scrapbook:write — Generate citation digest

Arguments: `$ARGUMENTS` (output path, theme, date, language, collected quotes)

## What this does

Write a text-driven article in the user's language, embedding translated citations from original sources as blockquotes. Both narrative and citations are in the user's language.

## Structure

```markdown
# Scrapbook: {theme} — {date}

## Topic or article title (in user's language)

Narrative text explaining the context and significance in the user's language.
What happened, why it matters, what the key points are.

> 原文から翻訳された引用。自然な訳文で、機械翻訳調にならないように。
>
> — Author/Source name

Further narrative connecting this quote to the next point.
Analysis, context, implications — all in the user's language.

> 論点を補強または対比する別の引用。
> 必要に応じて複数段落。
>
> — Author/Source name

### Sub-topic or referenced primary source

Narrative explaining what this source adds to the picture.

> 一次ソース（論文、公式ブログ等）からの引用
>
> — Source name

→ [Source](https://example.com/article)

---

## Next topic

...

---
```

## Rules for output

- **Everything in the user's language** — both narrative and citations.
- **Citations are translated blockquotes** — translate the original text naturally into the user's language. Include `— Author/Source` attribution.
- **Text drives the narrative, citations are evidence.** Never stack blockquotes without narrative text between them.
- Narrative text between citations should:
  - Contextualize why the citation matters
  - Connect it to the broader theme
  - Transition to the next point
- `##` heading: topic title in user's language
- `---` between major topics
- Link to original source at the end of each section
- **Include as many citations as possible** — the more evidence, the better
- **Embed important images from articles** (graphs, benchmark tables, architecture diagrams, charts) using their original URL: `![description](https://example.com/image.png)`. Only include images that add information text cannot convey. Do not embed logos, avatars, decorative images, or ads.
- If `instructions` from scrapbook.json are provided, follow them
