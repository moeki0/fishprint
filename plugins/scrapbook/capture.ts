import { readFileSync } from "fs";
import { getBrowser, openPage, closeBrowser, saveImagesParallel, parseLocalDir } from "./lib";

type Section = { selector: string; translated: string; capture?: boolean };
type BatchEntry = { url: string; sections: Section[] };

const arg = process.argv[2];
const localDir = parseLocalDir();

if (!arg) {
  console.error("Usage:");
  console.error("  scrapbook-capture <url> <sections.json> [--local <dir>]");
  console.error("  scrapbook-capture <batch.json> [--local <dir>]");
  process.exit(1);
}

let batch: BatchEntry[];

if (arg.startsWith("http")) {
  const configPath = process.argv[3];
  if (!configPath) {
    console.error("Usage: scrapbook-capture <url> <sections.json> [--local <dir>]");
    process.exit(1);
  }
  batch = [{ url: arg, sections: JSON.parse(readFileSync(configPath, "utf-8")) }];
} else {
  batch = JSON.parse(readFileSync(arg, "utf-8"));
}

const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

async function capturePage(entry: BatchEntry): Promise<{ source_url: string; images: string[] }> {
  const tPage = Date.now();
  const { page } = await openPage(entry.url);
  console.error(`[${elapsed()}] Opened: ${entry.url} (${Date.now() - tPage}ms)`);

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
  }, entry.sections);

  await page.waitForTimeout(300);

  // スクショ撮影
  const tShot = Date.now();
  const screenshots: { buf: Buffer; title: string }[] = [];
  for (const sec of entry.sections.filter(s => s.capture !== false)) {
    try {
      const el = await page.$(sec.selector);
      if (!el) {
        console.error(`  Selector not found: ${sec.selector}`);
        continue;
      }
      const screenshot = await el.screenshot();
      screenshots.push({ buf: Buffer.from(screenshot), title: entry.url });
    } catch (e) {
      console.error(`  Failed: ${sec.selector}: ${e}`);
    }
  }
  console.error(`[${elapsed()}] Screenshots: ${screenshots.length} (${Date.now() - tShot}ms)`);

  await page.context().close();

  // アップロード/保存を並列
  const tSave = Date.now();
  const images = await saveImagesParallel(screenshots, localDir);
  console.error(`[${elapsed()}] Saved: ${images.length} (${Date.now() - tSave}ms)`);

  return { source_url: entry.url, images };
}

console.error(`[${elapsed()}] Starting batch: ${batch.length} URLs`);

const tBrowser = Date.now();
await getBrowser();
console.error(`[${elapsed()}] Browser launched (${Date.now() - tBrowser}ms)`);

const results = await Promise.all(batch.map(entry => capturePage(entry)));

await closeBrowser();
console.error(`[${elapsed()}] Done`);

console.log(JSON.stringify(
  batch.length === 1
    ? { ...results[0], sections_captured: results[0].images.length }
    : { results },
  null, 2
));
