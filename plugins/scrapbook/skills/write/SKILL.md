---
name: write
description: Generate one Markdown section for a single article with translated citations. Called by /scrapbook:go per article.
user-invocable: true
allowed-tools:
  - Read
  - Write
---

# /scrapbook:write — Generate one article section

Arguments: `$ARGUMENTS` (article content, quotes, source URL, language)

## What this does

Write **one section** of a scrapbook digest for a single article. Returns Markdown text with narrative and translated blockquote citations. The caller assembles multiple sections into the final file.

## Output format

```markdown
## Article title (in user's language)

Narrative text explaining the context and significance.
What happened, why it matters, what the key points are.

> 原文から翻訳された引用。自然な訳文で、機械翻訳調にならないように。
>
> — Author/Source name

Further narrative connecting this to the next point.

> 論点を補強または対比する別の引用。
> 必要に応じて複数段落。
>
> — Author/Source name

### Sub-topic or referenced primary source

Narrative explaining what this source adds.

> 一次ソース（論文、公式ブログ等）からの引用
>
> — Source name

→ [Source](https://example.com/article)
```

## Rules

- **Everything in the user's language** — both narrative and citations.
- **Citations are translated blockquotes** — translate the original text naturally into the user's language. Include `— Author/Source` attribution.
- **Text drives the narrative, citations are evidence.** Never stack blockquotes without narrative text between them.
- Narrative text between citations should:
  - Contextualize why the citation matters
  - Connect it to the broader theme
  - Transition to the next point
- **Include as many citations as possible** — the more evidence, the better. Be thorough and detailed.
- **Embed important images from articles** (graphs, benchmark tables, architecture diagrams, charts) using their original URL: `![description](https://example.com/image.png)`. Only include images that add information text cannot convey.
- `##` heading: article title in user's language
- Link to original source at the end
- If `instructions` from scrapbook.json are provided, follow them
- **NEVER invoke Python, Node, or any programming language via Bash.**
