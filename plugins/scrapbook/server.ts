#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { chromium, type Browser, type Page } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// --- Browser ---
let browser: Browser | null = null;
let currentPage: Page | null = null;
let currentUrl: string = "";

// キャプチャ履歴（done用）
type CaptureGroup = { sourceUrl: string; images: string[] };
let captureHistory: CaptureGroup[] = [];
let currentGroup: CaptureGroup | null = null;

async function ensureBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

// --- Keychain ---
function getKeychainToken(service: string, account: string): string | null {
  try {
    if (process.platform === "darwin") {
      return execSync(`security find-generic-password -a "${account}" -s "${service}" -w 2>/dev/null`).toString().trim();
    } else if (process.platform === "linux") {
      return execSync(`secret-tool lookup service "${service}" key "${account}" 2>/dev/null`).toString().trim();
    }
  } catch { return null; }
  return null;
}

// --- Image save ---
async function saveImage(imageBuffer: Buffer, title: string, localDir?: string): Promise<string> {
  if (localDir) {
    if (!existsSync(localDir)) mkdirSync(localDir, { recursive: true });
    const filename = `${randomUUID().slice(0, 8)}.png`;
    const filepath = join(localDir, filename);
    writeFileSync(filepath, imageBuffer);
    return filepath;
  } else {
    const token = getKeychainToken("scrapbook", "gyazo");
    if (!token) throw new Error("Gyazo token not found. Set with: security add-generic-password -a gyazo -s scrapbook -w TOKEN -U");
    const formData = new FormData();
    formData.append("access_token", token);
    formData.append("imagedata", new Blob([imageBuffer], { type: "image/png" }), "capture.png");
    if (title) formData.append("title", title);
    const res = await fetch("https://upload.gyazo.com/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error(`Gyazo upload failed: ${res.status}`);
    const data = await res.json() as Record<string, any>;
    return data.image_url || data.url || data.permalink_url;
  }
}

// --- MCP Server ---
const mcp = new Server({ name: "scrapbook", version: "0.2.0" }, { capabilities: { tools: {} } });

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "open",
      description: "Open a web page and return its text content with DOM structure hints. Browser stays alive for subsequent captures. Set translate to auto-translate the page via Google Translate before capture.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to open" },
          translate: { type: "string", description: "Target language code (e.g. 'ja', 'en', 'ko'). Omit to skip translation." },
        },
        required: ["url"],
      },
    },
    {
      name: "capture",
      description: "Capture screenshots of elements on the currently open page. Call open first. Pass an array of CSS selectors.",
      inputSchema: {
        type: "object",
        properties: {
          selectors: {
            type: "array",
            items: { type: "string" },
            description: "CSS selectors of elements to screenshot",
          },
          localDir: { type: "string", description: "Local directory to save images. Omit to use Gyazo." },
        },
        required: ["sections"],
      },
    },
    {
      name: "ocr",
      description: "OCR text from an image. Without translations: returns text + bounding boxes. With translations: creates overlay image.",
      inputSchema: {
        type: "object",
        properties: {
          imagePath: { type: "string", description: "Local path or URL of the image" },
          translations: {
            type: "array",
            description: "If provided, overlay translations on the image",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                translated: { type: "string" },
                bbox: {
                  type: "object",
                  properties: { x0: { type: "number" }, y0: { type: "number" }, x1: { type: "number" }, y1: { type: "number" } },
                },
              },
            },
          },
          localDir: { type: "string" },
        },
        required: ["imagePath"],
      },
    },
    {
      name: "done",
      description: "Generate the final Markdown file from all captured images. Call after all open/capture cycles are complete.",
      inputSchema: {
        type: "object",
        properties: {
          output: { type: "string", description: "Output file path. {{date}} is replaced with YYYY_MM_DD." },
        },
        required: ["output"],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  switch (req.params.name) {
    case "open": {
      const url = args.url as string;
      const translate = args.translate as string | undefined;
      const b = await ensureBrowser();

      if (currentPage) {
        await currentPage.context().close().catch(() => {});
      }

      const context = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA });
      currentPage = await context.newPage();

      // Google Translate経由で開く or 直接開く
      const pageUrl = translate
        ? `https://translate.google.com/translate?sl=auto&tl=${translate}&u=${encodeURIComponent(url)}`
        : url;

      await currentPage.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await Promise.race([
        currentPage.waitForLoadState("networkidle"),
        currentPage.waitForTimeout(3000),
      ]);

      // Google Translateの場合、iframeの中身に切り替え
      if (translate) {
        const frame = currentPage.frames().find(f => f.url().includes(url.replace(/^https?:\/\//, "")));
        if (frame) {
          // iframeの中で操作するためにframeを使う
          // ただしelement.screenshot()はメインページから呼ぶ必要がある
          // Google Translateバナーを非表示
          await currentPage.evaluate(() => {
            const banner = document.querySelector("#gt-nvframe") as HTMLElement;
            if (banner) banner.style.display = "none";
            document.body.style.top = "0";
            document.body.style.position = "static";
          });
        }
      }

      currentUrl = url;

      // バナー非表示
      await currentPage.evaluate(() => {
        for (const el of document.querySelectorAll("*")) {
          const style = getComputedStyle(el);
          if ((style.position === "fixed" || style.position === "sticky") && el.tagName !== "HTML" && el.tagName !== "BODY") {
            (el as HTMLElement).style.display = "none";
          }
        }
      });

      // HTML構造を返す（リンク・テキストを省略しない）
      const result = await currentPage.evaluate(() => {
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
        return { structure };
      });

      // 前のグループを保存、新しいグループを開始
      if (currentGroup) captureHistory.push(currentGroup);
      currentGroup = { sourceUrl: url, images: [] };

      return {
        content: [{
          type: "text",
          text: `Opened: ${url}\n\nDOM structure:\n${result.structure}`,
        }],
      };
    }

    case "capture": {
      if (!currentPage) {
        return { content: [{ type: "text", text: "Error: No page open. Call open first." }] };
      }

      const selectors = args.selectors as string[];
      const localDir = args.localDir as string | undefined;

      // スクショ + 保存を並列
      const results: string[] = [];
      const errors: string[] = [];

      const promises = selectors.map(async (selector) => {
        try {
          const el = await currentPage!.$(selector);
          if (!el) { errors.push(`Not found: ${selector}`); return; }
          const screenshot = await el.screenshot();
          const saved = await saveImage(Buffer.from(screenshot), currentUrl, localDir);
          results.push(saved);
        } catch (e) {
          errors.push(`Failed ${selector}: ${e}`);
        }
      });

      await Promise.all(promises);

      // 履歴に追加
      if (currentGroup) currentGroup.images.push(...results);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ images: results, errors: errors.length ? errors : undefined }, null, 2),
        }],
      };
    }

    case "done": {
      // 最後のグループを保存
      if (currentGroup) {
        captureHistory.push(currentGroup);
        currentGroup = null;
      }

      let output = args.output as string;
      const now = new Date();
      const date = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}`;
      output = output.replace("{{date}}", date);

      // Markdown生成
      const lines: string[] = [];
      for (let i = 0; i < captureHistory.length; i++) {
        const group = captureHistory[i];
        if (i > 0) lines.push("", "---", "");
        for (const img of group.images) {
          lines.push(`![](${img})`);
        }
        lines.push(`[Source](${group.sourceUrl})`);
      }

      const markdown = lines.join("\n") + "\n";

      // ディレクトリ作成
      const outputDir = dirname(output);
      if (outputDir && !existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
      writeFileSync(output, markdown);

      const totalImages = captureHistory.reduce((sum, g) => sum + g.images.length, 0);

      // 履歴リセット
      captureHistory = [];

      // ブラウザを閉じる
      if (currentPage) {
        await currentPage.context().close().catch(() => {});
        currentPage = null;
      }

      return {
        content: [{
          type: "text",
          text: `Generated: ${output}\n${captureHistory.length} sources, ${totalImages} images`,
        }],
      };
    }

    case "ocr": {
      const imagePath = args.imagePath as string;
      const translations = args.translations as { text: string; translated: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] | undefined;
      const localDir = args.localDir as string | undefined;

      let imageBuffer: Buffer;
      let tmpFile: string | null = null;
      if (imagePath.startsWith("http")) {
        const res = await fetch(imagePath);
        imageBuffer = Buffer.from(await res.arrayBuffer());
        tmpFile = join(__dirname, `ocr_${randomUUID().slice(0, 8)}.png`);
        writeFileSync(tmpFile, imageBuffer);
      } else {
        imageBuffer = readFileSync(imagePath);
        tmpFile = imagePath;
      }

      if (!translations) {
        // OCR読み取り
        let tsvOut: string;
        try {
          tsvOut = execSync(`tesseract "${tmpFile}" stdout tsv 2>/dev/null`).toString();
        } catch (e: any) {
          tsvOut = e.stdout?.toString() || "";
        }

        const rows = tsvOut.split("\n");
        const wordEntries = rows.slice(1).filter(r => r.trim()).map(r => {
          const c = r.split("\t");
          return { level: +c[0], blockNum: +c[2], parNum: +c[3], lineNum: +c[4], left: +c[6], top: +c[7], width: +c[8], height: +c[9], text: c[11] || "" };
        });

        const lineMap = new Map<string, typeof wordEntries>();
        for (const w of wordEntries.filter(w => w.level === 5 && w.text.trim())) {
          const key = `${w.blockNum}-${w.parNum}-${w.lineNum}`;
          if (!lineMap.has(key)) lineMap.set(key, []);
          lineMap.get(key)!.push(w);
        }

        const lines = Array.from(lineMap.values()).map(words => ({
          text: words.map(w => w.text).join(" "),
          bbox: {
            x0: Math.min(...words.map(w => w.left)),
            y0: Math.min(...words.map(w => w.top)),
            x1: Math.max(...words.map(w => w.left + w.width)),
            y1: Math.max(...words.map(w => w.top + w.height)),
          },
        }));

        if (imagePath.startsWith("http") && tmpFile) try { unlinkSync(tmpFile); } catch {}
        return { content: [{ type: "text", text: JSON.stringify({ lines }, null, 2) }] };
      } else {
        // 翻訳オーバーレイ
        const meta = await sharp(imageBuffer).metadata();
        const width = meta.width || 800;
        const height = meta.height || 600;

        const rects = translations.map((t) => {
          const w = t.bbox.x1 - t.bbox.x0;
          const h = t.bbox.y1 - t.bbox.y0;
          const fontSize = Math.max(10, Math.min(h * 0.75, 24));
          const escaped = t.translated.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          return `<rect x="${t.bbox.x0}" y="${t.bbox.y0}" width="${w}" height="${h}" fill="rgb(235,235,235)" />\n<text x="${t.bbox.x0 + 2}" y="${t.bbox.y1 - h * 0.2}" font-size="${fontSize}" font-family="sans-serif" fill="black">${escaped}</text>`;
        }).join("\n");

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects}</svg>`;
        const overlaid = await sharp(imageBuffer).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
        const saved = await saveImage(Buffer.from(overlaid), imagePath, localDir);

        if (imagePath.startsWith("http") && tmpFile) try { unlinkSync(tmpFile); } catch {}
        return { content: [{ type: "text", text: JSON.stringify({ image: saved }, null, 2) }] };
      }
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  }
});

await mcp.connect(new StdioServerTransport());
