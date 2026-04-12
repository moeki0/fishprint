---
name: go
description: Browse the web, collect quotes, and write a text-driven digest with citations. Use when asked for "news", "what's happening", "scrapbook", or to research a topic.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Task
  - mcp__scrapbook__*
  - Skill(scrapbook:write)
---

# Scrapbook — Web Research & Citation Digest

Arguments: `$ARGUMENTS`

## What Scrapbook does

1. Browse curation sites widely and **extract a list of distinct topics** — each topic may cite 1〜3 source URLs
2. **Spawn one Task (general-purpose subagent) per topic, in parallel.** Each subagent opens its sources, selects thesis sentences, captures translated screenshots ("魚拓"), and writes a section via `/scrapbook:write`
3. Concatenate all sections into a single Markdown digest via `assemble`

**Scaling principle:** The main agent only holds the topic list. All heavy context (DOMs, quotes, translations) lives inside subagents. One wave of ~8 topics per run is the default target.

**Output format: narrative text with translated-screenshot citations (魚拓), all in the user's language.** Each citation is a Gyazo-hosted screenshot of the original element with its text replaced by the translation — preserving the source's layout/typography while being readable in the user's language.

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

Choose a unique temp path for this run, e.g. `/tmp/scrapbook_<YYYYMMDD_HHMMSS>` or `/tmp/scrapbook_<random>`. **Remember it.** Pass it to every `/scrapbook:write` call and to `assemble`. No explicit setup needed — the write skill creates the dir when it saves `section_1.md`.

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
You are writing one section of a scrapbook digest about a specific topic.

Topic: <topic description>
Candidate source URLs: <url list>
sectionDir: <sectionDir>
Section number: <N>
Target language: <user's language>

Steps:
1. Call mcp__scrapbook__open on each candidate URL (in parallel) to read its content.
2. Read the full content of each. Identify which article(s) most authoritatively cover the topic — you may use 1 or several. Skip any that turn out to be off-topic or duplicates.
3. From each chosen article, pick 1〜3 *sentences* that carry the thesis — claims a reader would quote in a discussion. Skip headings, navigation, boilerplate, author bios, date stamps. Prefer:
   - The one-sentence claim that best summarizes the piece's argument
   - Concrete numbers, findings, quoted statements
   - Unexpected, counterintuitive, or opinionated lines
   Avoid: generic intros ("In recent years..."), TOC items, section titles.
   Identify the smallest element that wraps exactly that sentence (usually a specific `p`, sometimes `blockquote`/`li`). Use the `p`, not a sub-span — surrounding context helps.
4. For each chosen element, prepare a natural translation into <user's language> (not machine-translation style).
5. Call mcp__scrapbook__capture({ id, sections: [{ selector, translated }, ...] }) for each page to get Gyazo URLs of the translated screenshots.
6. Invoke /scrapbook:write with: article title (in <user's language>), the list of {image_url, translated_alt} pairs, the source URL(s), <user's language>, sectionDir=<sectionDir>, section number=<N>. /scrapbook:write saves section_<N>.md to sectionDir.
7. Call mcp__scrapbook__close on every page you opened.
8. Report back a single line: "section <N> written" (or "section <N> skipped: <reason>").

Constraints:
- Everything in <user's language>.
- Do NOT call assemble; the coordinator does that.
- Never use WebSearch or WebFetch — only mcp__scrapbook__open.
- On error for a URL, skip it and continue with the remaining URLs. If no URL works, report "skipped".
```

**Wave control.** Issue Tasks in groups of 8 per message. Wait for each wave to return before dispatching the next. Assign section numbers sequentially across all waves (1〜N). If a subagent reports "skipped", leave that section number as a gap — `assemble` will skip missing files.

### Phase 3: Assemble final digest — MANDATORY, DO NOT SKIP

Call the `assemble` MCP tool:

```
assemble({ sectionDir: "/tmp/scrapbook_...", output: "<ABSOLUTE_PATH>/scrapbook_YYYY_MM_DD.md", title: "Scrapbook: {theme} — {date}" })
```

This concatenates all section files in `sectionDir` (in numeric order), prepends the title as an `#` heading, saves to the output path, and cleans up `sectionDir`.

**`output` MUST be an absolute path.** The MCP server's working directory is its own install location, not the user's working directory — a relative path like `./scrapbook.md` will land in the plugin cache. Build the absolute path from the user's current working directory (the one shown at the top of your system context, e.g. `/Users/alice/wiki/scrapbook_YYYY_MM_DD.md`).

**Do not end the session without calling assemble.**

## Rules

- **For global/international topics, use English-language sources only**
- **Citations must be translated to the user's language** — translate quotes naturally, not machine-translation style
- **NEVER use WebSearch or WebFetch tools.** All browsing must go through the `open` MCP tool.
- **NEVER invoke Python, Node, or any programming language via Bash.** Bash is for simple commands (ls, mkdir) only.
- No duplicates
- On error, skip and move on
- If `$ARGUMENTS` is empty, cover whatever is interesting on major tech curation sites right now
