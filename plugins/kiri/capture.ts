import { readFileSync } from "fs";
import { getBrowser, openPage, closeBrowser, saveImagesParallel, parseLocalDir } from "./lib";

type Section = { selector: string; translated: string; capture?: boolean };
type BatchEntry = { url: string; sections: Section[] };

const arg = process.argv[2];
const localDir = parseLocalDir();

if (!arg) {
  console.error("Usage:");
  console.error("  kiri-capture <url> <sections.json> [--local <dir>]");
  console.error("  kiri-capture <batch.json> [--local <dir>]");
  process.exit(1);
}

// バッチモード判定: 第2引数がURLならシングル、JSONファイルならバッチ
let batch: BatchEntry[];

if (arg.startsWith("http")) {
  const configPath = process.argv[3];
  if (!configPath) {
    console.error("Usage: kiri-capture <url> <sections.json> [--local <dir>]");
    process.exit(1);
  }
  batch = [{ url: arg, sections: JSON.parse(readFileSync(configPath, "utf-8")) }];
} else {
  batch = JSON.parse(readFileSync(arg, "utf-8"));
}

async function capturePage(entry: BatchEntry): Promise<{ source_url: string; images: string[] }> {
  const { page } = await openPage(entry.url);
  console.error(`Opened: ${entry.url}`);

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

  await page.context().close();

  // アップロード/保存を並列
  const images = await saveImagesParallel(screenshots, localDir);
  return { source_url: entry.url, images };
}

// 全URLを並列処理（同一ブラウザで複数タブ）
const results = await Promise.all(batch.map(entry => capturePage(entry)));

await closeBrowser();

console.log(JSON.stringify(
  batch.length === 1
    ? { ...results[0], sections_captured: results[0].images.length }
    : { results },
  null, 2
));
