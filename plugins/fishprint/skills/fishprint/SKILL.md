---
name: fishprint
description: Browse the web, 魚拓 key sentences, and write a citation-driven topic digest. Use when asked for "news", "what's happening", "fishprint", or to research a topic.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Task
  - Bash
  - WebSearch
  - WebFetch
---

# Fishprint — Primary-source web research with 魚拓

Arguments: `$ARGUMENTS`

## What Fishprint does

1. Browse curation sites widely and **extract a list of distinct topics** — each topic may cite 1〜3 source URLs
2. **Spawn one Task (general-purpose subagent) per topic, in parallel.** Each subagent opens its sources, selects thesis sentences, captures translated screenshots ("魚拓"), and writes its own `section_N.md` directly via `Write`
3. Concatenate all sections into a single Markdown digest via the local Fishprint daemon `POST /assemble`

**Scaling principle:** The main agent only holds the topic list. All heavy context (DOMs, quotes, translations) lives inside subagents. One wave of ~8 topics per run is the default target.

**Output format: narrative text with 魚拓 (original-text screenshots) + a translated blockquote below each, all in the user's language.** The 魚拓 preserves the source page exactly as published (evidence). The translation lives under it as a readable blockquote so the reader gets both.

**Language: detect the language the user used in `$ARGUMENTS` (or the conversation). Write everything in that language.**

## Sources

**Primary discovery: Exa neural search.** Exa is biased toward primary sources (individual blogs, official posts, papers, Substack) and surfaces theme-aligned content rather than popularity-ranked aggregations. Use it first.

**When to prefer aggregators over Exa:** Exa is strongest for *theme-driven deep dives* — give it a topic, get primary sources. It is weaker for *realtime buzz* — "what is the crowd talking about right now," because that signal lives in human voting on HN / Reddit / Lobsters, not in the document index. If `$ARGUMENTS` reads like "今何が話題か" / "what's hot today" / a broad domain sweep with no specific theme, start with aggregators and use Exa to enrich. If it names a specific theme, start with Exa. Add `maxAgeHours: 24` (or smaller) on Exa calls to bias toward fresh content when the theme is time-sensitive.

```bash
curl -s -X POST https://api.exa.ai/search \
  -H "x-api-key: $EXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"<theme, in English for global topics>","type":"auto","numResults":15,"contents":{"highlights":{"maxCharacters":600}}}'
```

Tips:
- Translate the theme to English before querying for global/international topics — Exa's neural search tracks the query language, and English yields deeper primary sources.
- Use `type:"auto"` for most themes; `type:"deep"` if you want multi-step synthesis (slower, more expensive).
- Skim returned `title` + `highlights[0]` to pick ~8 strongest topics. Treat each result as a candidate topic with the URL as its source.

**Fallback when Exa is unavailable** (no `EXA_API_KEY`, API error, empty results, or topic too niche for neural search). Pick aggregators appropriate for the theme:

- **Tech general**: Hacker News (`news.ycombinator.com`, `hn.algolia.com/?q=QUERY`), Lobsters (`lobste.rs`)
- **AI/ML**: /r/MachineLearning, /r/LocalLLaMA, Papers With Code
- **Security**: /r/netsec, Krebs on Security
- **Design**: Designer News, /r/design
- **Science**: /r/science, Phys.org
- **Academic / Papers**: arXiv (`arxiv.org/list/{subject}/recent`), Semantic Scholar, Google Scholar, OpenReview
- **Any topic**: Reddit (`old.reddit.com/r/{topic}`) works as a universal curation layer
- **X/Twitter**: if curated sites link to tweets, follow and capture them (public tweets work without login)

**For global/international topics, use English-language sources only.** Only use non-English sources when the topic is specifically regional (e.g. Japanese domestic policy, local events).

**Finding more sources:** Use DuckDuckGo via daemon `POST /open` on `https://duckduckgo.com/?q=QUERY`. Also try Wikipedia as a starting point and follow its references.

## Flow

### Phase -1: Read existing digests to avoid duplicates

Before doing anything else, **scan the current working directory for existing Fishprint output files** using the `Read` tool on each `.md` file found with `Glob("**/*.md")`. Skim their headings (`##`) and source URLs to build a **seen-topics list** — a concise record of what has already been covered.

**Seen-topics list format** (keep in memory, never written to disk):
```
- "Anthropic releases Claude Code 2.5" (sources: anthropic.com/..., HN #...)
- "Berkeley RDI benchmark paper" (sources: rdi.berkeley.edu/...)
```

**This list is a hard exclusion filter for Phase 1.** In Phase 1, if a candidate topic matches something already in the seen-topics list — same product/paper/event, even if reported from a different angle — **discard it**. A topic "matches" if it concerns the same named entity, release, incident, or finding. Prefer fresh topics the reader has not seen before.

If no `.md` files exist in the current directory, skip this phase and proceed.

### Phase 0: Pick a sectionDir

Choose a unique temp path for this run, e.g. `/tmp/fishprint_<YYYYMMDD_HHMMSS>` or `/tmp/fishprint_<random>`. **Remember it.** Pass it to every subagent and to `assemble`. No explicit setup needed — subagents create the dir when they save `section_1.md`.

### Phase 0.5: Resolve time constraints (if any)

If `$ARGUMENTS` contains a temporal reference ("今日", "今週", "today", "this week", "this month", a specific date, etc.), **immediately convert it to an absolute date range** before doing anything else. Today's date is provided in your system context. Examples:

- "今日" / "today" → `2026-04-12` only
- "今週" / "this week" → `2026-04-06〜2026-04-12` (Mon–today)
- "今月" / "this month" → `2026-04-01〜2026-04-12`

**This range is a hard filter.** Carry it through all phases: only select topics published within the window, and pass it explicitly to every subagent so they can reject off-window articles.

### Phase 1: Discover candidate topics

**Step 1a — WebSearch first for disambiguation and framing.** Before any Exa call, run a single `WebSearch` on the theme as written. Purpose: (1) resolve ambiguity in proper nouns (e.g. "OpenClaw" — a 1997 game remake or a 2026 AI agent?), (2) anchor the current meaning of the term so the Exa query you craft next targets the right entity, (3) catch breaking-news angles that may not yet be well-indexed by Exa. Read titles + snippets only; do not deep-dive. One query is usually enough — two if the theme has clearly distinct meanings and you need to pick.

**Step 1b — Exa neural search (primary discovery).** With the disambiguated framing from 1a, issue 1〜3 Exa queries (varying angles on the theme) via the curl pattern above. Use specific entity names / qualifiers learned from 1a so neural search hits the right cluster. Skim `title` + `highlights` for each result. Each Exa result is itself a candidate topic — no aggregator browsing needed when results are good.

If `EXA_API_KEY` is unset, the call errors, or results are sparse / off-topic, **fall back** to aggregator sites: `open(url)` HN / Lobsters / Reddit / arXiv etc. and read their DOMs (titles, summaries, comments) for candidate topics. **Do not open individual articles yet** — that's the subagent's job.

**If a time constraint was resolved in Phase 0.5:** only include candidates whose publish date falls within that range. Discard anything outside it, even if it seems interesting.

**Fishprint daemon API.** Use `curl` via Bash against the already-running local daemon at `http://127.0.0.1:3847`:

```bash
curl -s http://127.0.0.1:3847/health
curl -s -X POST http://127.0.0.1:3847/open -H 'content-type: application/json' -d '{"url":"https://example.com"}'
curl -s -X POST http://127.0.0.1:3847/capture -H 'content-type: application/json' -d '{"id":"1","selectors":["article p:nth-of-type(4)"]}'
curl -s -X POST http://127.0.0.1:3847/close -H 'content-type: application/json' -d '{"id":"1"}'
```

If `/health` fails, tell the user to start it with `cd ~/Development/fishprint/plugins/fishprint && bun run daemon:install` (or foreground: `bun run daemon`).

**Keep a running log of what you actually surveyed** — Exa queries used, or curation pages visited (name + URL). You will include this in the digest preamble so the reader can see *what was surveyed* — anti-FOMO by showing the work.

Extract **candidate topics** — short descriptions of discrete news items / discussions / releases, each paired with 1〜3 source URLs. Collect more candidates than you will keep (e.g. ~15〜20). Deduplicate aggressively: two HN submissions about the same launch = one candidate topic.

From the candidates, **select the ~8 strongest as primary topics** — those with the most substance, biggest implications, or most interesting conversations. **Keep the rejected candidates** (title + URL + one-line reason) — they go into the appendix as "also seen".

Example candidate entries:

```
- topic: "Anthropic releases Claude Code 2.5 with agent SDK"
  urls: ["https://anthropic.com/news/...", "https://news.ycombinator.com/item?id=..."]
  selected: yes
- topic: "Berkeley RDI shows AI agent benchmarks are trivially gamed"
  urls: ["https://rdi.berkeley.edu/blog/..."]
  selected: yes
- topic: "Someone rewrote their blog in Zig"
  urls: ["https://example.com/..."]
  selected: no  (niche, low signal)
```

**Quantity rule: at least 8 selected.** If your first curation page only yields 3〜4 candidates, keep browsing additional sources until you have enough candidates to pick 8 strong ones from. But do not pad — if you genuinely exhausted sources and only 5 are strong, it's fine to ship 5. Fewer-deeper beats more-shallower.

Call daemon `POST /close` for curation pages before Phase 2 to free browser resources.

### Phase 2: Spawn one subagent per topic, in parallel

For each topic, spawn a **Task (general-purpose subagent)** via the `Task` tool. Subagents run **concurrently** — with ~8 topics, dispatch **all Tasks in a single message** for maximum parallelism. If the list exceeds ~10, wave them in groups of 8.

**Task prompt template** (self-contained — the subagent does not see this conversation):

```
You are writing one section of a Fishprint digest (a primary-source 魚拓 archive for the web) about a specific topic.

Topic: <topic description>
Candidate source URLs: <url list>
sectionDir: <sectionDir>          (e.g. /tmp/fishprint_xxx)
Section number: <N>
Target language: <user's language>
Time constraint: <absolute date range if specified, e.g. "2026-04-12 only" or "2026-04-06〜2026-04-12"; or "none">

Steps:
1. Call the Fishprint daemon `POST /open` on each candidate URL (parallel Bash/curl calls are fine) to read its content.
2. Read the full content of each. Identify which article(s) most authoritatively cover the topic — you may use 1 or several. Skip any that turn out to be off-topic or duplicates.
3. From each chosen article, pick 1〜3 *sentences* that carry the thesis — claims a reader would quote in a discussion. Skip headings, navigation, boilerplate, author bios, date stamps. Prefer:
   - The one-sentence claim that best summarizes the piece's argument
   - Concrete numbers, findings, quoted statements
   - Unexpected, counterintuitive, or opinionated lines
   Avoid: generic intros ("In recent years..."), TOC items, section titles.

   **Selector rules — critical for 魚拓 quality:**
   - Target ONE paragraph or list item, NOT a container. The element should visually be ~1〜6 lines tall.
   - Allowed tags: `p`, `blockquote`, `li`, `figcaption`, `h2`/`h3` (only if the heading itself is the quote).
   - FORBIDDEN tags: `div`, `section`, `article`, `main`, `aside`, `body`.
   - FORBIDDEN class patterns: anything that names a container — `entry-content`, `post-content`, `article-body`, `et_pb_*`, `prose`, `markdown-body`, `content`, `main`, etc.
   - If the article is on a platform (Medium, Substack, WordPress, Ghost, Notion), use `nth-of-type` or attribute selectors on `p` — e.g. `article p:nth-of-type(4)`, not the wrapping class.
   - When unsure between a narrow and a wide selector, pick the narrow one. capture rejects elements >600px tall or >1200 chars; better to get a clean rejection and retry than to ship a wall-of-text 魚拓.
4. Call the Fishprint daemon `POST /capture` with `{"id":"<page id>","selectors":[...]}` for each page. The daemon screenshots the ORIGINAL (untranslated) element and uploads to Gyazo. **Response shape**: `{ captured: [{selector, url, permalinkUrl}], rejected: [{selector, reason}] }`. `url` is the direct image URL (i.gyazo.com/...png) for embedding; `permalinkUrl` is the Gyazo page URL (gyazo.com/...) which must be written as a plain-text URL on its own line directly below the image so that pasting into Cosense embeds the Gyazo page. If any selector is rejected (too tall, too much text, or not found), pick a narrower alternative and call capture again for just those selectors. Do not fall back to a wider selector — go narrower.
5. For each captured quote, prepare a natural translation into <user's language> (not machine-translation style). The translation goes into the Markdown under the image, not into the image itself.
6. Compose the Markdown section yourself and save it directly with the `Write` tool to `<sectionDir>/section_<N>.md`.

   **Section format** (everything in <user's language> except the 魚拓 images themselves, which stay in the source language):

   ```markdown
   ## Topic title

   Narrative text explaining context and significance — what happened,
   why it matters, the key points. Connects the 魚拓 below together.

   ![Original-language quote, as shown on the page](https://i.gyazo.com/xxx.png)
   https://gyazo.com/xxx

   > 自然な訳文。機械翻訳調にならないように。

   More narrative that transitions to the next 魚拓.

   ![Another original quote](https://i.gyazo.com/yyy.png)
   https://gyazo.com/yyy

   > もう一つの訳文。

   Closing narrative if needed.

   **Sources:**
   - → [Source title 1](https://example.com/a)
   - → [Source title 2](https://example.com/b)
   ```

   (If there is only one source, a single `→ [Source](url)` line is fine instead of the list.)

   Rules for the section:
   - `##` heading = topic title in <user's language>.
   - Narrative text drives the flow; 魚拓 + translation pairs are evidence. NEVER stack two pairs back-to-back without narrative between them.
   - Use every image URL returned by `capture`. Each image MUST be followed immediately by the `permalinkUrl` on its own line as a plain-text URL (no Markdown link syntax — just the bare URL), then a `>` blockquote containing the translation of that quote.
   - The image `alt` text should briefly describe the original (e.g. the first few words of the original language), NOT the translation — the translation lives in the blockquote below.
   - **REQUIRED — visually central images:** If the article has a hero image that *is* the subject of the story (a cat photo for cat news, a product shot, a screenshot of a new UI, a photo of the person interviewed), you MUST embed it using its original URL: `![description](https://example.com/image.jpg)`. Do not omit the defining visual of a visual story. Also embed graphs, benchmark tables, and architecture diagrams when they convey information text alone cannot.
   - ALWAYS end the section with link(s) to the original source(s). Mandatory.

7. Call the Fishprint daemon `POST /close` on every page you opened.
8. Report back a single line: "section <N> written" (or "section <N> skipped: <reason>").

Constraints:
- Everything in <user's language>.
- Do NOT call assemble; the coordinator does that.
- Any URL you will *quote* (i.e. pass to capture) MUST be opened via daemon `POST /open` — capture only works on open pages. You may additionally use WebSearch / WebFetch for discovery, cross-referencing, or quick context checks where no screenshot is needed.
- On error for a URL, skip it and continue with the remaining URLs. If no URL works, report "skipped".
- **If Time constraint is not "none":** check the publish date of each article before using it. If the date is outside the specified range, skip the article entirely (do not quote from it, do not include it in sources). If all candidate URLs fall outside the range, report "section <N> skipped: no content within time constraint".
```

**Wave control.** If the topic list exceeds ~10, issue Tasks in groups of 8 per message. Wait for each wave to return before dispatching the next. Assign section numbers sequentially across all waves (1〜N). If a subagent reports "skipped", leave that section number as a gap — `assemble` will skip missing files.

### Phase 3: Assemble final digest — MANDATORY, DO NOT SKIP

Call the Fishprint daemon `POST /assemble` with `preamble` and `appendix`:

```bash
curl -s -X POST http://127.0.0.1:3847/assemble \
  -H 'content-type: application/json' \
  -d '{"sectionDir":"/tmp/fishprint_...","output":"<ABSOLUTE_PATH>/<filename>","preamble":"<see below>","appendix":"<see below>"}'
```

**Filename rules** — derive from the topic and date, in the user's language:
- Use the theme as the base: `AIエージェント_2026-04-12.md`, `cat_news_2026-04-12.md`, `Rust_async_2026-04-12.md`
- Sanitize: replace spaces with `_`, strip characters illegal on common filesystems (`/ \ : * ? " < > |`)
- If `$ARGUMENTS` is empty (no theme), use `fishprint_YYYY-MM-DD.md` as fallback
- Do **not** add a `title` — no heading appears inside the file

**Preamble** — write it in the user's language. Required. Include:

1. **A humble scope line.** One sentence that makes clear this is one curator's view, not a complete list. Example (JA): *"2026年4月12日、{theme}まわりで目に入ったトピック8件。網羅ではなく、今日の干し草の山から拾い上げた8本。"*  Example (EN): *"One curator's view of {theme} on 2026-04-12 — eight items lifted from today's haystack, not a complete index."*
2. **Sources surveyed.** Work log of what you actually queried — Exa queries used (verbatim), and any aggregator pages visited as fallback. This defuses "what else did you skip?" anxiety.

```markdown
> 2026-04-12、AIエージェントまわりで目に入った8件。網羅ではなく、今日の干し草の山から拾い上げた分。

**今日見た場所:**
- Exa: `"AI agent benchmarks gaming 2026"`, `"Claude Code agent SDK release"`
- [Hacker News front page](https://news.ycombinator.com/) (Exa結果の補完として)
```

**Appendix** — optional but strongly preferred. Format as a `## Also seen` (or localized equivalent) section listing the candidate topics you rejected in Phase 1. One line per item: title, source, and a one-line reason. This shows readers what *was* in your field of view but didn't make the cut — so FOMO doesn't have to guess.

```markdown
## Also seen (not selected)

- [Someone rewrote their blog in Zig](https://example.com/...) — niche, low signal
- [Yet another JS framework announced](https://example.com/...) — not substantively new
- [Reddit thread about IDE preferences](https://old.reddit.com/...) — opinion, no news
```

This concatenates all section files in `sectionDir` (in numeric order), prepends the preamble, appends the appendix, saves to the output path, and cleans up `sectionDir`.

**`output` MUST be an absolute path.** Build the absolute path from the user's current working directory (the one shown at the top of your system context, e.g. `/Users/alice/wiki/fishprint_YYYY_MM_DD.md`).

**Do not end the session without calling assemble.**

## Rules

- **For global/international topics, use English-language sources only**
- **Citations must be translated to the user's language** — translate quotes naturally, not machine-translation style
- **Prefer daemon `POST /open` for anything you will quote from** — capture requires a page opened via `open` to produce 魚拓. Use `WebSearch` / `WebFetch` freely for discovery, quick relevance checks, or to enrich context where no screenshot is needed.
- **Use Bash only for `curl` to the Fishprint daemon and simple commands (ls, mkdir). Do not invoke Python, Node, or other programming languages via Bash.**
- **Visually central images are mandatory.** If a story's subject is visual (an animal, a product, a UI, a person), the key image MUST appear in the section. Do not describe an image without showing it.
- **Time constraints are hard filters.** If `$ARGUMENTS` includes any temporal reference, convert to an absolute date range in Phase 0.5 and enforce it in every phase. Never include content outside the window.
- No duplicates
- On error, skip and move on
- If `$ARGUMENTS` is empty, cover whatever is interesting on major tech curation sites right now
