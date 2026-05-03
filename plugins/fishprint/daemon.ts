#!/usr/bin/env bun
import { chromium, type Browser, type Page } from "playwright";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync, rmdirSync } from "fs";
import { join, dirname } from "path";
import { uploadToGyazoParallel } from "./lib";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const HOST = process.env.FISHPRINT_HOST ?? "127.0.0.1";
const PORT = Number(process.env.FISHPRINT_PORT ?? "3847");

let browser: Browser | null = null;
const pages = new Map<string, { page: Page; url: string }>();
let nextId = 1;

async function ensureBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

async function shutdown() {
  for (const [, entry] of pages) {
    await entry.page.context().close().catch(() => {});
  }
  pages.clear();
  if (browser) await browser.close().catch(() => {});
  browser = null;
}

process.on("SIGINT", () => { shutdown().finally(() => process.exit(0)); });
process.on("SIGTERM", () => { shutdown().finally(() => process.exit(0)); });

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

async function readJson(req: Request): Promise<Record<string, any>> {
  if (!req.body) return {};
  try {
    return await req.json() as Record<string, any>;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function handleOpen(body: Record<string, any>) {
  const url = body.url;
  if (typeof url !== "string" || !url) throw new HttpError(400, "url is required");

  const b = await ensureBrowser();
  const context = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await Promise.race([
    page.waitForLoadState("networkidle"),
    page.waitForTimeout(10000),
  ]);

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
  return { id, url, truncated: result.truncated, structure: result.structure };
}

async function handleCapture(body: Record<string, any>) {
  const id = body.id;
  const selectors = body.selectors;
  if (typeof id !== "string" || !id) throw new HttpError(400, "id is required");
  if (!Array.isArray(selectors) || selectors.some(s => typeof s !== "string")) throw new HttpError(400, "selectors must be an array of strings");

  const entry = pages.get(id);
  if (!entry) throw new HttpError(404, `Page ${id} not found`);
  const page = entry.page;

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
  const captured = shots.map((s, i) => ({ selector: s.selector, url: urls[i].imageUrl, permalinkUrl: urls[i].permalinkUrl }));
  return { captured, rejected };
}

async function handleClose(body: Record<string, any>) {
  const id = body.id;
  if (typeof id !== "string" || !id) throw new HttpError(400, "id is required");
  const entry = pages.get(id);
  if (!entry) throw new HttpError(404, `Page ${id} not found`);
  await entry.page.context().close().catch(() => {});
  pages.delete(id);
  return { ok: true, message: `Closed page ${id}` };
}

async function handleAssemble(body: Record<string, any>) {
  const sectionDir = body.sectionDir;
  const output = body.output;
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const preamble = typeof body.preamble === "string" ? body.preamble.trim() : undefined;
  const appendix = typeof body.appendix === "string" ? body.appendix.trim() : undefined;

  if (typeof sectionDir !== "string" || !sectionDir) throw new HttpError(400, "sectionDir is required");
  if (typeof output !== "string" || !output) throw new HttpError(400, "output is required");
  if (!existsSync(sectionDir)) throw new HttpError(404, `sectionDir ${sectionDir} not found`);

  const files = readdirSync(sectionDir)
    .filter(f => /^section_\d+\.md$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]));

  if (files.length === 0) throw new HttpError(404, `No section files found in ${sectionDir}`);

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

  for (const f of files) {
    try { unlinkSync(join(sectionDir, f)); } catch {}
  }
  try { rmdirSync(sectionDir); } catch {}

  return { ok: true, sections: files.length, output };
}

const routes: Record<string, (body: Record<string, any>) => Promise<unknown>> = {
  "/open": handleOpen,
  "/capture": handleCapture,
  "/close": handleClose,
  "/assemble": handleAssemble,
};

Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    try {
      if (req.method === "GET" && url.pathname === "/health") {
        return json({ ok: true, name: "fishprint", pages: pages.size, browser: !!browser?.isConnected() });
      }
      if (req.method !== "POST") throw new HttpError(405, "Use POST");

      const route = routes[url.pathname];
      if (!route) throw new HttpError(404, "Not found");
      const body = await readJson(req);
      const result = await route(body);
      return json(result);
    } catch (e: any) {
      const status = e instanceof HttpError ? e.status : 500;
      return json({ ok: false, error: e?.message ?? String(e) }, status);
    }
  },
});

console.error(`fishprint daemon listening on http://${HOST}:${PORT}`);
