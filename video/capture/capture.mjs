// Drives the running demo (npm run demo, http://localhost:3000) through the film's story and saves a
// 2x screenshot of every state, plus the stage geometry the film's overlays need (signal routes, lock,
// keyholes, gauge, pump, cards). Reduced motion is emulated so each state is captured settled; the film
// redraws the moving parts (signals, flow, flashes) on top from geo.json.
//
//   node capture/capture.mjs [--url http://localhost:3000] [--out assets/ui]
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const URL = arg("url", "http://localhost:3000");
const OUT = arg("out", "assets/ui");
const HF = "C:/Users/bean/.claude/plugins/cache/hyperframes/hyperframes/0.8.175/skills/hyperframes/scripts/plugin-cli.mjs";
const chrome = process.env.CHROME_PATH ?? execFileSync(process.execPath, [HF, "browser", "path"], { encoding: "utf8" }).trim().split(/\r?\n/).pop();

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shots = [];

async function settle() {
  await page.addStyleTag({ content: ".pulse { outline: none !important; } *, *::before, *::after { caret-color: transparent !important; }" });
}

async function shot(name, note) {
  await sleep(450);
  await page.screenshot({ path: `${OUT}/${name}.png`, type: "png" });
  shots.push({ name, note, at: Date.now() });
  console.log("shot", name, note ?? "");
}

const textOf = (sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => "");
async function waitText(sel, needle, timeout = 30000) {
  await page.waitForFunction(
    (s, n) => [...document.querySelectorAll(s)].some((el) => el.textContent.includes(n)),
    { timeout, polling: 100 },
    sel,
    needle,
  );
}
async function click(scope, label) {
  const ok = await page.evaluate(
    (s, l) => {
      const b = [...document.querySelectorAll(`${s} button`)].find((x) => x.textContent.trim() === l && !x.disabled);
      if (!b) return false;
      b.click();
      return true;
    },
    scope,
    label,
  );
  if (!ok) throw new Error(`No enabled "${label}" button in ${scope}`);
}

/** Everything the overlays need, in CSS pixels of the 1920x1080 viewport. */
async function geometry() {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const svg = document.querySelector(".stage svg");
    const sb = box(svg);
    const attr = (sel, a) => document.querySelector(sel)?.getAttribute(a);
    const num = (sel, a) => Number(attr(sel, a));
    const ids = ["sentinel", "attacker", "jo", "kim", "raj"];
    const ports = ids.map((id) => ({ id, x: num(`.port.${id} .port-dot`, "cx"), y: num(`.port.${id} .port-dot`, "cy"), r: num(`.port.${id} .port-dot`, "r") }));
    const w = sb.w;
    const s = Math.min(1, Math.max(0.58, w / 1150));
    const xs = ports.map((p) => p.x);
    const portY = ports[0].y;
    const routes = Object.fromEntries(ids.map((id) => [id, attr(`.route.${id}`, "d")]));
    routes.trick = `M${xs[1]},${portY - 8} C${xs[1]},${portY - 64 * s} ${xs[0]},${portY - 64 * s} ${xs[0]},${portY - 8}`;
    routes.wire = attr(".wire", "d");
    routes.sense = attr(".sense", "d");
    const lockBody = document.querySelector(".lock-body");
    const lock = { x: num(".lock-body", "x"), y: num(".lock-body", "y"), w: num(".lock-body", "width"), h: num(".lock-body", "height"), rx: num(".lock-body", "rx") };
    const keyholes = [...document.querySelectorAll(".keyhole circle")].map((c) => ({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy"), r: +c.getAttribute("r") }));
    const pipeD = attr(".pipe-shell", "d");
    const pipeY = Number(pipeD.split(",")[1].split(" ")[0]);
    const gauge = { x: num(".gauge-face", "cx"), y: num(".gauge-face", "cy"), r: num(".gauge-face", "r") };
    const pump = { x: num(".pump-body", "cx"), y: num(".pump-body", "cy"), r: num(".pump-body", "r") };
    const cards = Object.fromEntries(ids.map((id) => [id, box(document.querySelector(`.actor.${id}`))]));
    const buttons = [...document.querySelectorAll(".actor button, .console-bar button")].map((b) => ({ text: b.textContent.trim(), actor: b.closest(".actor")?.dataset.actor ?? "bar", ...box(b) }));
    return {
      viewport: { w: innerWidth, h: innerHeight, scrollY },
      stage: sb,
      s,
      ports,
      routes,
      lock,
      lockPresent: !!lockBody,
      keyholes,
      pipe: { y: pipeY, shell: num(".pipe-shell", "stroke-width"), flow: num(".pipe-flow", "stroke-width") },
      gauge,
      pump,
      cards,
      buttons,
      console: box(document.querySelector(".console")),
      bar: box(document.querySelector(".console-bar")),
      ticker: box(document.querySelector(".ticker")),
      hero: box(document.querySelector(".hero h1")),
      topbar: box(document.querySelector(".topbar")),
    };
  });
}

await page.goto(URL, { waitUntil: "networkidle0" });
await settle();
await page.waitForSelector(".stage svg .lock-body");
// Start from a clean run.
const restart = await page.evaluate(() => [...document.querySelectorAll(".console-bar button")].some((b) => b.textContent.includes("Start over")));
if (restart) {
  await click(".console-bar", "Start over");
  await waitText(".console-bar button", "Start a pressure spike");
}
await sleep(1500);
await shot("s00-idle", "idle, water flowing");
writeFileSync(`${OUT}/geo.json`, JSON.stringify(await geometry(), null, 2));

// The spike: pressure climbs until Sentinel files its request.
await click(".console-bar", "Start a pressure spike");
for (let i = 0; i < 40; i++) {
  const pending = await page.evaluate(() => [...document.querySelectorAll(".stage .cap")].some((t) => t.textContent.includes("Request:")));
  if (pending) break;
  await shot(`s01-rise-${String(i).padStart(2, "0")}`, await textOf(".gauge-num"));
  await sleep(150);
}
await waitText(".stage .cap", "Request:");
await shot("s02-pending", "Sentinel asks; 0 of 2");

await click(".actor.attacker", "Trick the AI");
await waitText(".actor.sentinel .status", "Blocked");
await shot("s03-trick", "prompt-injected Sentinel refused");

await click(".actor.attacker", "Forge a pass");
await waitText(".actor.attacker .status", "Forged pass blocked");
await shot("s04-forged", "forged pass refused");

await click(".actor.jo", "Approve");
await waitText(".actor.jo .status", "Not an operator");
await shot("s05-jo", "Jo refused: not an operator");

await click(".actor.jo", "Make me operator");
await waitText(".actor.jo .votes", "Admins");
await shot("s06-promote", "Jo's request: Admins 0 of 2");
await click(".actor.jo", "Self-approve");
await waitText(".actor.jo .votes", "1 of 2");
await shot("s06b-self", "Jo's own approval: 1 of 2");

await click(".actor.kim", "Approve");
await waitText(".stage .cap", "1 of 2");
await shot("s07-kim", "Kim: 1 of 2");

await click(".actor.kim", "Approve again");
await waitText(".actor.kim .status", "Twice counts once");
await shot("s08-kim-again", "Kim twice: still 1 of 2");

await click(".actor.raj", "Approve");
await waitText(".stage .cap", "Two operators agreed");
await shot("s09-raj", "two keys, pumps stop");
for (let i = 0; i < 16; i++) {
  await sleep(300);
  await shot(`s09-fall-${String(i).padStart(2, "0")}`, await textOf(".gauge-num"));
}
writeFileSync(`${OUT}/geo-end.json`, JSON.stringify(await geometry(), null, 2));

await page.goto(`${URL}/#/control-room`, { waitUntil: "networkidle0" });
await settle();
await sleep(2500);
await shot("s10-control", "control room");
await page.screenshot({ path: `${OUT}/s10-control-full.png`, type: "png", fullPage: true });

writeFileSync(`${OUT}/shots.json`, JSON.stringify(shots, null, 2));
await browser.close();
