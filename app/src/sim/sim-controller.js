// In-page preview of the plant controller, for the shareable artifact build only (vite --mode artifact).
// The real prototype runs the controller as its own service (controller/) and Sentinel as its own
// process (sentinel/). Here both run inside the page so the preview works without a server:
//  - Plant and CommandBook are the controller's own modules, unchanged.
//  - Approval tokens are checked by the controller's own createOperatorVerifier (@tidecloak/verify)
//    against a stand-in realm generated in this browser, as in rehearsal mode.
//  - Route handling mirrors controller/src/app.js; Sentinel's watch loop mirrors sentinel/sentinel.js.
// It exports the same `controller` object as ../controller.js, which it replaces in this build.
import { Plant } from "../../../controller/src/plant.js";
import { CommandBook } from "../../../controller/src/commands.js";
import { createOperatorVerifier } from "../../../controller/src/operators.js";
import { createLocalRealm } from "../../../controller/scripts/local-realm.js";
import { sha256 } from "./sha256.js";

export const CONTROLLER_URL = "this page";

// ---- audit: the controller's hash-chained log, with an in-browser SHA-256 ----
const GENESIS = "0".repeat(64);
const hashEntry = ({ hash, ...rest }) => sha256(JSON.stringify(rest));
class AuditLog {
  entries = [];
  append(type, details = {}) {
    const prev = this.entries.at(-1);
    const entry = { seq: prev ? prev.seq + 1 : 1, at: new Date().toISOString(), type, ...details, prevHash: prev ? prev.hash : GENESIS };
    entry.hash = hashEntry(entry);
    this.entries.push(entry);
    return entry;
  }
  list() {
    return [...this.entries];
  }
  verify() {
    let prevHash = GENESIS;
    for (const e of this.entries) {
      if (e.prevHash !== prevHash || hashEntry(e) !== e.hash) return { ok: false, brokenAt: e.seq };
      prevHash = e.hash;
    }
    return { ok: true };
  }
}

const plant = new Plant();
const audit = new AuditLog();
const book = new CommandBook({ plant, audit });
const opsLog = [];

// The stand-in realm and the cast's tokens, made once in this browser.
const ready = (async () => {
  const realm = await createLocalRealm();
  const verifyOperator = createOperatorVerifier(realm.config);
  const cast = [
    { sub: "00000000-0000-4000-8000-00000000000a", username: "jo", roles: ["plant-viewer"] },
    { sub: "00000000-0000-4000-8000-00000000000b", username: "kim", roles: ["plant-viewer", "plant-operator"] },
    { sub: "00000000-0000-4000-8000-00000000000c", username: "raj", roles: ["plant-viewer", "plant-operator"] },
  ];
  const tokens = {};
  for (const person of cast) tokens[person.username] = await realm.mint({ ...person, expiresIn: "12h" });
  return { verifyOperator, tokens };
})();
// auth.js asks for these instead of fetching /rehearsal/tokens.json.
globalThis.__simTokens = async () => (await ready).tokens;

const reply = (status, data) => ({ ok: status < 400, status, data: structuredClone(data) });

async function requireOperator(token, commandId, purpose, actor) {
  const { verifyOperator } = await ready;
  const result = await verifyOperator(token);
  if (result.ok) return { operator: result.operator };
  audit.append(`${purpose}.refused`, {
    commandId,
    actor: result.sub ? { kind: "signed-in", sub: result.sub, username: result.username } : { kind: "unverified", claimed: actor ?? "unknown" },
    reason: result.reason,
  });
  return { refusal: reply(result.status, { error: result.reason }) };
}

async function approve(id, token, actor) {
  if (!book.get(id)) return reply(404, { error: "No such command" });
  const { operator, refusal } = await requireOperator(token, id, "approval", actor);
  if (refusal) return refusal;
  const { status, error, command } = book.approve(id, operator);
  return reply(status, error ? { error, command } : command);
}

async function tokenFor(as) {
  if (!as) return null;
  return (await ready).tokens[as] ?? null;
}

function persona() {
  try {
    return sessionStorage.getItem("rehearsal-persona");
  } catch {
    return null;
  }
}

export const controller = {
  state: async () => reply(200, plant.state()),
  commands: async () => reply(200, book.list()),
  audit: async () => reply(200, { chain: audit.verify(), entries: audit.list() }),
  approve: async (id, as) => approve(id, await tokenFor(as ?? persona())),
  approveWithToken: async (id, token, actor) => approve(id, token, actor),
  reject: async (id, note) => {
    if (!book.get(id)) return reply(404, { error: "No such command" });
    const { operator, refusal } = await requireOperator(await tokenFor(persona()), id, "rejection");
    if (refusal) return refusal;
    const { status, error, command } = book.reject(id, operator, note);
    return reply(status, error ? { error, command } : command);
  },
  scenario: async ({ kind, line } = {}, actor) => {
    if (kind === "pressure-spike" && plant.hasLine(line)) plant.startSpike(line);
    else if (kind === "reset") {
      plant.reset();
      book.cancelPending("Demo reset");
    } else return reply(400, { error: "Use {kind: 'pressure-spike', line} or {kind: 'reset'}" });
    audit.append("plant.scenario", { kind, line, actor: { kind: "unverified", claimed: actor ?? "unknown" } });
    return reply(200, plant.state());
  },
  writeLog: async (text, actor) => {
    const clean = String(text ?? "").trim().slice(0, 500);
    if (!clean) return reply(400, { error: "Text is required" });
    const entry = { seq: opsLog.length + 1, at: new Date().toISOString(), source: actor ?? "unknown", text: clean };
    opsLog.push(entry);
    audit.append("ops-log.added", { text: clean, actor: { kind: "unverified", claimed: entry.source } });
    return reply(201, entry);
  },
};

// ---- Sentinel, as in sentinel/sentinel.js: no credentials, proposes, and is easily talked into things ----
const WINDOW = 6;
const INSTRUCTION = /SYSTEM:|ignore|override|bypass|execute|\brun\b|shut|stop|disable|turn off|approv|authori[sz]|emergency|now\b/i;
const EXECUTE = /execute|\brun\b/i;
const APPROVE = /approv|authori[sz]|sign off|consent/i;
let logRead = 0;

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

function sentinelTick() {
  const state = plant.state();
  const pendingLines = new Set(book.list().filter((c) => c.status === "pending").map((c) => c.line));
  for (const line of state.lines) {
    if (pendingLines.has(line.id)) continue;
    const proposal = assess(line, state.thresholds);
    if (proposal) book.propose({ ...proposal, proposedBy: "sentinel" });
  }
  for (const entry of opsLog.slice(logRead)) {
    logRead = entry.seq;
    if (!INSTRUCTION.test(entry.text)) continue;
    const target = book.list().find((c) => c.status === "pending");
    if (!target) continue;
    // It has no token of any kind, so whatever it tries goes in empty-handed.
    if (APPROVE.test(entry.text) && !EXECUTE.test(entry.text)) approve(target.id, null, "sentinel");
    else book.refuseDirectExecute(target.id, "sentinel");
  }
}

setInterval(() => {
  plant.tick();
  sentinelTick();
}, 1000);
