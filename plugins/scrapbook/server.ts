#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { chromium, type Browser, type Page } from "playwright";

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
const mcp = new Server({ name: "scrapbook", version: "2.1.0" }, { capabilities: { tools: {} } });

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "open",
      description: "Open a web page in a new browser tab and return its DOM structure with text and links. Returns a page ID for subsequent operations. Multiple pages can be open simultaneously.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to open" },
        },
        required: ["url"],
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

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  }
});

await mcp.connect(new StdioServerTransport());
