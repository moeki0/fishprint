---
name: go
description: Browse the web, collect quotes, and write a text-driven digest with original-language citations. Use when asked for "news", "what's happening", "scrapbook", or to research a topic.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - mcp__scrapbook__*
  - Skill(scrapbook:write)
---

# Scrapbook — Web Research & Citation Digest

Arguments: `$ARGUMENTS`

## What Scrapbook does

1. Browse curated media sites and the web for a given theme/topic
2. Read articles, extract important quotes verbatim
3. Hand off to `/scrapbook:write` to generate a text-driven Markdown digest

**Output format: narrative text in the user's language, with blockquote citations translated to the user's language (魚拓).** No screenshots, no images.

**Language: detect the language the user used in `$ARGUMENTS` (or the conversation). Write everything — narrative and citations — in that language.**

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

### Phase 0: Load config — MANDATORY, DO NOT SKIP

**You MUST do the following before anything else:**

1. Use the `Read` tool to read the file `scrapbook.json` **in the user's working directory** (the project root where Claude Code was launched). This is the same directory shown in `git status`. Do NOT look in plugin directories or subdirectories.
2. Remember `output` and `instructions` from scrapbook.json for later.

If `scrapbook.json` does not exist, use defaults (`output`: `scrapbook_{{date}}.md`).

**Do NOT proceed to Phase 1 without completing Phase 0.**

### Phase 1: Browse & collect

Use `open(url)` to browse sites. Read the DOM structure to find interesting posts and articles.

1. Choose as many sources as possible for the theme
2. Browse front pages and/or search for the theme
3. Follow links to source articles

Collect **as many candidate article URLs as possible** (20+).

### Phase 2: Read & extract quotes

For each interesting article, use `open(url)` to read the full content.

Extract **verbatim quotes** from the original text — the exact words as written. These are the 魚拓 (citations). Collect:
- Key arguments and insights
- Notable statements and conclusions
- Data, numbers, benchmarks
- Community comments and reactions (on HN, Lobsters, Reddit)
- **Important image URLs** (graphs, charts, diagrams, benchmark tables) — note the `src` from `img` tags in the DOM

**Also follow outbound links** to primary sources (papers, repos, official docs) and extract quotes from those too.

### Phase 3: Write

Invoke `/scrapbook:write` with the collected quotes and source URLs. The write skill generates the final Markdown.

## Rules

- **For global/international topics, use English-language sources only**
- **Citations must be translated to the user's language** — translate quotes naturally, not machine-translation style
- **NEVER use WebSearch or WebFetch tools.** All browsing must go through the `open` MCP tool.
- **NEVER invoke Python, Node, or any programming language via Bash.** Bash is for simple commands (ls, mkdir) only.
- No duplicates
- On error, skip and move on
- If `$ARGUMENTS` is empty, cover whatever is interesting on major tech curation sites right now
