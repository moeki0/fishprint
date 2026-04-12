import { chromium, type Browser, type Page } from "playwright";
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

const SOCKET_PATH = "/tmp/fishprint-browser.sock";
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
  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  // 動的コンテンツの描画を最大2秒待つ
  await Promise.race([
    page.waitForLoadState("networkidle"),
    page.waitForTimeout(2000),
  ]);
  return { browser, page };
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

// --- Gyazo upload ---

export async function uploadToGyazo(imageBuffer: Buffer, title?: string): Promise<string> {
  const token = getKeychainToken("fishprint", "gyazo");
  if (!token) {
    throw new Error(
      "Gyazo token not found in keychain. Set it with:\n" +
      "  macOS: security add-generic-password -a gyazo -s fishprint -w YOUR_TOKEN -U\n" +
      "  Linux: secret-tool store --label=fishprint service fishprint key gyazo"
    );
  }

  const formData = new FormData();
  formData.append("access_token", token);
  formData.append("imagedata", new Blob([imageBuffer], { type: "image/png" }), "capture.png");
  if (title) formData.append("title", title);

  const res = await fetch("https://upload.gyazo.com/api/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Gyazo upload failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as Record<string, any>;
  return data.image_url || data.url || data.permalink_url;
}

export async function uploadToGyazoParallel(buffers: { buf: Buffer; title: string }[]): Promise<string[]> {
  return Promise.all(buffers.map(({ buf, title }) => uploadToGyazo(buf, title)));
}
