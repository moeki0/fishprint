import { readFileSync } from "fs";
import { openPage, closeBrowser, saveImagesParallel, parseLocalDir } from "./lib";

const url = process.argv[2];
const configPath = process.argv[3];
if (!url || !configPath) {
  console.error("Usage: kiri-capture <url> <sections.json> [--local <dir>]");
  process.exit(1);
}

const localDir = parseLocalDir();
const sections: { selector: string; translated: string; capture?: boolean }[] = JSON.parse(
  readFileSync(configPath, "utf-8"),
);

const { page } = await openPage(url);
console.error(`Opened: ${url}`);

// バナー・オーバーレイを非表示
await page.evaluate(() => {
  for (const el of document.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    if ((style.position === 'fixed' || style.position === 'sticky') && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
      (el as HTMLElement).style.display = 'none';
    }
  }
});

// 翻訳テキストを注入
await page.evaluate((secs) => {
  for (const sec of secs) {
    try {
      const el = document.querySelector(sec.selector);
      if (el && sec.translated) {
        el.textContent = sec.translated;
      }
    } catch (e) {}
  }
}, sections);

await page.waitForTimeout(300);

// 全要素のスクショを並列で撮影
const captureTargets = sections.filter(s => s.capture !== false);
const screenshots: { buf: Buffer; title: string }[] = [];

for (const sec of captureTargets) {
  try {
    const el = await page.$(sec.selector);
    if (!el) {
      console.error(`Selector not found: ${sec.selector}`);
      continue;
    }
    const screenshot = await el.screenshot();
    screenshots.push({ buf: Buffer.from(screenshot), title: url });
  } catch (e) {
    console.error(`Failed to capture ${sec.selector}: ${e}`);
  }
}

await page.context().close();

// アップロード/保存を並列実行
const images = await saveImagesParallel(screenshots, localDir);

await closeBrowser();
console.log(JSON.stringify({ source_url: url, sections_captured: images.length, images }, null, 2));
