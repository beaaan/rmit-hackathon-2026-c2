import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AUTH_MODE, auth } from "./auth.js";
import { CONTROLLER_URL, controller } from "./controller.js";

const TIDECLOAK_URL = __TIDECLOAK_URL__;
const SEVERITY = { normal: 0, alarm: 1, trip: 2 };
const HISTORY_ROWS = 4;
const ACTION = { shutdown_pumps: "shut down pumps", restart_pumps: "restart pumps", close_inlet_valve: "close inlet valve" };

function usePoll(load, ms) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const res = await load();
      setData(res.data);
      setError(null);
    } catch {
      setError(`Can't reach the plant controller at ${CONTROLLER_URL}.`);
    }
  }, [load]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, ms);
    return () => clearInterval(timer);
  }, [refresh, ms]);
  return [data, error, refresh];
}

const clock = (iso) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const kpa = (v) => Math.round(v).toLocaleString("en-AU");
const signed = (v, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;
const actorName = (actor) => actor?.username ?? actor?.claimed ?? "unknown";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [authError, setAuthError] = useState(null);
  const [plant, plantError] = usePoll(controller.state, 1000);
  const [commands, , refreshCommands] = usePoll(controller.commands, 1000);
  const [audit, , refreshAudit] = usePoll(controller.audit, 1000);
  const [chosenLine, setChosenLine] = useState(null);

  useEffect(() => {
    auth.init().then(setSession, (err) => {
      setAuthError(err.message);
      setSession(null);
    });
  }, []);

  const lines = plant?.lines ?? [];
  const pending = commands?.find((c) => c.status === "pending") ?? null;
  const latest = commands?.[0] ?? null;

  // A new proposal takes the chart to its line; otherwise the operator's choice holds.
  useEffect(() => setChosenLine(null), [pending?.id]);
  const worst = [...lines].sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status])[0];
  const focusId =
    chosenLine ?? pending?.line ?? (worst && worst.status !== "normal" ? worst.id : latest?.line) ?? "L3";
  const focus = lines.find((l) => l.id === focusId);

  const refreshAll = () => Promise.all([refreshCommands(), refreshAudit()]);

  return (
    <div className="app">
      <Rail session={session} />
      <main className="canvas">
        <TitleRow session={session} lines={lines} pending={pending} latest={latest} authError={authError} plantError={plantError} />

        <div className="lines" role="tablist" aria-label="Lines">
          {lines.map((line) => (
            <LineTab key={line.id} line={line} selected={line.id === focusId} onSelect={() => setChosenLine(line.id)} />
          ))}
        </div>

        <div className="grid">
          <section className="panel span-8" aria-labelledby="chart-title">
            {focus && plant && (
              <IncidentChart line={focus} thresholds={plant.thresholds} audit={audit?.entries ?? []} commands={commands ?? []} onStage={refreshAll} />
            )}
          </section>
          <section className="panel span-4 decision" aria-labelledby="decision-title">
            <Decision command={pending ?? latest} lines={lines} session={session} onChange={refreshAll} />
          </section>
        </div>

        <div className="grid">
          <section className="panel span-8" aria-labelledby="audit-title">
            <AuditTrail audit={audit} rows={4 + Math.max(1, Math.min(commands?.length ?? 0, HISTORY_ROWS))} />
          </section>
          <div className="span-4 stack">
            <section className="panel" aria-labelledby="history-title">
              <History commands={commands ?? []} />
            </section>
            <section className="panel" aria-labelledby="rules-title">
              <header>
                <h2 id="rules-title">How a command runs here</h2>
              </header>
              <ul className="rules">
                <li>
                  <strong>Sentinel proposes.</strong> It holds no account, token or key.
                </li>
                <li>
                  <strong>Two different operators approve.</strong> The same person twice counts once.
                </li>
                <li>
                  <strong>Operators are set in TideCloak,</strong> and changing who is one needs 2 of 3 admins.
                </li>
                <li>
                  <strong>The controller holds only a public key.</strong> Nothing here can sign an approval.
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Rail({ session }) {
  return (
    <nav className="rail" aria-label="Two-Person Rule">
      <svg className="mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" role="img" aria-label="Two-Person Rule">
        <title>Two-Person Rule</title>
        <circle cx="10" cy="9" r="5" />
        <path d="M10 14v14M10 22h4M10 26h3" />
        <circle cx="22" cy="9" r="5" />
        <path d="M22 14v14M22 22h-4M22 26h-3" />
      </svg>
      <a className="rail-item" href="/" aria-current="page">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M3 12a9 9 0 1 1 18 0" />
          <path d="M12 12l4.5-4.5" />
          <path d="M3 17h18" />
        </svg>
        <span className="tip">Control room</span>
      </a>
      <div className="bottom">
        {AUTH_MODE === "tide" && TIDECLOAK_URL && (
          <a className="rail-item" href={`${TIDECLOAK_URL}/tide-console/`} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="tip">TideCloak approvals</span>
          </a>
        )}
        {AUTH_MODE === "tide" && session && (
          <button className="rail-item" onClick={auth.logout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            </svg>
            <span className="tip">Sign out</span>
          </button>
        )}
      </div>
    </nav>
  );
}

function finding(lines, pending, latest) {
  if (pending) {
    const line = lines.find((l) => l.id === pending.line);
    const n = pending.approvals.length;
    return {
      tone: line?.status ?? "normal",
      lead: `${line?.name ?? pending.line} is at ${line ? kpa(line.pressureKpa) : "–"} kPa.`,
      rest: ` Sentinel proposes: ${pending.actionLabel.toLowerCase()}. ${n} of ${pending.requiredApprovals} operators have approved.`,
    };
  }
  const hot = lines.filter((l) => l.status !== "normal");
  if (hot.length) {
    const l = hot.sort((a, b) => b.pressureKpa - a.pressureKpa)[0];
    return { tone: l.status, lead: `${l.name} is at ${kpa(l.pressureKpa)} kPa,`, rest: ` above the ${l.status === "trip" ? "trip" : "alarm"} limit.` };
  }
  if (latest?.status === "executed") {
    return {
      tone: "normal",
      lead: `${latest.actionLabel} on ${latest.line} ran at ${clock(latest.executedAt)},`,
      rest: ` approved by ${latest.approvals.map((a) => a.username).join(" and ")}. All lines are within limits.`,
    };
  }
  return { tone: "normal", lead: "All three lines are within limits.", rest: " Nothing is waiting for a decision." };
}

function TitleRow({ session, lines, pending, latest, authError, plantError }) {
  const f = finding(lines, pending, latest);
  return (
    <div className="title-row">
      <div>
        <h1>Riverbend control room</h1>
        {lines.length > 0 && (
          <p className={`finding ${f.tone}`}>
            <strong>{f.lead}</strong>
            {f.rest}
          </p>
        )}
        {plantError && <p className="error-line">{plantError} Start it with `npm run demo`.</p>}
        {authError && <p className="error-line">{authError}</p>}
        {AUTH_MODE === "rehearsal" && (
          <p className="notice">Rehearsal: tokens come from a stand-in realm on this machine, not from TideCloak.</p>
        )}
      </div>
      <div className="acting">
        {AUTH_MODE === "rehearsal" ? (
          <div className="switcher" role="group" aria-label="Act as">
            <span className="label">Act as</span>
            {auth.personas.map((p) => (
              <button key={p} aria-pressed={session?.username === p} onClick={() => auth.login(p)}>
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        ) : (
          session === null && (
            <button className="btn primary" onClick={() => auth.login()}>
              Sign in with TideCloak
            </button>
          )
        )}
        {session && (
          <div className="identity">
            <strong>{session.username}</strong>
            <span>{session.isOperator ? "Plant operator" : "Not a plant operator"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LineTab({ line, selected, onSelect }) {
  const stopped = line.pumps === "stopped";
  return (
    <button className={`line-tab ${line.status}`} role="tab" aria-selected={selected} onClick={onSelect}>
      <span className="top">
        <span className="name">{line.name}</span>
        {line.status === "alarm" && <span className="pill warn">Alarm</span>}
        {line.status === "trip" && <span className="pill neg">Above trip</span>}
      </span>
      <span className="value">
        {kpa(line.pressureKpa)}
        <small>kPa</small>
      </span>
      <span className="equip">
        Pumps <span className={stopped ? "off" : ""}>{line.pumps}</span> · inlet {line.inletValve}
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

  const first = history[0]?.kpa ?? 0;
  const last = history.at(-1)?.kpa ?? 0;
  const recent = history.slice(-6);
  const rate = recent.length > 1 ? (recent.at(-1).kpa - recent[0].kpa) / (recent.length - 1) : 0;

  return (
    <>
      <header>
        <h2 id="chart-title">{line.name} pressure, last {history.length} seconds</h2>
        <div className="header-actions">
          <button className="text-btn" onClick={() => controller.scenario({ kind: "pressure-spike", line: line.id }, "demo-staging").then(onStage)}>
            Stage a spike
          </button>
          <button className="text-btn" onClick={() => controller.scenario({ kind: "reset" }, "demo-staging").then(onStage)}>
            Reset plant
          </button>
        </div>
      </header>
      <div ref={ref} />
      <div className="chart-foot num">
        <span>
          {kpa(first)} kPa at {history[0] ? clock(history[0].at) : "–"}, now {kpa(last)} kPa
        </span>
        <span>{signed(rate)} kPa/s over the last 5 s</span>
      </div>
    </>
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
          <h2 id="decision-title">Waiting for a decision</h2>
        </header>
        <div className="quiet">
          <strong>Nothing to decide.</strong>
          <span>Sentinel proposes a command when a line passes the 600 kPa alarm limit and keeps rising.</span>
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
      setNote(res.ok ? { kind: "ok", text: okText } : { kind: "bad", text: `Refused by the controller (${res.status}): ${res.data?.error ?? "no reason given"}` });
    } catch {
      setNote({ kind: "bad", text: "The controller did not answer." });
    } finally {
      setBusy(false);
      onChange();
    }
  };

  return (
    <>
      <header>
        <h2 id="decision-title">{pending ? "Waiting for two operators" : "Last decision"}</h2>
        <span className="meta num">
          {command.approvals.length} of {command.requiredApprovals} approved
        </span>
      </header>
      <h3>
        {command.actionLabel} on {line?.name ?? command.line}
      </h3>
      <p className="by">
        {command.id} · proposed by {command.proposedBy} at {clock(command.createdAt)} · an AI with no credentials
      </p>
      <p className="reason">{command.reason}</p>

      {atProposal != null && (
        <dl className="evidence">
          <div>
            <dt>When proposed</dt>
            <dd>{kpa(atProposal)} kPa</dd>
          </div>
          {rate != null && (
            <div>
              <dt>Rising</dt>
              <dd>{signed(rate)} kPa/s</dd>
            </div>
          )}
          {line && (
            <div>
              <dt>Now</dt>
              <dd>{kpa(line.pressureKpa)} kPa</dd>
            </div>
          )}
        </dl>
      )}

      <div className="keys">
        {Array.from({ length: command.requiredApprovals }, (_, i) => {
          const a = command.approvals[i];
          return (
            <div key={i} className={a ? "key turned" : "key empty"}>
              <span className="slot">Operator {i + 1}</span>
              <span>
                <strong>{a ? a.username : "Not yet"}</strong>
                {a && <time> · {clock(a.at)}</time>}
              </span>
            </div>
          );
        })}
      </div>

      {pending ? (
        <div className="actions">
          {!session ? (
            <span className="muted">{AUTH_MODE === "tide" ? "Sign in as an operator to approve." : "Choose who to act as."}</span>
          ) : session.isOperator ? (
            <>
              <button className="btn primary" disabled={busy} onClick={() => act(() => controller.approve(command.id), "Your approval is recorded.")}>
                {mine ? "Approve again" : "Approve"}
              </button>
              <button className="btn danger" disabled={busy} onClick={() => act(() => controller.reject(command.id, "Rejected from the control room"), "Rejected.")}>
                Reject
              </button>
            </>
          ) : (
            <>
              <span className="muted">You are not a plant operator.</span>
              <button className="btn" disabled={busy} onClick={() => act(() => controller.approve(command.id), "Your approval is recorded.")}>
                Try to approve
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="outcome">
          {command.status === "executed"
            ? `Ran at ${clock(command.executedAt)} after ${command.approvals.map((a) => a.username).join(" and ")} approved.`
            : `Rejected by ${command.rejectedBy?.username}${command.rejectedBy?.note ? `: ${command.rejectedBy.note}` : ""}.`}
        </p>
      )}
      {mine && pending && !note && <p className="note">You approved. It runs when a second operator does.</p>}
      {note && <p className={`note ${note.kind}`}>{note.text}</p>}
    </>
  );
}

function describe(e) {
  switch (e.type) {
    case "plant.scenario":
      return { text: e.kind === "reset" ? "Plant reset for the demo" : `Spike staged on ${e.line} for the demo`, state: ["", "Staging"] };
    case "command.proposed":
      return { text: `Proposed: ${ACTION[e.action] ?? e.action} on ${e.line}`, state: ["", "Proposed"] };
    case "execute.refused":
      return { text: `Called execute on ${e.commandId} directly`, sub: e.reason, state: ["neg", "Refused"] };
    case "approval.refused":
      return { text: `Tried to approve ${e.commandId}`, sub: e.reason, state: ["neg", "Refused"] };
    case "rejection.refused":
      return { text: `Tried to reject ${e.commandId}`, sub: e.reason, state: ["neg", "Refused"] };
    case "approval.recorded":
      return { text: `Approved ${e.commandId}`, state: ["", `${e.approvals} of ${e.required}`] };
    case "approval.duplicate":
      return { text: `Approved ${e.commandId} a second time`, sub: `Counted once; still ${e.approvals}`, state: ["warn", "Not counted"] };
    case "command.executed":
      return { text: `Ran: ${ACTION[e.action] ?? e.action} on ${e.line}`, sub: `Approved by ${e.approvedBy.join(" and ")}`, state: ["pos", "Ran"] };
    case "command.rejected":
      return { text: `Rejected ${e.commandId}`, state: ["", "Rejected"] };
    default:
      return { text: e.type, state: ["", ""] };
  }
}

function actorKind(e) {
  if (e.type === "command.executed") return { name: "Controller", kind: "two keys turned" };
  const a = e.actor ?? {};
  if (a.kind === "operator") return { name: a.username, kind: "verified operator" };
  if (a.kind === "signed-in") return { name: a.username ?? a.sub?.slice(0, 8), kind: "signed in, no role" };
  return { name: a.claimed ?? "unknown", kind: "unverified caller" };
}

// Each command row beside the trail is about one audit row tall, so the two columns end level.
function AuditTrail({ audit, rows }) {
  const [all, setAll] = useState(false);
  const entries = [...(audit?.entries ?? [])].reverse();
  const shown = all ? entries : entries.slice(0, rows);
  return (
    <>
      <header>
        <h2 id="audit-title">Audit trail</h2>
        {audit && (
          <span className="meta">
            {audit.chain.ok ? "Hash chain intact" : `Chain broken at entry ${audit.chain.brokenAt}`} · {entries.length} entries
          </span>
        )}
      </header>
      {entries.length === 0 ? (
        <p className="muted">Nothing recorded yet. Every proposal, refusal, approval and command lands here.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Who</th>
                <th>Result</th>
                <th className="hash">Hash</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const d = describe(e);
                const who = actorKind(e);
                return (
                  <tr key={e.seq}>
                    <td className="time num">{clock(e.at)}</td>
                    <td className="event">
                      {d.text}
                      {d.sub && <span className="sub">{d.sub}</span>}
                    </td>
                    <td className="who">
                      {who.name}
                      <span className="sub">{who.kind}</span>
                    </td>
                    <td className="state">{d.state[1] && <span className={`pill ${d.state[0]}`}>{d.state[1]}</span>}</td>
                    <td className="hash" title={`#${e.seq} · ${e.hash}`}>
                      {e.hash.slice(0, 8)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {entries.length > rows && (
        <div className="panel-foot">
          <span className="meta">
            Showing {shown.length} of {entries.length}
          </span>
          <button className="text-btn" onClick={() => setAll(!all)}>
            {all ? "Show the latest" : `Show all ${entries.length}`}
          </button>
        </div>
      )}
    </>
  );
}

function History({ commands }) {
  const rows = commands.slice(0, HISTORY_ROWS);
  return (
    <>
      <header>
        <h2 id="history-title">Commands</h2>
        <span className="meta">{commands.length} since start</span>
      </header>
      {rows.length === 0 ? (
        <p className="muted">No commands proposed yet.</p>
      ) : (
        <ul className="history">
          {rows.map((c) => (
            <li key={c.id}>
              <span className="what">
                {c.actionLabel} · {c.line}
              </span>
              <span className={`pill ${c.status === "executed" ? "pos" : c.status === "pending" ? "warn" : ""}`}>
                {c.status === "executed" ? "Ran" : c.status === "pending" ? `${c.approvals.length} of ${c.requiredApprovals}` : "Rejected"}
              </span>
              <span className="sub num">
                {clock(c.createdAt)} by {c.proposedBy}
                {c.approvals.length > 0 && ` · ${c.approvals.map((a) => a.username).join(", ")}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
