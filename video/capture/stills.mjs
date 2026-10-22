// Saves full-size stills of the composition at the given times (seconds): node capture/stills.mjs 12 48.9 ...
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";
const HF = "C:/Users/bean/.claude/plugins/cache/hyperframes/hyperframes/0.8.175/skills/hyperframes/scripts/plugin-cli.mjs";
const chrome = execFileSync(process.execPath, [HF, "browser", "path"], { encoding: "utf8" }).trim().split(/\r?\n/).pop();
mkdirSync("out/stills", { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true, protocolTimeout: 300000, args: ["--allow-file-access-from-files", "--force-color-profile=srgb", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(pathToFileURL(resolve("index.html")).href, { waitUntil: "load" });
while (!(await page.evaluate(() => !!(window.__timelines && window.__timelines.main)))) await new Promise((r) => setTimeout(r, 250));
for (const t of process.argv.slice(2)) {
  await page.evaluate(async (t) => {
    window.__timelines.main.seek(t, false);
    await Promise.all([...document.images].filter((i) => i.getAttribute("src") && !(i.complete && i.naturalWidth)).map((i) => i.decode().catch(() => {})));
  }, +t);
  await page.screenshot({ path: `out/stills/s-${t}.jpg`, type: "jpeg", quality: 85 });
}
await browser.close();
