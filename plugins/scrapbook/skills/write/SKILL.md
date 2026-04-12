---
name: write
description: Generate one Markdown section for a single article with 魚拓 (translated screenshot) citations. Called by /scrapbook:go per article.
user-invocable: true
allowed-tools:
  - Read
  - Write
---

# /scrapbook:write — Generate one article section

Arguments: `$ARGUMENTS` (article content, captured image URLs with their translated text, source URL, language, sectionDir, section number)

## What this does

Write **one section** of a scrapbook digest for a single article. Save the section to `{sectionDir}/section_{N}.md`. The caller (`/scrapbook:go`) assembles all sections into the final file.

Citations are 魚拓 — Gyazo-hosted screenshots of the original element with its text already replaced by the translation. You receive the image URL and the translated text that was baked into it. Embed the image; use the translated text as the `alt` attribute for searchability.

## Output format

```markdown
## Article title (in user's language)

Narrative text explaining the context and significance.
What happened, why it matters, what the key points are.

![原文から翻訳された引用。自然な訳文で、機械翻訳調にならないように。](https://i.gyazo.com/xxx.png)

Further narrative connecting this to the next point.

![論点を補強または対比する別の引用。](https://i.gyazo.com/yyy.png)

### Sub-topic or referenced primary source

Narrative explaining what this source adds.

![一次ソース（論文、公式ブログ等）からの引用](https://i.gyazo.com/zzz.png)

→ [Source](https://example.com/article)
```

## Rules

- **Everything in the user's language** — narrative text and the translated text baked into each 魚拓.
- **Citations are 魚拓 images** — one `![alt](gyazo_url)` per quoted element. The `alt` text is the translated string that was injected into the element before the screenshot, so search/accessibility still works.
- **Text drives the narrative, 魚拓 are evidence.** Never stack images without narrative text between them.
- Narrative text between 魚拓 should:
  - Contextualize why the citation matters
  - Connect it to the broader theme
  - Transition to the next point
- **Include all 魚拓 URLs passed in.** Each represents an intentional quote.
- **Embed important article figures** (graphs, benchmark tables, architecture diagrams) using their original URL: `![description](https://example.com/image.png)`. Only include figures that add information text cannot convey.
- `##` heading: article title in user's language
- Link to original source at the end
- **NEVER invoke Python, Node, or any programming language via Bash.**
