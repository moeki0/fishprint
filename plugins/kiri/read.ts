import { openPage, closeBrowser } from "./lib";

const url = process.argv[2];
if (!url) {
  console.error("Usage: kiri-read <url>");
  process.exit(1);
}

const { page } = await openPage(url);
console.error(`Reading: ${url}`);

const text = await page.evaluate(() => {
  const main =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.querySelector('[role="main"]') ||
    document.querySelector(".post-content, .entry-content, .article-content, .content") ||
    document.body;
  return main.innerText;
});

await page.context().close();
await closeBrowser();
console.log(text);
