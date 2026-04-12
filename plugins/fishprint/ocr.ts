import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import sharp from "sharp";
import { uploadToGyazo } from "./lib";

const __dirname = dirname(fileURLToPath(import.meta.url));

const imagePath = process.argv[2];
const translationsPath = process.argv[3];

if (!imagePath) {
  console.error("Usage: fishprint-ocr <image_path_or_url> [translations.json]");
  process.exit(1);
}

// 画像読み込み
let imageBuffer: Buffer;
let tmpFile: string;
if (imagePath.startsWith("http")) {
  const res = await fetch(imagePath);
  imageBuffer = Buffer.from(await res.arrayBuffer());
  tmpFile = join(__dirname, `ocr_input_${randomUUID().slice(0, 8)}.png`);
  writeFileSync(tmpFile, imageBuffer);
} else {
  imageBuffer = readFileSync(imagePath);
  tmpFile = imagePath;
}

console.error(`OCR: ${imagePath}`);

// tesseract CLIでTSV出力
let tsvOut: string;
try {
  tsvOut = execSync(`tesseract "${tmpFile}" stdout tsv 2>/dev/null`).toString();
} catch (e: any) {
  tsvOut = e.stdout?.toString() || "";
}

const rows = tsvOut.split("\n");
const wordEntries = rows.slice(1).filter(r => r.trim()).map(r => {
  const c = r.split("\t");
  return {
    level: +c[0], blockNum: +c[2], parNum: +c[3], lineNum: +c[4],
    left: +c[6], top: +c[7], width: +c[8], height: +c[9], text: c[11] || "",
  };
});

const lineMap = new Map<string, typeof wordEntries>();
for (const w of wordEntries.filter(w => w.level === 5 && w.text.trim())) {
  const key = `${w.blockNum}-${w.parNum}-${w.lineNum}`;
  if (!lineMap.has(key)) lineMap.set(key, []);
  lineMap.get(key)!.push(w);
}

const lines = Array.from(lineMap.values()).map(words => {
  const text = words.map(w => w.text).join(" ");
  const x0 = Math.min(...words.map(w => w.left));
  const y0 = Math.min(...words.map(w => w.top));
  const x1 = Math.max(...words.map(w => w.left + w.width));
  const y1 = Math.max(...words.map(w => w.top + w.height));
  return { text, bbox: { x0, y0, x1, y1 } };
});

if (!translationsPath) {
  console.log(JSON.stringify({ lines }, null, 2));
} else {
  const translations: { text: string; translated: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] =
    JSON.parse(readFileSync(translationsPath, "utf-8"));

  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width || 800;
  const height = meta.height || 600;

  const rects = translations.map((t) => {
    const w = t.bbox.x1 - t.bbox.x0;
    const h = t.bbox.y1 - t.bbox.y0;
    const fontSize = Math.max(10, Math.min(h * 0.75, 24));
    const escaped = t.translated.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<rect x="${t.bbox.x0}" y="${t.bbox.y0}" width="${w}" height="${h}" fill="rgb(235,235,235)" />
<text x="${t.bbox.x0 + 2}" y="${t.bbox.y1 - h * 0.2}" font-size="${fontSize}" font-family="sans-serif" fill="black">${escaped}</text>`;
  }).join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects}</svg>`;
  const overlaid = await sharp(imageBuffer).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
  const saved = await uploadToGyazo(Buffer.from(overlaid), imagePath);
  console.log(JSON.stringify({ image: saved }, null, 2));
}

// 一時ファイル削除
if (imagePath.startsWith("http")) {
  try { unlinkSync(tmpFile); } catch {}
}
