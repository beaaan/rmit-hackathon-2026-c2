// Starts the whole demo: plant controller (:4000), Sentinel, and the web app (:3000).
//
//   npm run demo                 Sentinel follows the poisoned ops log (tries to execute directly)
//   npm run demo -- --no-inject  Sentinel only proposes
//
// With controller/tidecloak.json present, operators sign in with TideCloak. Without it,
// everything runs in rehearsal mode against a stand-in realm generated on this machine.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const inject = !process.argv.includes("--no-inject");

for (const dir of ["controller", "app"]) {
  if (!existsSync(at(`${dir}/node_modules`))) {
    console.error(`Dependencies missing in ${dir}/. Run \`npm run setup\` first.`);
    process.exit(1);
  }
}

const tideMode = existsSync(at("controller/tidecloak.json"));
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const controllerEnv = { AUDIT_LOG: `data/audit-${stamp}.jsonl` };
if (!tideMode) {
  if (!existsSync(at("controller/dev/tokens.json"))) {
    spawnSync(process.execPath, ["scripts/dev-keys.js"], { cwd: at("controller"), stdio: "inherit" });
  }
  controllerEnv.TIDECLOAK_CONFIG = "dev/tidecloak.dev.json";
}

console.log(
  tideMode
    ? "TideCloak mode: using controller/tidecloak.json. Operators sign in with Tide."
    : "Rehearsal mode: no controller/tidecloak.json, using a locally generated stand-in realm.",
);

const colours = { controller: 36, sentinel: 35, app: 32 };
const children = [];

function start(name, cwd, args, env = {}) {
  const child = spawn(process.execPath, args, { cwd: at(cwd), env: { ...process.env, ...env } });
  const prefix = `\x1b[${colours[name]}m${name.padEnd(10)}\x1b[0m│ `;
  const pipe = (stream, out) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`${name} exited (${code}). Stopping the demo.`);
      stop(1);
    }
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function stop(code = 0) {
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

async function waitFor(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url} did not come up`);
}

start("controller", "controller", ["src/server.js"], controllerEnv);
await waitFor("http://localhost:4000/health");
start("sentinel", "sentinel", ["sentinel.js", ...(inject ? ["--inject"] : [])]);
start("app", "app", [at("app/node_modules/vite/bin/vite.js")]);
await waitFor("http://localhost:3000/");
console.log(`\nOpen http://localhost:3000 and press "Start Line 3 pressure spike".\n`);
