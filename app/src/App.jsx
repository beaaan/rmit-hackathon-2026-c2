import { useCallback, useEffect, useState } from "react";
import { AUTH_MODE, auth } from "./auth.js";
import { CONTROLLER_URL, controller } from "./controller.js";

const TIDECLOAK_URL = __TIDECLOAK_URL__;

function usePoll(load, ms) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const res = await load();
      setData(res.data);
      setError(null);
    } catch {
      setError(`Can't reach the plant controller at ${CONTROLLER_URL}`);
    }
  }, [load]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, ms);
    return () => clearInterval(timer);
  }, [refresh, ms]);
  return [data, error, refresh];
}

const time = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

export default function App() {
  const [session, setSession] = useState(undefined);
  const [authError, setAuthError] = useState(null);
  const [plant, plantError] = usePoll(controller.state, 1000);
  const [commands, , refreshCommands] = usePoll(controller.commands, 1000);
  const [audit, , refreshAudit] = usePoll(controller.audit, 1500);

  useEffect(() => {
    auth.init().then(setSession, (err) => {
      setAuthError(err.message);
      setSession(null);
    });
  }, []);

  const refreshAll = () => Promise.all([refreshCommands(), refreshAudit()]);

  return (
    <div className="page">
      <Header session={session} />
      {authError && <div className="banner error">{authError}</div>}
      {plantError && <div className="banner error">{plantError}. Is it running?</div>}
      {AUTH_MODE === "rehearsal" && (
        <div className="banner rehearsal">
          Rehearsal mode: tokens come from a stand-in realm generated on this machine, not from TideCloak.
          Use it to practise the story. Put <code>tidecloak.json</code> in <code>controller/</code> for the real demo.
        </div>
      )}

      <main className="grid">
        <section className="panel plant">
          <div className="panel-head">
            <h2>Plant</h2>
            <span className="muted">Riverbend Water Treatment · synthetic data</span>
          </div>
          <div className="lines">
            {plant?.lines.map((line) => (
              <LineCard key={line.id} line={line} thresholds={plant.thresholds} />
            ))}
          </div>
          <Staging onDone={refreshAll} />
        </section>

        <section className="panel proposals">
          <div className="panel-head">
            <h2>Proposals from Sentinel</h2>
            <span className="muted">The AI proposes. Two operators decide.</span>
          </div>
          {!commands?.length && (
            <p className="empty">No proposals yet. Sentinel is watching the plant.</p>
          )}
          {commands?.map((command) => (
            <CommandCard key={command.id} command={command} session={session} onChange={refreshAll} />
          ))}
        </section>

        <section className="panel audit">
          <div className="panel-head">
            <h2>Audit trail</h2>
            {audit && (
              <span className={`chip ${audit.chain.ok ? "ok" : "bad"}`}>
                {audit.chain.ok ? "Hash chain intact" : `Chain broken at #${audit.chain.brokenAt}`}
              </span>
            )}
          </div>
          <AuditList entries={audit?.entries ?? []} />
        </section>
      </main>
    </div>
  );
}

function Header({ session }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="mark" aria-hidden>
          II
        </span>
        <div>
          <h1>Two-Person Rule</h1>
          <p className="muted">An AI can propose plant commands. Only two operators together can run one.</p>
        </div>
      </div>
      <div className="who">
        {session === undefined ? (
          <span className="muted">Signing in…</span>
        ) : AUTH_MODE === "rehearsal" ? (
          <div className="personas" role="group" aria-label="Rehearsal persona">
            {auth.personas.map((p) => (
              <button
                key={p}
                className={session?.username === p ? "persona active" : "persona"}
                onClick={() => auth.login(p)}
              >
                {p}
              </button>
            ))}
          </div>
        ) : session ? (
          <button className="ghost" onClick={auth.logout}>
            Sign out
          </button>
        ) : (
          <button className="primary" onClick={() => auth.login()}>
            Sign in with TideCloak
          </button>
        )}
        {session && (
          <div className="identity">
            <strong>{session.username}</strong>
            <span className={`chip ${session.isOperator ? "ok" : ""}`}>
              {session.isOperator ? "plant-operator" : "not an operator"}
            </span>
          </div>
        )}
        {AUTH_MODE === "tide" && TIDECLOAK_URL && (
          <a className="muted small" href={`${TIDECLOAK_URL}/tide-console/`} target="_blank" rel="noreferrer">
            TideCloak console ↗
          </a>
        )}
      </div>
    </header>
  );
}

function LineCard({ line, thresholds }) {
  return (
    <article className={`line ${line.status}`}>
      <div className="line-head">
        <h3>{line.name}</h3>
        <span className={`chip ${line.status}`}>{line.status}</span>
      </div>
      <div className="reading">
        <span className="value">{line.pressureKpa.toFixed(0)}</span>
        <span className="unit">kPa</span>
      </div>
      <Sparkline history={line.history} thresholds={thresholds} />
      <dl className="facts">
        <div>
          <dt>Pumps</dt>
          <dd className={line.pumps === "running" ? "" : "stopped"}>{line.pumps}</dd>
        </div>
        <div>
          <dt>Inlet valve</dt>
          <dd>{line.inletValve}</dd>
        </div>
      </dl>
    </article>
  );
}

function Sparkline({ history, thresholds, height = 64 }) {
  const width = 240;
  const min = 100;
  const max = 800;
  const y = (kpa) => height - ((kpa - min) / (max - min)) * height;
  const points = history.map((h, i) => `${(i / Math.max(1, history.length - 1)) * width},${y(h.kpa).toFixed(1)}`);
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <line x1="0" x2={width} y1={y(thresholds.tripKpa)} y2={y(thresholds.tripKpa)} className="trip" />
      <line x1="0" x2={width} y1={y(thresholds.alarmKpa)} y2={y(thresholds.alarmKpa)} className="alarm" />
      <polyline points={points.join(" ")} className="trace" />
    </svg>
  );
}

function Staging({ onDone }) {
  const run = async (body) => {
    await controller.scenario(body, "demo-staging");
    onDone();
  };
  return (
    <div className="staging">
      <span className="muted small">Demo staging</span>
      <button className="ghost" onClick={() => run({ kind: "pressure-spike", line: "L3" })}>
        Start Line 3 pressure spike
      </button>
      <button className="ghost" onClick={() => run({ kind: "reset" })}>
        Reset plant
      </button>
    </div>
  );
}

function CommandCard({ command, session, onChange }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const approvedByMe = session && command.approvals.some((a) => a.sub === session.sub);
  const pending = command.status === "pending";

  const act = async (fn, label) => {
    setBusy(true);
    try {
      const res = await fn();
      setFeedback(
        res.ok
          ? { kind: "ok", text: label }
          : { kind: "bad", text: `Controller refused (${res.status}): ${res.data?.error ?? "unknown error"}` },
      );
    } catch {
      setFeedback({ kind: "bad", text: "Couldn't reach the controller" });
    } finally {
      setBusy(false);
      onChange();
    }
  };

  return (
    <article className={`command ${command.status}`}>
      <div className="command-head">
        <div>
          <h3>
            {command.actionLabel} · {command.line}
          </h3>
          <p className="muted small">
            {command.id} · proposed by <strong>{command.proposedBy}</strong> (AI, no credentials) at{" "}
            {time(command.createdAt)}
          </p>
        </div>
        <span className={`chip ${command.status}`}>{command.status}</span>
      </div>

      <p className="reason">{command.reason}</p>

      <div className="approvals">
        {Array.from({ length: command.requiredApprovals }, (_, i) => {
          const a = command.approvals[i];
          return (
            <div key={i} className={`slot ${a ? "filled" : ""}`}>
              <span className="dot" />
              {a ? (
                <span>
                  <strong>{a.username}</strong> <span className="muted small">{time(a.at)}</span>
                </span>
              ) : (
                <span className="muted">Operator {i + 1}</span>
              )}
            </div>
          );
        })}
        <span className="count">
          {command.approvals.length} of {command.requiredApprovals}
        </span>
      </div>

      {command.status === "executed" && (
        <p className="outcome ok">
          Executed at {time(command.executedAt)}, approved by {command.approvals.map((a) => a.username).join(" and ")}.
        </p>
      )}
      {command.status === "rejected" && (
        <p className="outcome bad">
          Rejected by {command.rejectedBy.username}
          {command.rejectedBy.note ? `: ${command.rejectedBy.note}` : ""}.
        </p>
      )}

      {pending && (
        <div className="actions">
          {!session ? (
            <span className="muted">Sign in as an operator to approve.</span>
          ) : session.isOperator ? (
            <>
              <button className="primary" disabled={busy} onClick={() => act(() => controller.approve(command.id), "Approval recorded")}>
                {approvedByMe ? "Approve again" : "Approve"}
              </button>
              <button
                className="ghost danger"
                disabled={busy}
                onClick={() => act(() => controller.reject(command.id, "Rejected from operator console"), "Rejected")}
              >
                Reject
              </button>
              {approvedByMe && <span className="muted small">You approved. Waiting for a second operator.</span>}
            </>
          ) : (
            <>
              <span className="muted">You are not a plant operator.</span>
              <button className="ghost" disabled={busy} onClick={() => act(() => controller.approve(command.id), "Approval recorded")}>
                Try approving anyway
              </button>
            </>
          )}
        </div>
      )}
      {feedback && <p className={`feedback ${feedback.kind}`}>{feedback.text}</p>}
    </article>
  );
}

function describe(entry) {
  const who = entry.actor?.username ?? entry.actor?.claimed ?? entry.actor?.sub ?? "";
  switch (entry.type) {
    case "plant.scenario":
      return entry.kind === "reset" ? "Plant reset" : `Pressure spike staged on ${entry.line}`;
    case "command.proposed":
      return `${who} proposed ${entry.action.replace(/_/g, " ")} on ${entry.line}`;
    case "execute.refused":
      return `${who} tried to execute ${entry.commandId} directly. Refused: ${entry.reason}`;
    case "approval.refused":
      return `${who ? `${who}'s approval` : "Approval"} refused: ${entry.reason}`;
    case "rejection.refused":
      return `${who ? `${who}'s rejection` : "Rejection"} refused: ${entry.reason}`;
    case "approval.recorded":
      return `${who} approved ${entry.commandId} (${entry.approvals} of ${entry.required})`;
    case "approval.duplicate":
      return `${who} approved ${entry.commandId} again. Not counted (still ${entry.approvals})`;
    case "command.executed":
      return `Executed ${entry.action.replace(/_/g, " ")} on ${entry.line}, approved by ${entry.approvedBy.join(" and ")}`;
    case "command.rejected":
      return `${who} rejected ${entry.commandId}`;
    default:
      return entry.type;
  }
}

function tone(type) {
  if (type.endsWith(".refused") || type === "approval.duplicate") return "bad";
  if (type === "command.executed" || type === "approval.recorded") return "ok";
  return "";
}

function AuditList({ entries }) {
  if (!entries.length) return <p className="empty">Nothing yet.</p>;
  return (
    <ol className="audit-list">
      {[...entries].reverse().map((e) => (
        <li key={e.seq} className={tone(e.type)}>
          <span className="seq">#{e.seq}</span>
          <span className="at">{time(e.at)}</span>
          <span className="what">{describe(e)}</span>
          <span className="hash" title={`hash ${e.hash}\nprev ${e.prevHash}`}>
            {e.hash.slice(0, 8)}
          </span>
        </li>
      ))}
    </ol>
  );
}
