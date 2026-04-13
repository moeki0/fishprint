#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { chromium, type Browser, type Page } from "playwright";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync, rmdirSync } from "fs";
import { join, dirname } from "path";
import { uploadToGyazoParallel } from "./lib";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// --- Browser & Pages ---
let browser: Browser | null = null;
const pages = new Map<string, { page: Page; url: string }>();
let nextId = 1;

async function ensureBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

function summarizeDOM(page: Page): Promise<{ structure: string; truncated: boolean }> {
  return page.evaluate(() => {
    const main = document.querySelector("article") || document.querySelector("main") || document.querySelector('[role="main"]') || document.body;

    function summarize(el: Element, depth: number): string {
      if (depth > 8) return "";
      const tag = el.tagName.toLowerCase();
      const skip = new Set(["script", "style", "noscript", "svg", "path", "iframe"]);
      if (skip.has(tag)) return "";

      const important = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "li", "figcaption", "img", "figure", "table", "tr", "td", "th", "a", "pre", "code", "time", "span"]);

      let selector = tag;
      if (el.id) selector += `#${el.id}`;
      else if (el.className && typeof el.className === "string") {
        const cls = el.className.trim().split(/\s+/)[0];
        if (cls) selector += `.${cls}`;
      }

      const indent = "  ".repeat(depth);
      const lines: string[] = [];

      if (important.has(tag)) {
        const text = el.textContent?.trim() || "";
        const href = (el as HTMLAnchorElement).href || "";
        const src = (el as HTMLImageElement).src || "";
        let attrs = "";
        if (href) attrs += ` href="${href}"`;
        if (src) attrs += ` src="${src}"`;
        lines.push(`${indent}<${selector}${attrs}>${text ? " " + text : ""}`);
      } else if (tag === "div" || tag === "section" || tag === "article" || tag === "main" || tag === "nav" || tag === "header" || tag === "footer" || tag === "aside") {
        lines.push(`${indent}<${selector}>`);
      }

      for (const child of el.children) {
        const childResult = summarize(child, depth + 1);
        if (childResult) lines.push(childResult);
      }

      return lines.join("\n");
    }

    const structure = summarize(main, 0);
    const MAX_CHARS = 20000;
    const truncated = structure.length > MAX_CHARS;
    return { structure: truncated ? structure.slice(0, MAX_CHARS) : structure, truncated };
  });
}

// --- MCP Server ---
const mcp = new Server({ name: "fishprint", version: "2.25.0" }, { capabilities: { tools: {} } });

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "open",
      description: "Open a web page and return its DOM structure with text and links. Returns a page ID. Up to 4 pages can be open in parallel — call open multiple times concurrently for faster browsing.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to open" },
        },
        required: ["url"],
      },
    },
    {
      name: "capture",
      description: "Screenshot selected elements on an open page and upload each to Gyazo. The original (untranslated) element is captured as-is. Returns an array of { selector, url } — embed url in Markdown as ![](url), and place the translated text as a blockquote below the image.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Page ID returned by open" },
          selectors: {
            type: "array",
            description: "CSS selectors of the elements to capture",
            items: { type: "string" },
          },
        },
        required: ["id", "selectors"],
      },
    },
    {
      name: "close",
      description: "Close a previously opened page by its ID. Frees browser resources.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Page ID returned by open" },
        },
        required: ["id"],
      },
    },
    {
      name: "assemble",
      description: "Concatenate all section_N.md files in sectionDir (numeric order) into a single Markdown file with a top-level heading. Optional preamble (inserted after the title, before sections) and appendix (inserted after sections). Removes sectionDir after assembly.",
      inputSchema: {
        type: "object",
        properties: {
          sectionDir: { type: "string", description: "Directory containing section_*.md files (caller-chosen, e.g. /tmp/fishprint_<uuid>)" },
          output: { type: "string", description: "Output file path (e.g. ./fishprint_2026_04_12.md)" },
          title: { type: "string", description: "Top-level heading text (e.g. 'Fishprint: AI agents — 2026-04-12')" },
          preamble: { type: "string", description: "Optional Markdown inserted between the title and the first section — used for scope framing and the list of sources surveyed" },
          appendix: { type: "string", description: "Optional Markdown appended after the last section — used for 'also seen but not selected' candidate topics" },
        },
        required: ["sectionDir", "output"],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  switch (req.params.name) {
    case "open": {
      const url = args.url as string;
      const b = await ensureBrowser();

      const context = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA });
      const page = await context.newPage();

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await Promise.race([
        page.waitForLoadState("networkidle"),
        page.waitForTimeout(10000),
      ]);

      // バナー非表示
      await page.evaluate(() => {
        for (const el of document.querySelectorAll("*")) {
          const style = getComputedStyle(el);
          if ((style.position === "fixed" || style.position === "sticky") && el.tagName !== "HTML" && el.tagName !== "BODY") {
            (el as HTMLElement).style.display = "none";
          }
        }
      });

      const result = await summarizeDOM(page);

      const id = String(nextId++);
      pages.set(id, { page, url });

      return {
        content: [{
          type: "text",
          text: `Page ${id}: ${url}${result.truncated ? " (truncated)" : ""}\n\nDOM structure:\n${result.structure}`,
        }],
      };
    }

    case "capture": {
      const id = args.id as string;
      const selectors = args.selectors as string[];
      const entry = pages.get(id);
      if (!entry) {
        return { content: [{ type: "text", text: `Page ${id} not found` }] };
      }
      const page = entry.page;

      // A quote-bearing element should be at most one paragraph.
      // Reject oversized elements so the subagent picks a narrower selector.
      const MAX_HEIGHT_PX = 600;
      const MAX_TEXT_CHARS = 1200;

      const shots: { buf: Buffer; title: string; selector: string }[] = [];
      const rejected: { selector: string; reason: string }[] = [];

      for (const selector of selectors) {
        try {
          const el = await page.$(selector);
          if (!el) {
            rejected.push({ selector, reason: "selector did not match any element" });
            continue;
          }
          const box = await el.boundingBox();
          const textLen = await el.evaluate((n) => (n.textContent || "").trim().length);
          if (box && box.height > MAX_HEIGHT_PX) {
            rejected.push({ selector, reason: `element too tall (${Math.round(box.height)}px > ${MAX_HEIGHT_PX}px) — pick a single paragraph, not a container` });
            continue;
          }
          if (textLen > MAX_TEXT_CHARS) {
            rejected.push({ selector, reason: `element has too much text (${textLen} chars > ${MAX_TEXT_CHARS}) — pick a single paragraph, not a container` });
            continue;
          }
          const buf = await el.screenshot();
          shots.push({ buf: Buffer.from(buf), title: entry.url, selector });
        } catch (e: any) {
          rejected.push({ selector, reason: `capture failed: ${e?.message ?? e}` });
        }
      }

      const urls = await uploadToGyazoParallel(shots.map(s => ({ buf: s.buf, title: s.title })));
      const results = shots.map((s, i) => ({ selector: s.selector, url: urls[i] }));

      return {
        content: [{ type: "text", text: JSON.stringify({ captured: results, rejected }) }],
      };
    }

    case "close": {
      const id = args.id as string;
      const entry = pages.get(id);
      if (!entry) {
        return { content: [{ type: "text", text: `Page ${id} not found` }] };
      }
      await entry.page.context().close().catch(() => {});
      pages.delete(id);
      return {
        content: [{ type: "text", text: `Closed page ${id}` }],
      };
    }

    case "assemble": {
      const sectionDir = args.sectionDir as string;
      const output = args.output as string;
      const title = (args.title as string | undefined)?.trim();
      const preamble = (args.preamble as string | undefined)?.trim();
      const appendix = (args.appendix as string | undefined)?.trim();

      if (!existsSync(sectionDir)) {
        return { content: [{ type: "text", text: `sectionDir ${sectionDir} not found` }] };
      }

      const files = readdirSync(sectionDir)
        .filter(f => /^section_\d+\.md$/.test(f))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)![0]);
          const nb = parseInt(b.match(/\d+/)![0]);
          return na - nb;
        });

      if (files.length === 0) {
        return { content: [{ type: "text", text: `No section files found in ${sectionDir}` }] };
      }

      const sections = files.map(f => readFileSync(join(sectionDir, f), "utf-8").trim());
      const parts: string[] = [];
      if (title) parts.push(`# ${title}`);
      if (preamble) parts.push(preamble);
      parts.push(sections.join("\n\n---\n\n"));
      if (appendix) parts.push(appendix);
      const combined = parts.join("\n\n") + "\n";

      const outDir = dirname(output);
      if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(output, combined);

      // Clean up session dir
      for (const f of files) {
        try { unlinkSync(join(sectionDir, f)); } catch {}
      }
      try { rmdirSync(sectionDir); } catch {}

      return {
        content: [{ type: "text", text: `Assembled ${files.length} sections into ${output}` }],
      };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  }
});

await mcp.connect(new StdioServerTransport());
