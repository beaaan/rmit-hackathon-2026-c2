// The operators' control room. One focal point: the decision, shown as the lock with its two keyholes.
// Around it, the three lines, Line 3's pressure and the audit trail, all read from the plant controller.
import { useEffect, useMemo, useRef, useState } from "react";
import { AUTH_MODE, auth } from "./auth.js";
import { controller } from "./controller.js";
import { actorName, clock, kpa, signed } from "./shared.js";

const SEVERITY = { normal: 0, alarm: 1, trip: 2 };
const ACTION = { shutdown_pumps: "stop pumps", restart_pumps: "restart pumps", close_inlet_valve: "close inlet valve" };
const ROWS = 8;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function ControlRoom({ session, authError, plant, plantError, commands, audit, refreshAll }) {
  const [chosenLine, setChosenLine] = useState(null);

  const lines = plant?.lines ?? [];
  const pending = commands?.find((c) => c.status === "pending") ?? null;
  const latest = commands?.[0] ?? null;
  // After a reset the room starts clean: the last decision shows only if it came after it.
  const resetAt = [...(audit?.entries ?? [])].reverse().find((e) => e.type === "plant.scenario" && e.kind === "reset")?.at ?? "";
  const current = pending ?? (latest && latest.status !== "cancelled" && latest.createdAt > resetAt ? latest : null);

  // A new proposal takes the chart to its line; otherwise the operator's choice holds.
  useEffect(() => setChosenLine(null), [pending?.id]);
  const worst = [...lines].sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status])[0];
  const focusId = chosenLine ?? pending?.line ?? (worst && worst.status !== "normal" ? worst.id : latest?.line) ?? "L3";
  const focus = lines.find((l) => l.id === focusId);

  return (
    <>
      <TitleRow session={session} authError={authError} plantError={plantError} />

      <div className="lines" role="tablist" aria-label="Lines">
        {lines.map((line) => (
          <LineTab key={line.id} line={line} selected={line.id === focusId} onSelect={() => setChosenLine(line.id)} />
        ))}
      </div>

      <div className="grid">
        <section className="panel span-5 decision" aria-labelledby="decision-title">
          <Decision command={current} lines={lines} session={session} onChange={refreshAll} />
        </section>
        <section className="panel span-7" aria-labelledby="chart-title">
          {focus && plant && (
            <IncidentChart line={focus} thresholds={plant.thresholds} audit={audit?.entries ?? []} commands={commands ?? []} onStage={refreshAll} />
          )}
        </section>
      </div>

      <section className="panel trail" aria-labelledby="audit-title">
        <AuditTrail audit={audit} />
      </section>
    </>
  );
}

function TitleRow({ session, authError, plantError }) {
  return (
    <div className="title-row">
      <div>
        <h1>
          Riverbend control room
          {AUTH_MODE === "rehearsal" && (
            <span className="pill warn mode-tag" title="Sign-ins come from a stand-in realm on this machine, not TideCloak.">
              Rehearsal
            </span>
          )}
        </h1>
        {plantError && <p className="error-line">{plantError} Start it with `npm run demo`.</p>}
        {authError && <p className="error-line">{authError}</p>}
      </div>
      <div className="acting">
        {AUTH_MODE === "rehearsal" ? (
          <div className="switcher" role="group" aria-label="Act as">
            {auth.personas.map((p) => (
              <button key={p} aria-pressed={session?.username === p} onClick={() => auth.login(p)}>
                {cap(p)}
                <small>{p === "jo" ? "Admin" : "Operator"}</small>
              </button>
            ))}
          </div>
        ) : session ? (
          <div className="identity">
            <strong>{cap(session.username)}</strong>
            <span className={session.isOperator ? "" : "neg"}>{session.isOperator ? "Operator" : "Not an operator"}</span>
          </div>
        ) : (
          session === null && (
            <button className="btn primary" onClick={() => auth.login()}>
              Sign in with TideCloak
            </button>
          )
        )}
      </div>
    </div>
  );
}

function LineTab({ line, selected, onSelect }) {
  return (
    <button className={`line-tab ${line.status}`} role="tab" aria-selected={selected} onClick={onSelect}>
      <span className="name">{line.name}</span>
      <span className="value">
        {kpa(line.pressureKpa)}
        <small>kPa</small>
      </span>
      <span className="flags">
        {line.status === "alarm" && <span className="pill warn">Alarm</span>}
        {line.status === "trip" && <span className="pill neg">Above trip</span>}
        {line.pumps === "stopped" && <span className="pill pos">Pumps stopped</span>}
      </span>
    </button>
  );
}

const NOTE = {
  "command.proposed": ["Sentinel proposed", "Proposed"],
  "execute.refused": ["AI execute refused", "Refused"],
  "command.executed": ["Command ran", "Ran"],
  "command.rejected": ["Rejected", "Rejected"],
};

function IncidentChart({ line, thresholds, audit, commands, onStage }) {
  const ref = useRef(null);
  const history = line.history;
  const commandLine = useMemo(() => Object.fromEntries(commands.map((c) => [c.id, c.line])), [commands]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.Charts || history.length < 2) return;
    const start = history[0].at;
    const indexOf = (at) => {
      let i = history.findIndex((h) => h.at > at);
      if (i === -1) i = history.length - 1;
      return Math.max(0, i - 1);
    };
    const annotations = audit
      .filter((e) => e.at >= start && commandLine[e.commandId] === line.id)
      .filter((e) => NOTE[e.type] || e.type === "approval.recorded")
      .slice(-5)
      .map((e) => {
        const [label, short] = NOTE[e.type] ?? [`${actorName(e.actor)} approved`, actorName(e.actor)];
        return { at: indexOf(e.at), label, short };
      });

    // Charts.line watches its element for resizes; draw into a fresh child each second so nothing piles up.
    const host = document.createElement("div");
    host.className = "chart";
    el.replaceChildren(host);
    window.Charts.line(host, {
      labels: history.map((h) => clock(h.at)),
      series: [{ name: `${line.name} pressure`, values: history.map((h) => h.kpa) }],
      format: (v) => `${kpa(v)} kPa`,
      tickFormat: (v) => kpa(v),
      yTicks: [0, 200, 400, 600, 800],
      height: () => (window.innerWidth < 760 ? 200 : 300),
      reference: [
        { value: thresholds.tripKpa, label: `Trip ${thresholds.tripKpa}` },
        { value: thresholds.alarmKpa, label: `Alarm ${thresholds.alarmKpa}` },
      ],
      annotations,
    });
  }, [history, audit, commandLine, line.id, line.name, thresholds]);

  return (
    <>
      <header>
        <h2 id="chart-title">{line.name} pressure</h2>
        <div className="header-actions">
          <button className="text-btn" onClick={() => controller.scenario({ kind: "pressure-spike", line: line.id }, "demo-staging").then(onStage)}>
            Stage a spike
          </button>
          <button className="text-btn" onClick={() => controller.scenario({ kind: "reset" }, "demo-staging").then(onStage)}>
            Reset
          </button>
        </div>
      </header>
      <div ref={ref} />
    </>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M21 12v2" />
    </svg>
  );
}

function Decision({ command, lines, session, onChange }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  useEffect(() => setNote(null), [command?.id]);

  if (!command) {
    return (
      <>
        <header>
          <h2 id="decision-title">Nothing to decide</h2>
        </header>
        <div className="quiet">
          <Lock approvals={[]} required={2} state="idle" />
        </div>
      </>
    );
  }

  const pending = command.status === "pending";
  const mine = session && command.approvals.some((a) => a.sub === session.sub);
  const evidence = command.evidence ?? [];
  const atProposal = evidence.at(-1)?.kpa;
  const rate = evidence.length > 1 ? (evidence.at(-1).kpa - evidence[0].kpa) / (evidence.length - 1) : null;
  const line = lines.find((l) => l.id === command.line);

  const act = async (fn, okText) => {
    setBusy(true);
    try {
      const res = await fn();
      setNote(res.ok ? { kind: "ok", text: okText } : { kind: "bad", text: `Refused: ${res.data?.error ?? `status ${res.status}`}` });
    } catch {
      setNote({ kind: "bad", text: "The controller did not answer." });
    } finally {
      setBusy(false);
      onChange();
    }
  };

  const state = pending ? "pending" : command.status === "executed" ? "ran" : "closed";
  return (
    <>
      <header>
        <h2 id="decision-title">{pending ? "Waiting for two operators" : "Last decision"}</h2>
        <span className="meta num">
          Sentinel · {clock(command.createdAt)}
        </span>
      </header>
      <h3>
        {cap(ACTION[command.action] ?? command.actionLabel)} on {line?.name ?? command.line}
      </h3>
      {atProposal != null && (
        <p className="proof num">
          <strong>{kpa(atProposal)} kPa</strong>
          {rate != null && <span>{signed(rate)} kPa/s</span>}
        </p>
      )}

      <Lock approvals={command.approvals} required={command.requiredApprovals} state={state} />

      {pending ? (
        <div className="actions">
          {!session ? (
            <span className="muted">{AUTH_MODE === "tide" ? "Sign in as an operator to approve." : "Pick who you are, top right."}</span>
          ) : (
            <>
              <button className="btn primary big" disabled={busy} onClick={() => act(() => controller.approve(command.id), "Approved.")}>
                {mine ? "Approve again" : "Approve"}
              </button>
              {session.isOperator && (
                <button className="btn danger big" disabled={busy} onClick={() => act(() => controller.reject(command.id, "Rejected from the control room"), "Rejected.")}>
                  Reject
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <p className={`outcome ${state}`}>
          {command.status === "executed"
            ? `Ran at ${clock(command.executedAt)}`
            : command.status === "cancelled"
              ? "Cancelled"
              : `Rejected by ${cap(command.rejectedBy?.username)}`}
        </p>
      )}
      {note && (pending || note.kind === "bad") && <p className={`note ${note.kind}`}>{note.text}</p>}
    </>
  );
}

/** The two keyholes. Each fills with the operator who turned it. */
function Lock({ approvals, required, state }) {
  return (
    <div className={`lock ${state}`}>
      {Array.from({ length: required }, (_, i) => {
        const a = approvals[i];
        return (
          <div key={i} className={a ? "hole on" : "hole"}>
            <span className="slot">{a && <KeyIcon />}</span>
            {(a || state === "pending") && <strong>{a ? cap(a.username) : "Waiting"}</strong>}
            {a && <time className="num">{clock(a.at)}</time>}
          </div>
        );
      })}
    </div>
  );
}

/** Two-word reasons for the trail, from the controller's full ones. */
function why(e) {
  const r = e.reason ?? "";
  if (e.type === "approval.duplicate") return "Same operator";
  if (e.type === "execute.refused") return "Needs 2 operators";
  if (/No operator token/.test(r)) return "No sign-in";
  if (/not a valid/.test(r)) return String(e.actor?.claimed ?? "").startsWith("forged") ? "Forged pass" : "Invalid pass";
  if (/does not hold/.test(r)) return "Not an operator";
  return r;
}

function describe(e) {
  switch (e.type) {
    case "plant.scenario":
      return e.kind === "reset" ? ["Plant reset", "", "Reset"] : [`Pressure spike staged on ${e.line}`, "", "Demo"];
    case "command.proposed":
      return [`Proposed: ${ACTION[e.action] ?? e.action} on ${e.line}`, "info", "Proposed"];
    case "execute.refused":
      return ["Tried to run it directly", "neg", "Refused"];
    case "approval.refused":
      return ["Tried to approve", "neg", "Refused"];
    case "rejection.refused":
      return ["Tried to reject", "neg", "Refused"];
    case "approval.recorded":
      return ["Approved", "info", `${e.approvals} of ${e.required}`];
    case "approval.duplicate":
      return ["Approved again", "warn", "Not counted"];
    case "command.executed":
      return [`Ran: ${ACTION[e.action] ?? e.action} on ${e.line}`, "pos", "Ran"];
    case "command.rejected":
      return ["Rejected", "", "Rejected"];
    case "command.cancelled":
      return ["Cancelled", "", "Cancelled"];
    case "ops-log.added":
      return [`“${e.text}”`, "", "Log note"];
    default:
      return [e.type, "", ""];
  }
}

function who(e) {
  if (e.type === "command.executed") return e.approvedBy.map(cap).join(" + ");
  const a = e.actor ?? {};
  if (a.username) return cap(a.username);
  const c = String(a.claimed ?? "");
  if (c.startsWith("forged pass for ")) return cap(c.slice(16));
  if (c.startsWith("demo")) return "Demo";
  if (c.includes("maintenance log")) return "Log";
  return cap(c) || "Unknown";
}

function AuditTrail({ audit }) {
  const [all, setAll] = useState(false);
  const entries = [...(audit?.entries ?? [])].reverse();
  const shown = all ? entries : entries.slice(0, ROWS);
  return (
    <>
      <header>
        <h2 id="audit-title">Audit trail</h2>
        {audit && (
          <span className={`pill ${audit.chain.ok ? "pos" : "neg"}`} title="Each entry carries the hash of the one before it, so an edit anywhere breaks the chain.">
            {audit.chain.ok ? `Hash chain intact · ${entries.length}` : `Chain broken at ${audit.chain.brokenAt}`}
          </span>
        )}
      </header>
      {entries.length === 0 ? (
        <p className="muted">Nothing recorded yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Result</th>
                <th>Event</th>
                <th>Who</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const [text, tone, result] = describe(e);
                const reason = e.type.endsWith(".refused") || e.type === "approval.duplicate" ? why(e) : "";
                return (
                  <tr key={e.seq} className={tone === "neg" ? "refused" : ""}>
                    <td className="time num">{clock(e.at)}</td>
                    <td className="state">{result && <span className={`pill ${tone}`}>{result}</span>}</td>
                    <td className="event" title={text}>
                      {text}
                    </td>
                    <td className="who">{who(e)}</td>
                    <td className="why">{reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {entries.length > ROWS && (
        <div className="panel-foot">
          <button className="text-btn" onClick={() => setAll(!all)}>
            {all ? "Show the latest" : `Show all ${entries.length}`}
          </button>
        </div>
      )}
    </>
  );
}
