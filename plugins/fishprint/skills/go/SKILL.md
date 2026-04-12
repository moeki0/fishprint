---
name: go
description: Browse the web, 魚拓 key sentences, and write a citation-driven topic digest. Use when asked for "news", "what's happening", "fishprint", or to research a topic.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Task
  - WebSearch
  - Bash(~/.claude/plugins/cache/fishprint/*)
  - Bash(agent-browser *)
  - Bash(curl *)
  - Bash(security *)
  - Bash(secret-tool *)
  - Bash(base64 *)
  - Bash(printf *)
  - Bash(rm *)
  - Bash(mkdir *)
  - Bash(ls *)
---

# Fishprint — Primary-source web research with 魚拓

Arguments: `$ARGUMENTS`

## What Fishprint does

1. Browse curation sites widely and **extract a list of distinct topics** — each topic may cite 1〜3 source URLs
2. **Spawn one Task (general-purpose subagent) per topic, in parallel.** Each subagent opens its sources with agent-browser, selects thesis sentences, captures 魚拓 screenshots via html2canvas + Gyazo, and writes its own `section_N.md` directly via `Write`
3. Read all section files and assemble into a single Markdown digest

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
- **Academic / Papers**: arXiv (`arxiv.org/list/{subject}/recent`), Semantic Scholar, Papers With Code, OpenReview
- **Programming languages**: respective community forums, Weekly newsletters
- **Any topic**: Reddit (`old.reddit.com/r/{topic}`) works as a universal curation layer
- **X/Twitter**: if curated sites link to tweets, follow and capture them (public tweets work without login)

**For global/international topics, use English-language sources only.** Only use non-English sources when the topic is specifically regional (e.g. Japanese domestic policy, local events).

**Finding sources:** Use WebSearch or open DuckDuckGo with agent-browser (`agent-browser --session phase1 open "https://duckduckgo.com/?q=QUERY"`) to discover good pages for any topic.

## Flow

### Phase 0: Setup

Choose a unique temp path, e.g. `/tmp/fishprint_<YYYYMMDD_HHMMSS>`. **Remember it.** Pass it to every subagent. No explicit setup needed — subagents create the dir when they write their section file.

### Phase 0.5: Resolve time constraints (if any)

If `$ARGUMENTS` contains a temporal reference ("今日", "今週", "today", "this week", "this month", a specific date, etc.), **immediately convert it to an absolute date range** before doing anything else. Today's date is provided in your system context. Examples:

- "今日" / "today" → `2026-04-12` only
- "今週" / "this week" → `2026-04-06〜2026-04-12` (Mon–today)
- "今月" / "this month" → `2026-04-01〜2026-04-12`

**This range is a hard filter.** Carry it through all phases: only select topics published within the window, and pass it explicitly to every subagent so they can reject off-window articles.

### Phase 1: Browse curation sites & extract topic list

Use agent-browser to open curation sites and read their content. Open multiple pages in parallel, snapshot each, then close before Phase 2.

```bash
# Open pages in parallel (run all at once)
agent-browser --session phase1 open https://news.ycombinator.com/ &
agent-browser --session phase1 open https://lobste.rs/ &
wait

# Read content
agent-browser --session phase1 snapshot

# Close when done with Phase 1
agent-browser --session phase1 close
```

**Do not open individual articles yet** — that's the subagent's job.

**If a time constraint was resolved in Phase 0.5:** only include candidates whose publish date falls within that range. Discard anything outside it, even if it seems interesting.

**Keep a running log of the curation pages you visited** (name + URL). You will include this in the digest preamble so the reader can see *what was surveyed* — anti-FOMO by showing the work.

Extract **candidate topics** — short descriptions of discrete news items / discussions / releases, each paired with 1〜3 source URLs. Collect more candidates than you will keep (e.g. ~15〜20). Deduplicate aggressively: two HN submissions about the same launch = one candidate topic.

From the candidates, **select the ~8 strongest as primary topics** — those with the most substance, biggest implications, or most interesting conversations. **Keep the rejected candidates** (title + URL + one-line reason) — they go into the appendix as "also seen".

**Quantity rule: at least 8 selected.** If your first curation page only yields 3〜4 candidates, keep browsing additional sources until you have enough. Fewer-deeper beats more-shallower.

### Phase 2: Spawn one subagent per topic, in parallel

For each topic, spawn a **Task** via the `Task` tool, using the `fishprint-worker` agent. Subagents run **concurrently** — with ~8 topics, dispatch **all Tasks in a single message** for maximum parallelism. If the list exceeds ~10, wave them in groups of 8.

**Task prompt template** (self-contained — the subagent does not see this conversation):

```
You are writing one section of a Fishprint digest (a primary-source 魚拓 archive for the web) about a specific topic.

Topic: <topic description>
Candidate source URLs: <url list>
sectionDir: <sectionDir>          (e.g. /tmp/fishprint_xxx)
Section number: <N>
Target language: <user's language>
Time constraint: <absolute date range e.g. "2026-04-12 only" or "2026-04-06〜2026-04-12"; or "none">
## Steps

### 1. Open each candidate URL

Run in parallel (separate Bash calls, all at once):

```bash
agent-browser --session section_<N> open <url>
```

### 2. Read page content

```bash
agent-browser --session section_<N> snapshot
```

Identify which article(s) most authoritatively cover the topic. Skip off-topic or duplicate pages.

### 3. Select thesis sentences

From each chosen article, pick 1〜3 *sentences* that carry the thesis — claims a reader would quote in a discussion. Prefer:
- The one-sentence claim that best summarizes the piece's argument
- Concrete numbers, findings, quoted statements
- Unexpected, counterintuitive, or opinionated lines

Avoid: generic intros ("In recent years..."), TOC items, section titles, author bios, date stamps.

**Selector rules — critical for 魚拓 quality:**
- Target ONE paragraph or list item, NOT a container. The element should visually be ~1〜6 lines tall.
- Allowed tags: `p`, `blockquote`, `li`, `figcaption`, `h2`/`h3` (only if the heading itself is the quote).
- FORBIDDEN tags: `div`, `section`, `article`, `main`, `aside`, `body`.
- FORBIDDEN class patterns: container names — `entry-content`, `post-content`, `article-body`, `prose`, `markdown-body`, `content`, etc.
- On platforms (Medium, Substack, WordPress, Ghost, Notion), use `nth-of-type` on `p` — e.g. `article p:nth-of-type(4)`.
- When unsure, pick the narrower selector.

### 4. Capture each element as a 魚拓

For each CSS selector, first validate, then screenshot and upload:

**Validate:**
```bash
agent-browser --session section_<N> eval "(function(){
  const el = document.querySelector('<selector>');
  if (!el) return JSON.stringify({error:'not found'});
  const r = el.getBoundingClientRect();
  const len = (el.textContent||'').trim().length;
  if (r.height > 600) return JSON.stringify({error:'too tall: '+Math.round(r.height)+'px'});
  if (len > 1200) return JSON.stringify({error:'too long: '+len+' chars'});
  return JSON.stringify({ok:true});
})()"
```

If `{"ok":true}`, proceed. If error, pick a narrower selector and retry. Do NOT fall back to a wider selector.

**Screenshot via html2canvas:**
```bash
RESULT=$(agent-browser --session section_<N> eval "new Promise(resolve=>{
  const el=document.querySelector('<selector>');
  const s=document.createElement('script');
  s.src='https://html2canvas.hertzen.com/dist/html2canvas.min.js';
  s.onload=()=>html2canvas(el,{scale:2,useCORS:true,logging:false})
    .then(c=>resolve(c.toDataURL('image/png')));
  document.head.appendChild(s);
})")
printf '%s' "$RESULT" | tr -d '"' | sed 's/data:image\/png;base64,//' | base64 --decode > /tmp/shot_<N>_<i>.png
```

**Upload to Gyazo:**
```bash
GYAZO_URL=$(fishprint gyazo-upload /tmp/shot_<N>_<i>.png)
```

Record `GYAZO_URL` for use in the section Markdown.

### 5. Visually central images

If the article has a hero image that *is* the subject of the story (a cat photo for cat news, a product shot, a UI screenshot, a portrait), embed it using its original URL directly — no capture needed:
`![description](https://example.com/image.jpg)`

Also embed graphs, benchmark tables, and architecture diagrams when they convey information text alone cannot.

### 6. Prepare translations

For each captured quote, prepare a natural translation into <user's language> (not machine-translation style). The translation goes into the Markdown as a blockquote under the image.

### 7. Write the section

Save directly with the `Write` tool to `<sectionDir>/section_<N>.md`.

**Section format** (everything in <user's language> except the 魚拓 images themselves):

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

Rules:
- `##` heading = topic title in <user's language>.
- Narrative text drives the flow; 魚拓 + translation pairs are evidence. NEVER stack two pairs back-to-back without narrative between them.
- Every captured image URL MUST be followed immediately by a `>` blockquote with the translation.
- Image `alt` text = first few words of the original, NOT the translation.
- ALWAYS end with source link(s). Mandatory.

### 8. Clean up

```bash
agent-browser --session section_<N> close
rm -f /tmp/shot_<N>_*.png
```

### 9. Report

Reply with a single line: `section <N> written` (or `section <N> skipped: <reason>`).

## Constraints

- Everything in <user's language>.
- **NEVER use `mcp__claude-in-chrome__*` tools.** Use only `agent-browser` CLI via Bash.
- Use WebSearch freely for discovery and quick relevance checks.
- On error for a URL, skip it and continue. If no URL works, report "skipped".
- **If Time constraint is not "none":** check the article's publish date. If outside the range, skip that article entirely. If all candidates are outside the range, report "section <N> skipped: no content within time constraint".
```

**Wave control.** If the topic list exceeds ~10, issue Tasks in groups of 8 per message. Wait for each wave before dispatching the next. Assign section numbers sequentially across waves. Gaps from "skipped" sections are fine — assembly handles them.

### Phase 3: Assemble final digest — MANDATORY, DO NOT SKIP

Write preamble and appendix to temp files, then call the assemble script:

```bash
# Write preamble to temp file
cat > /tmp/fishprint_preamble.md << 'PREAMBLE'
<preamble content>
PREAMBLE

# Write appendix to temp file (if any)
cat > /tmp/fishprint_appendix.md << 'APPENDIX'
<appendix content>
APPENDIX

fishprint assemble <sectionDir> <output> /tmp/fishprint_preamble.md /tmp/fishprint_appendix.md
rm -f /tmp/fishprint_preamble.md /tmp/fishprint_appendix.md
```

**Output filename** — derive from the topic and date, in the user's language:
- `AIエージェント_2026-04-12.md`, `cat_news_2026-04-12.md`, `Rust_async_2026-04-12.md`
- Sanitize: replace spaces with `_`, strip filesystem-illegal characters (`/ \ : * ? " < > |`)
- If `$ARGUMENTS` is empty, use `fishprint_YYYY-MM-DD.md`
- **No heading inside the file** — start directly with the preamble

**Output path MUST be absolute**, built from the user's current working directory shown in your system context.

**Preamble** — write in the user's language. Required:

1. A humble scope line (one sentence, not a complete index claim). Example (JA): *"2026年4月12日、{theme}まわりで目に入ったトピック8件。網羅ではなく、今日の干し草の山から拾い上げた分。"*
2. Sources surveyed — bullet list of curation pages visited in Phase 1 with URLs.

**Appendix** — strongly preferred. List candidate topics rejected in Phase 1: title, URL, one-line reason. Headed `## Also seen` (or localized equivalent).

**Do not end the session without running assemble.sh.**

## Rules

- **NEVER use `mcp__claude-in-chrome__*` tools.** All browser automation goes through `agent-browser` CLI via Bash. The claude-in-chrome MCP is a different tool and must not be used here.
- **For global/international topics, use English-language sources only**
- **Translate quotes naturally** into the user's language — not machine-translation style
- **Visually central images are mandatory.** If a story's subject is visual (an animal, a product, a UI, a person), the key image MUST appear in the section.
- **Time constraints are hard filters.** If `$ARGUMENTS` includes any temporal reference, enforce strictly throughout all phases.
- No duplicates
- On error, skip and move on
- If `$ARGUMENTS` is empty, cover whatever is interesting on major tech curation sites right now
