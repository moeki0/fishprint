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
    const token = getKeychainToken("kiri", "gyazo");
    if (!token) throw new Error("Gyazo token not found. Set with: security add-generic-password -a gyazo -s kiri -w TOKEN -U");
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
const mcp = new Server({ name: "kiri", version: "0.2.0" }, { capabilities: { tools: {} } });

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "kiri_open",
      description: "Open a web page and return its text content with DOM structure hints. Browser stays alive for subsequent captures.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to open" },
        },
        required: ["url"],
      },
    },
    {
      name: "kiri_capture",
      description: "Capture screenshots of elements on the currently open page. Injects translations before capture. Call kiri_open first.",
      inputSchema: {
        type: "object",
        properties: {
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                selector: { type: "string" },
                translated: { type: "string", description: "Translation to inject. Empty = no injection." },
                capture: { type: "boolean", description: "Set false to inject translation only, skip screenshot. Default true." },
              },
              required: ["selector", "translated"],
            },
          },
          localDir: { type: "string", description: "Local directory to save images. Omit to use Gyazo." },
        },
        required: ["sections"],
      },
    },
    {
      name: "kiri_ocr",
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
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  switch (req.params.name) {
    case "kiri_open": {
      const url = args.url as string;
      const b = await ensureBrowser();

      // 前のページがあれば閉じる
      if (currentPage) {
        await currentPage.context().close().catch(() => {});
      }

      const context = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA });
      currentPage = await context.newPage();
      await currentPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await Promise.race([
        currentPage.waitForLoadState("networkidle"),
        currentPage.waitForTimeout(2000),
      ]);
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

      // テキスト + DOM構造ヒント
      const result = await currentPage.evaluate(() => {
        const main = document.querySelector("article") || document.querySelector("main") || document.querySelector('[role="main"]') || document.body;
        const text = main.innerText;

        // セレクタ候補を生成
        const hints: string[] = [];
        const tags = ["h1", "h2", "h3", "p", "blockquote", "figure", "img", "table", "ul", "ol"];
        for (const tag of tags) {
          const els = main.querySelectorAll(tag);
          if (els.length > 0) hints.push(`${tag}: ${els.length} found`);
        }

        return { text: text.slice(0, 5000), hints };
      });

      return {
        content: [{
          type: "text",
          text: `Opened: ${url}\n\nDOM hints:\n${result.hints.join("\n")}\n\n---\n\n${result.text}`,
        }],
      };
    }

    case "kiri_capture": {
      if (!currentPage) {
        return { content: [{ type: "text", text: "Error: No page open. Call kiri_open first." }] };
      }

      const sections = args.sections as { selector: string; translated: string; capture?: boolean }[];
      const localDir = args.localDir as string | undefined;

      // 翻訳注入
      await currentPage.evaluate((secs) => {
        for (const sec of secs) {
          try {
            const el = document.querySelector(sec.selector);
            if (el && sec.translated) el.textContent = sec.translated;
          } catch {}
        }
      }, sections);

      await currentPage.waitForTimeout(300);

      // スクショ + 保存を並列
      const captures = sections.filter(s => s.capture !== false);
      const results: string[] = [];
      const errors: string[] = [];

      const promises = captures.map(async (sec) => {
        try {
          const el = await currentPage!.$(sec.selector);
          if (!el) { errors.push(`Not found: ${sec.selector}`); return; }
          const screenshot = await el.screenshot();
          const saved = await saveImage(Buffer.from(screenshot), currentUrl, localDir);
          results.push(saved);
        } catch (e) {
          errors.push(`Failed ${sec.selector}: ${e}`);
        }
      });

      await Promise.all(promises);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ images: results, errors: errors.length ? errors : undefined }, null, 2),
        }],
      };
    }

    case "kiri_ocr": {
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
