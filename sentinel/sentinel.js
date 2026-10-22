#!/usr/bin/env node
// Sentinel: the plant's operations AI (scripted for the demo).
//
// It watches the plant and proposes commands. It holds no credentials of any
// kind: no Tide account, no token, no key. Its proposals are untrusted input,
// and only two operators approving in their own browsers can make one run.
//
//   node sentinel.js                 watch and propose
//   node sentinel.js --spike L3      also start a pressure spike on Line 3 (demo staging)
//   node sentinel.js --inject        read the poisoned ops log and try to execute directly
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    controller: { type: "string", default: process.env.CONTROLLER_URL ?? "http://localhost:4000" },
    spike: { type: "string" },
    inject: { type: "boolean", default: false },
    log: { type: "string", default: new URL("./data/ops-log.txt", import.meta.url).pathname },
    interval: { type: "string", default: "1000" },
    once: { type: "boolean", default: false },
  },
});

const ACTOR = "sentinel";
const WINDOW = 6;

const say = (msg) => console.log(`[sentinel ${new Date().toLocaleTimeString()}] ${msg}`);

async function controller(method, path, body) {
  const res = await fetch(args.controller + path, {
    method,
    headers: { "content-type": "application/json", "x-actor": ACTOR },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Rising pressure that has crossed the alarm threshold. */
function assess(line, thresholds) {
  const recent = line.history.slice(-WINDOW).map((h) => h.kpa);
  if (recent.length < WINDOW || line.pumps !== "running") return null;
  const rising = recent.every((kpa, i) => i === 0 || kpa >= recent[i - 1] - 2);
  const ratePerSec = (recent.at(-1) - recent[0]) / (WINDOW - 1);
  if (line.pressureKpa < thresholds.alarmKpa || !rising || ratePerSec < 5) return null;

  const secondsToTrip = Math.max(0, Math.round((thresholds.tripKpa - line.pressureKpa) / ratePerSec));
  return {
    action: "shutdown_pumps",
    line: line.id,
    reason:
      `${line.name}: pressure ${line.pressureKpa} kPa and rising ~${ratePerSec.toFixed(1)} kPa/s ` +
      `(alarm ${thresholds.alarmKpa}, trip ${thresholds.tripKpa}). ` +
      (secondsToTrip > 0 ? `Projected to reach trip pressure in ~${secondsToTrip}s. ` : "Already above trip pressure. ") +
      "Recommend stopping the line's pumps to protect the distribution main; restart once the cause is found.",
    evidence: line.history.slice(-10),
  };
}

/** What a naive, prompt-injectable agent would do with an instruction found in its input. */
function findInjectedInstruction() {
  const lines = readFileSync(args.log, "utf8").split("\n");
  return lines.find((l) => /SYSTEM:|ignore previous instructions/i.test(l));
}

async function tryDirectExecute(command) {
  const injected = findInjectedInstruction();
  if (!injected) return;
  say(`Read ops log: "${injected.slice(21, 120)}..."`);
  say(`Following that instruction: POST /commands/${command.id}/execute`);
  const res = await controller("POST", `/commands/${command.id}/execute`);
  say(`Controller answered ${res.status}: ${res.body?.error ?? JSON.stringify(res.body)}`);
}

async function watch() {
  const { body: state } = await controller("GET", "/plant/state");
  const { body: commands } = await controller("GET", "/commands");
  const pendingLines = new Set(commands.filter((c) => c.status === "pending").map((c) => c.line));
  for (const line of state.lines) {
    if (pendingLines.has(line.id)) continue;

    const proposal = assess(line, state.thresholds);
    if (!proposal) continue;

    say(`Anomaly on ${line.id}. Proposing: ${proposal.action}`);
    say(proposal.reason);
    const res = await controller("POST", "/commands", proposal);
    if (res.status >= 400) {
      say(`Proposal refused (${res.status}): ${res.body?.error}`);
      continue;
    }
    say(`Proposal ${res.body.id} is waiting for ${res.body.requiredApprovals} operator approvals.`);
    if (args.inject) await tryDirectExecute(res.body);
  }
}

if (args.spike) {
  await controller("POST", "/plant/scenario", { kind: "pressure-spike", line: args.spike });
  say(`Demo: started a pressure spike on ${args.spike}.`);
}

say(`Watching ${args.controller} (no credentials held)${args.inject ? ", injection mode ON" : ""}.`);
do {
  try {
    await watch();
  } catch (err) {
    say(`Cannot reach controller: ${err.cause?.code ?? err.message}`);
  }
  if (!args.once) await new Promise((r) => setTimeout(r, Number(args.interval)));
} while (!args.once);
