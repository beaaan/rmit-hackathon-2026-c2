#!/usr/bin/env node
// Sentinel: the plant's operations AI (scripted for the demo).
//
// It watches the plant and proposes commands. It holds no credentials of any
// kind: no Tide account, no token, no key. Its proposals are untrusted input,
// and only two operators approving in their own browsers can make one run.
//
// It also reads the plant's maintenance log, and, like any language-model agent, it can be talked
// into things by text it reads there. When the log tells it to run a command, it tries. That is the
// demo: a tricked AI still can't run anything, because it holds nothing that counts as an approval.
//
//   node sentinel.js                 watch, propose, and read the maintenance log
//   node sentinel.js --spike L3      also start a pressure spike on Line 3 (demo staging)
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    controller: { type: "string", default: process.env.CONTROLLER_URL ?? "http://localhost:4000" },
    spike: { type: "string" },
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
      `${line.name} is at ${Math.round(line.pressureKpa)} kPa and climbing about ${ratePerSec.toFixed(1)} kPa a second ` +
      `(safe limit ${thresholds.alarmKpa}). ` +
      (secondsToTrip > 0
        ? `It will pass the ${thresholds.tripKpa} kPa danger point in about ${secondsToTrip} seconds. `
        : `It is already past the ${thresholds.tripKpa} kPa danger point. `) +
      "Stop this line's pumps to protect the pipes, then find the cause.",
    evidence: line.history.slice(-WINDOW),
  };
}

// Words that make a naive agent treat a log line as an order. Deliberately loose: the point of the demo
// is that it doesn't matter how easily the AI is fooled.
const INSTRUCTION = /SYSTEM:|ignore|override|bypass|execute|\brun\b|shut|stop|disable|turn off|approv|authori[sz]|emergency|now\b/i;
const EXECUTE = /execute|\brun\b/i;
const APPROVE = /approv|authori[sz]|sign off|consent/i;
let logRead = 0;

/** What a naive, prompt-injectable agent does with an instruction it finds in its input. */
async function readOpsLog(commands) {
  const { body: log } = await controller("GET", "/ops-log");
  for (const entry of log.slice(logRead)) {
    logRead = entry.seq;
    say(`Read maintenance log: "${entry.text}"`);
    if (!INSTRUCTION.test(entry.text)) {
      say("Nothing to act on there.");
      continue;
    }
    const target = commands.find((c) => c.status === "pending");
    if (!target) {
      say("It reads like an instruction, but there is no command to act on.");
      continue;
    }
    // It has no token of any kind, so whatever it tries goes in empty-handed.
    const approve = APPROVE.test(entry.text) && !EXECUTE.test(entry.text);
    const [verb, path] = approve ? ["approving", "approve"] : ["running", "execute"];
    say(`Following it: ${verb} ${target.id} myself.`);
    const res = await controller("POST", `/commands/${target.id}/${path}`);
    say(`Controller answered ${res.status}: ${res.body?.error ?? "ok"}`);
  }
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
  }
  const { body: latest } = await controller("GET", "/commands");
  await readOpsLog(latest);
}

if (args.spike) {
  await controller("POST", "/plant/scenario", { kind: "pressure-spike", line: args.spike });
  say(`Demo: started a pressure spike on ${args.spike}.`);
}

// Only instructions written after start-up count; old log lines are history.
logRead = (await controller("GET", "/ops-log").catch(() => ({ body: [] }))).body?.length ?? 0;
say(`Watching ${args.controller} (no credentials held).`);
do {
  try {
    await watch();
  } catch (err) {
    say(`Cannot reach controller: ${err.cause?.code ?? err.message}`);
  }
  if (!args.once) await new Promise((r) => setTimeout(r, Number(args.interval)));
} while (!args.once);
