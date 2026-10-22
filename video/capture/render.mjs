// Renders the composition frame by frame with puppeteer and pipes JPEG frames into ffmpeg (a lighter path
// than the HyperFrames renderer on a machine short of memory): node capture/render.mjs out.mp4 [from] [to] [fps]
import { execFileSync, spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";
const [out = "out/part.mp4", from = "0", to = "107.5", fpsArg = "60"] = process.argv.slice(2);
const FPS = +fpsArg;
const HF = "C:/Users/bean/.claude/plugins/cache/hyperframes/hyperframes/0.8.175/skills/hyperframes/scripts/plugin-cli.mjs";
const chrome = execFileSync(process.execPath, [HF, "browser", "path"], { encoding: "utf8" }).trim().split(/\r?\n/).pop();
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + "s", ...a);
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true, protocolTimeout: 300000, args: ["--allow-file-access-from-files", "--force-color-profile=srgb", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
page.on("pageerror", (e) => log("pageerror", e.message));
page.on("error", (e) => log("crash", e.message));
page.on("console", (m) => log("console", m.text()));
await page.goto(pathToFileURL(resolve("index.html")).href, { timeout: 300000, waitUntil: "load" });
log("loaded");
while (!(await page.evaluate(() => !!(window.__timelines && window.__timelines.main)))) await new Promise((r) => setTimeout(r, 250));
log("timeline ready");
const ff = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", out], { stdio: ["pipe", "inherit", "inherit"] });
const f0 = Math.round(+from * FPS);
const f1 = Math.round(+to * FPS);
for (let f = f0; f < f1; f++) {
  await page.evaluate(async (t) => {
    window.__timelines.main.seek(t, false);
    // Lazily attached frames must be decoded before the capture.
    await Promise.all([...document.images].filter((i) => i.getAttribute("src") && !(i.complete && i.naturalWidth)).map((i) => i.decode().catch(() => {})));
  }, f / FPS);
  const buf = await page.screenshot({ type: "jpeg", quality: 100 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if ((f - f0) % 120 === 0) log("frame", f, "of", f1);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
log("done", out);
await browser.close();
