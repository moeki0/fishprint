import { chromium, type Browser, type Page } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { execSync } from "child_process";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// --- Keychain ---

export function getKeychainToken(service: string, account: string): string | null {
  try {
    if (process.platform === "darwin") {
      return execSync(`security find-generic-password -a "${account}" -s "${service}" -w 2>/dev/null`).toString().trim();
    } else if (process.platform === "linux") {
      return execSync(`secret-tool lookup service "${service}" key "${account}" 2>/dev/null`).toString().trim();
    }
  } catch {
    return null;
  }
  return null;
}

// --- Browser daemon ---

const SOCKET_PATH = "/tmp/kiri-browser.sock";
let _browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;
  _browser = await chromium.launch({ headless: true });
  return _browser;
}

export async function openPage(pageUrl: string, width = 1280): Promise<{ browser: Browser; page: Page }> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    userAgent: UA,
  });
  const page = await context.newPage();
  await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 60000 });
  return { browser, page };
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

// --- Image save ---

export function parseLocalDir(): string | null {
  const idx = process.argv.indexOf("--local");
  return (idx !== -1 && process.argv[idx + 1]) ? process.argv[idx + 1] : null;
}

export async function saveImage(imageBuffer: Buffer, title?: string, localDir?: string | null): Promise<string> {
  if (localDir) {
    if (!existsSync(localDir)) mkdirSync(localDir, { recursive: true });
    const filename = `${randomUUID().slice(0, 8)}.png`;
    const filepath = join(localDir, filename);
    writeFileSync(filepath, imageBuffer);
    console.error(`Saved: ${filepath}`);
    return filepath;
  } else {
    const token = getKeychainToken("kiri", "gyazo");
    if (!token) {
      console.error("Gyazo token not found in keychain. Set it with:");
      console.error("  macOS: security add-generic-password -a gyazo -s kiri -w YOUR_TOKEN -U");
      console.error("  Linux: secret-tool store --label=kiri service kiri key gyazo");
      console.error("Or use --local <dir> for local storage.");
      process.exit(1);
    }

    const formData = new FormData();
    formData.append("access_token", token);
    formData.append("imagedata", new Blob([imageBuffer], { type: "image/png" }), "capture.png");
    if (title) formData.append("title", title);

    const res = await fetch("https://upload.gyazo.com/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error(`Gyazo upload failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as Record<string, any>;
    const imageUrl = data.image_url || data.url || data.permalink_url;
    console.error(`Uploaded: ${imageUrl}`);
    return imageUrl;
  }
}

// --- Parallel save ---

export async function saveImagesParallel(buffers: { buf: Buffer; title: string }[], localDir?: string | null): Promise<string[]> {
  return Promise.all(buffers.map(({ buf, title }) => saveImage(buf, title, localDir)));
}
