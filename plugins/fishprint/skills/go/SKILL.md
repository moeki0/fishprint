---
name: go
description: Browse the web, 魚拓 key sentences, and write a citation-driven topic digest. Use when asked for "news", "what's happening", "fishprint", "scrapbook", or to research a topic.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Task
  - WebSearch
  - WebFetch
  - mcp__fishprint__*
---

# Fishprint — Primary-source web research with 魚拓

Arguments: `$ARGUMENTS`

## What Fishprint does

1. Browse curation sites widely and **extract a list of distinct topics** — each topic may cite 1〜3 source URLs
2. **Spawn one Task (general-purpose subagent) per topic, in parallel.** Each subagent opens its sources, selects thesis sentences, captures translated screenshots ("魚拓"), and writes its own `section_N.md` directly via `Write`
3. Concatenate all sections into a single Markdown digest via `assemble`

**Scaling principle:** The main agent only holds the topic list. All heavy context (DOMs, quotes, translations) lives inside subagents. One wave of ~8 topics per run is the default target.

**Output format: narrative text with 魚拓 (original-text screenshots) + a translated blockquote below each, all in the user's language.** The 魚拓 preserves the source page exactly as published (evidence). The translation lives under it as a readable blockquote so the reader gets both.

**Language: detect the language the user used in `$ARGUMENTS` (or the conversation). Write everything in that language.**

## Sources

**Choose sources appropriate for the theme.** Do not rely on a fixed list — pick sources where the topic is actively discussed. Examples:

- **Tech general**: Hacker News (`news.ycombinator.com`, `hn.algolia.com/?q=QUERY`), Lobsters (`lobste.rs`)
- **AI/ML**: /r/MachineLearning, /r/LocalLLaMA, Papers With Code
- **Security**: /r/netsec, Krebs on Security
- **Design**: Designer News, /r/design
- **Science**: /r/science, Phys.org
- **Academic / Papers**: arXiv (`arxiv.org/list/{subject}/recent`), Semantic Scholar (`semanticscholar.org`), Google Scholar (`scholar.google.com`), Papers With Code, ACM Digital Library, OpenReview (`openreview.net`)
- **Programming languages**: respective community forums, Weekly newsletters
- **Any topic**: Reddit (`old.reddit.com/r/{topic}`) works as a universal curation layer
- **X/Twitter**: if curated sites link to tweets, follow and capture them (public tweets work without login)

**For global/international topics, use English-language sources only.** English sources have the highest volume, fastest updates, and best coverage for tech, science, AI, security, etc. Only use non-English sources when the topic is specifically regional (e.g. Japanese domestic policy, local events).

**Finding sources:** Use DuckDuckGo via `open("https://duckduckgo.com/?q=QUERY")` to discover good pages for any topic. Also try Wikipedia as a starting point and follow its references.

## Flow

### Phase 0: Pick a sectionDir

Choose a unique temp path for this run, e.g. `/tmp/fishprint_<YYYYMMDD_HHMMSS>` or `/tmp/fishprint_<random>`. **Remember it.** Pass it to every subagent and to `assemble`. No explicit setup needed — subagents create the dir when they save `section_1.md`.

### Phase 1: Browse curation sites & extract topic list

Use `open(url)` to browse curation sites widely. Read the DOM structure (titles, summaries, comments) to understand what conversations are happening. **Do not open individual articles yet** — that's the subagent's job.

Extract a list of **distinct topics** — each topic is a short description of one discrete news item / discussion / release, paired with 1〜3 candidate source URLs that cover it. **Target: at least 8 topics, up to ~12.** If your first source only yields 3〜4, keep browsing additional sources until you reach 8. Do not proceed to Phase 2 with fewer than 8 topics unless you have genuinely exhausted the relevant sources. Deduplicate aggressively: two HN submissions about the same launch = one topic.

Example topic entries:

```
- topic: "Anthropic releases Claude Code 2.5 with agent SDK"
  urls: [https://anthropic.com/news/...", "https://news.ycombinator.com/item?id=..."]
- topic: "Berkeley RDI shows AI agent benchmarks are trivially gamed"
  urls: ["https://rdi.berkeley.edu/blog/..."]
```

`close(id)` curation pages before Phase 2 to free browser resources.

### Phase 2: Spawn one subagent per topic, in parallel

For each topic, spawn a **Task (general-purpose subagent)** via the `Task` tool. Subagents run **concurrently** — with ~8 topics, dispatch **all Tasks in a single message** for maximum parallelism. If the list exceeds ~10, wave them in groups of 8.

**Task prompt template** (self-contained — the subagent does not see this conversation):

```
You are writing one section of a Fishprint digest (a primary-source scrapbook for the web) about a specific topic.

Topic: <topic description>
Candidate source URLs: <url list>
sectionDir: <sectionDir>          (e.g. /tmp/fishprint_xxx)
Section number: <N>
Target language: <user's language>

Steps:
1. Call mcp__fishprint__open on each candidate URL (in parallel) to read its content.
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
4. Call mcp__fishprint__capture({ id, selectors: [selector1, selector2, ...] }) for each page. The server screenshots the ORIGINAL (untranslated) element and uploads to Gyazo. **Response shape**: `{ captured: [{selector, url}], rejected: [{selector, reason}] }`. If any selector is rejected (too tall, too much text, or not found), pick a narrower alternative and call capture again for just those selectors. Do not fall back to a wider selector — go narrower.
5. For each captured quote, prepare a natural translation into <user's language> (not machine-translation style). The translation goes into the Markdown under the image, not into the image itself.
6. Compose the Markdown section yourself and save it directly with the `Write` tool to `<sectionDir>/section_<N>.md`.

   **Section format** (everything in <user's language> except the 魚拓 images themselves, which stay in the source language):

   ```markdown
   ## Topic title

   Narrative text explaining context and significance — what happened,
   why it matters, the key points. Connects the 魚拓 below together.

   ![Original-language quote, as shown on the page](https://i.gyazo.com/xxx.png)

   > 自然な訳文。機械翻訳調にならないように。

   More narrative that transitions to the next 魚拓.

   ![Another original quote](https://i.gyazo.com/yyy.png)

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
   - Use every image URL returned by `capture`. Each MUST be followed immediately by a `>` blockquote containing the translation of that quote.
   - The image `alt` text should briefly describe the original (e.g. the first few words of the original language), NOT the translation — the translation lives in the blockquote below.
   - You may additionally embed important article figures (graphs, benchmark tables, architecture diagrams) using their original URLs: `![description](https://example.com/figure.png)`. Only include figures that add information text cannot convey.
   - ALWAYS end the section with link(s) to the original source(s). Mandatory.

7. Call mcp__fishprint__close on every page you opened.
8. Report back a single line: "section <N> written" (or "section <N> skipped: <reason>").

Constraints:
- Everything in <user's language>.
- Do NOT call assemble; the coordinator does that.
- Any URL you will *quote* (i.e. pass to capture) MUST be opened via mcp__fishprint__open — capture only works on open pages. You may additionally use WebSearch / WebFetch for discovery, cross-referencing, or quick context checks where no screenshot is needed.
- On error for a URL, skip it and continue with the remaining URLs. If no URL works, report "skipped".
```

**Wave control.** If the topic list exceeds ~10, issue Tasks in groups of 8 per message. Wait for each wave to return before dispatching the next. Assign section numbers sequentially across all waves (1〜N). If a subagent reports "skipped", leave that section number as a gap — `assemble` will skip missing files.

### Phase 3: Assemble final digest — MANDATORY, DO NOT SKIP

Call the `assemble` MCP tool:

```
assemble({ sectionDir: "/tmp/fishprint_...", output: "<ABSOLUTE_PATH>/fishprint_YYYY_MM_DD.md", title: "Fishprint: {theme} — {date}" })
```

This concatenates all section files in `sectionDir` (in numeric order), prepends the title as an `#` heading, saves to the output path, and cleans up `sectionDir`.

**`output` MUST be an absolute path.** The MCP server's working directory is its own install location, not the user's working directory — a relative path like `./fishprint.md` will land in the plugin cache. Build the absolute path from the user's current working directory (the one shown at the top of your system context, e.g. `/Users/alice/wiki/fishprint_YYYY_MM_DD.md`).

**Do not end the session without calling assemble.**

## Rules

- **For global/international topics, use English-language sources only**
- **Citations must be translated to the user's language** — translate quotes naturally, not machine-translation style
- **Prefer `open` for anything you will quote from** — capture requires a page opened via `open` to produce 魚拓. Use `WebSearch` / `WebFetch` freely for discovery, quick relevance checks, or to enrich context where a screenshot is not needed.
- **NEVER invoke Python, Node, or any programming language via Bash.** Bash is for simple commands (ls, mkdir) only.
- No duplicates
- On error, skip and move on
- If `$ARGUMENTS` is empty, cover whatever is interesting on major tech curation sites right now
