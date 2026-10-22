// The live plant diagram, drawn like a control-room mimic and driven by the controller's own records.
// Top: Line 3's pipe with its pressure gauge and the pump. Middle: the two-key lock, wired to the pump.
// Bottom: a signal line from each of the five who can try to act, ending over their own controls.
// Every attempt in the audit trail travels up its sender's line: refused ones bounce off the lock, an
// operator's approval drops into a keyhole, and with two keys in, the stop command runs to the pump.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { kpa } from "./shared.js";

export const ACTORS = ["sentinel", "attacker", "jo", "kim", "raj"];
const PORT_LABEL = { sentinel: "Sentinel", attacker: "Attacker", jo: "Jo", kim: "Kim", raj: "Raj" };
const GAUGE_MAX = 800;
const TONE = { red: "bad", amber: "warn", blue: "live", green: "ok" };
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Where everything sits on a w × h stage whose actor columns are centred at xs. */
function layout(w, h, xs, oneRow) {
  const s = Math.min(1, Math.max(0.58, w / 1150));
  const pipeY = Math.round(Math.max(46 * s + 26, h * 0.17));
  const lock = { x: xs[2], y: Math.round(h * 0.5), w: 236 * s, h: 124 * s };
  lock.top = lock.y - lock.h / 2;
  lock.bottom = lock.y + lock.h / 2;
  const lane = [h * 0.75, h * 0.81, null, h * 0.81, h * 0.75];
  const portY = h - 14;
  const entry = xs.map((_, i) => lock.x + (i - 2) * 34 * s);
  const r = 14 * s;

  const routes = {};
  ACTORS.forEach((id, i) => {
    const x = xs[i];
    const ex = entry[i];
    if (i === 2 || Math.abs(ex - x) < 1) {
      routes[id] = `M${x},${portY} V${lock.bottom}`;
      return;
    }
    const dir = Math.sign(ex - x);
    const c = Math.min(r, Math.abs(ex - x) / 2);
    const y = lane[i];
    routes[id] = `M${x},${portY} V${y + c} Q${x},${y} ${x + dir * c},${y} H${ex - dir * c} Q${ex},${y} ${ex},${y - c} V${lock.bottom}`;
  });

  const gauge = { x: xs[0], y: pipeY, r: 46 * s };
  const pump = { x: (xs[3] + xs[4]) / 2, y: pipeY, r: 30 * s };
  const c = 16 * s;
  const wire = `M${lock.x + lock.w / 2},${lock.y} H${pump.x - c} Q${pump.x},${lock.y} ${pump.x},${lock.y - c} V${pump.y + pump.r + 6 * s}`;
  const sense = `M${gauge.x},${gauge.y + gauge.r} V${lane[0]}`;
  const trick = `M${xs[1]},${portY - 8} C${xs[1]},${portY - 64 * s} ${xs[0]},${portY - 64 * s} ${xs[0]},${portY - 8}`;
  const keyholes = [-1, 1].map((d) => ({ x: lock.x + d * 46 * s, y: lock.y + 12 * s, r: 23 * s }));
  return { s, w, h, xs, oneRow, pipeY, lock, portY, entry, routes, gauge, pump, wire, sense, trick, keyholes };
}

/** A point on the gauge's 270° sweep, which starts bottom left. */
function onDial(g, v, r = g.r) {
  const a = ((135 + (Math.min(GAUGE_MAX, Math.max(0, v)) / GAUGE_MAX) * 270) * Math.PI) / 180;
  return [g.x + r * Math.cos(a), g.y + r * Math.sin(a)];
}
function dialArc(g, from, to, r) {
  const [x1, y1] = onDial(g, from, r);
  const [x2, y2] = onDial(g, to, r);
  const large = ((to - from) / GAUGE_MAX) * 270 > 180 ? 1 : 0;
  return `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`;
}

/** Which of the five an audit entry came from. */
function sender(e) {
  const u = e.actor?.username;
  if (u === "jo" || u === "kim" || u === "raj") return u;
  const c = String(e.actor?.claimed ?? "");
  if (c === "sentinel") return "sentinel";
  if (c.startsWith("forged")) return "attacker";
  if (e.actor?.kind === "signed-in") return "jo";
  return e.approvals > 1 ? "raj" : "kim";
}

export default function PlantStage({ line, thresholds, cmd, run, anchorsRef }) {
  const wrapRef = useRef(null);
  const [geo, setGeo] = useState(null);
  const [pulses, setPulses] = useState([]);
  const [inflight, setInflight] = useState(0); // approvals still travelling to the lock
  const [hit, setHit] = useState(null); // the lock's latest reaction
  const [flash, setFlash] = useState({}); // ports and the pump, briefly lit
  const seen = useRef(null);
  const nextKey = useRef(0);

  // Line the signal lines up with the actor columns under the stage.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = () => {
      const box = wrap.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const cols = ACTORS.map((id) => anchorsRef?.current?.querySelector(`[data-actor="${id}"]`)?.getBoundingClientRect());
      const oneRow = cols.every((c) => c && Math.abs(c.top - cols[0].top) < 4);
      const xs = oneRow ? cols.map((c) => c.left + c.width / 2 - box.left) : ACTORS.map((_, i) => (box.width * (i + 0.5)) / 5);
      setGeo(layout(box.width, box.height, xs, oneRow));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    if (anchorsRef?.current) ro.observe(anchorsRef.current);
    return () => ro.disconnect();
  }, [anchorsRef]);

  // Play each new audit entry once. Whatever was already there when the page opened stays still.
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(run.map((e) => e.seq));
      return;
    }
    if (!run.length) {
      setPulses([]);
      setInflight(0);
      setHit(null);
      return;
    }
    const lit = (id, tone) => setFlash((f) => ({ ...f, [id]: { tone, n: (f[id]?.n ?? 0) + 1 } }));
    const react = (tone, at) => setHit((h) => ({ tone, at, n: (h?.n ?? 0) + 1 }));
    const send = (pulse) => {
      if (reducedMotion()) return pulse.onLand?.();
      setPulses((p) => [...p, { ...pulse, key: nextKey.current++ }]);
    };
    for (const e of run) {
      if (seen.current.has(e.seq)) continue;
      seen.current.add(e.seq);
      const id = sender(e);
      switch (e.type) {
        case "command.proposed":
          lit("sentinel", "warn");
          send({ path: "sentinel", color: "amber", onLand: () => react("warn", "sentinel") });
          break;
        case "ops-log.added":
          lit("attacker", "bad");
          send({ path: "trick", color: "red", dur: 900, onLand: () => lit("sentinel", "bad") });
          break;
        case "execute.refused":
        case "approval.refused":
          lit(id, "bad");
          send({ path: id, color: "red", bounce: true, onLand: () => react("bad", id) });
          break;
        case "approval.duplicate":
          lit(id, "warn");
          send({ path: id, color: "amber", bounce: true, onLand: () => react("warn", id) });
          break;
        case "approval.recorded":
          lit(id, "live");
          setInflight((n) => n + 1);
          send({
            path: id,
            color: "blue",
            onLand: () => {
              setInflight((n) => Math.max(0, n - 1));
              react("live", id);
            },
          });
          break;
        case "command.executed":
          send({ path: "wire", color: "green", dur: 1100, delay: 700, onLand: () => lit("pump", "ok") });
          break;
        default:
      }
    }
  }, [run]);

  const done = (key) => setPulses((p) => p.filter((x) => x.key !== key));

  const ran = cmd?.status === "executed";
  const pending = cmd?.status === "pending";
  const approvals = cmd?.approvals ?? [];
  const filled = Math.max(0, approvals.length - inflight);
  const running = line?.pumps !== "stopped";
  const tone = line?.status === "trip" ? "bad" : line?.status === "alarm" ? "warn" : "live";

  return (
    <div className="stage" ref={wrapRef}>
      {geo && (
        <svg
          width={geo.w}
          height={geo.h}
          viewBox={`0 0 ${geo.w} ${geo.h}`}
          role="img"
          aria-label={`Line 3 at ${line ? kpa(line.pressureKpa) : "?"} kPa, pumps ${running ? "running" : "stopped"}. The two-key lock holds ${filled} of 2 operator keys.`}
        >
          <Pipe g={geo} running={running} />
          <Gauge g={geo} line={line} thresholds={thresholds} tone={tone} />
          <Pump g={geo} running={running} flash={flash.pump} />

          <path className={`wire ${ran ? "on" : ""}`} d={geo.wire} />
          <path className="sense" d={geo.sense} />
          {ACTORS.map((id) => (
            <path key={id} className={`route ${id}`} d={geo.routes[id]} />
          ))}

          <Lock g={geo} cmd={cmd} pending={pending} ran={ran} approvals={approvals} filled={filled} hit={hit} />

          {ACTORS.map((id, i) => (
            <g key={id} className={`port ${id}`}>
              {/* Over the cards the names are already there; on a phone the cards stack below. */}
              {!geo.oneRow && (
                <text className="port-label" x={geo.xs[i]} y={geo.portY - 14} textAnchor="middle">
                  {PORT_LABEL[id]}
                </text>
              )}
              <circle key={flash[id]?.n ?? 0} className={`port-dot ${flash[id] ? `lit ${flash[id].tone}` : ""}`} cx={geo.xs[i]} cy={geo.portY} r={7 * geo.s + 1} />
            </g>
          ))}

          {pulses.map(({ key, path, ...p }) => (
            <Pulse key={key} d={path === "trick" ? geo.trick : path === "wire" ? geo.wire : geo.routes[path]} {...p} onDone={() => done(key)} />
          ))}
        </svg>
      )}
    </div>
  );
}

function Pipe({ g, running }) {
  return (
    <g className="pipe">
      <path className="pipe-shell" d={`M0,${g.pipeY} H${g.w}`} strokeWidth={18 * g.s} />
      <path className={`pipe-flow ${running ? "running" : ""}`} d={`M0,${g.pipeY} H${g.w}`} strokeWidth={4 * g.s} />
      {g.gauge.x - g.gauge.r > 110 && (
        <text className="cap" x={16} y={g.pipeY - 20 * g.s}>
          Reservoir
        </text>
      )}
      {g.s > 0.8 && (
        <text className="cap" x={g.w - 16} y={g.pipeY - 20 * g.s} textAnchor="end">
          To the city
        </text>
      )}
    </g>
  );
}

function Gauge({ g: { gauge: d, s }, line, thresholds, tone }) {
  const v = line?.pressureKpa ?? 0;
  const alarm = thresholds?.alarmKpa ?? 600;
  const trip = thresholds?.tripKpa ?? 700;
  const ring = d.r - 9 * s;
  return (
    <g className="gauge">
      <circle className="gauge-face" cx={d.x} cy={d.y} r={d.r} />
      <path className="gauge-track" d={dialArc(d, 0, GAUGE_MAX, ring)} strokeWidth={6 * s} />
      <path className="gauge-zone warn" d={dialArc(d, alarm, trip, ring)} strokeWidth={6 * s} />
      <path className="gauge-zone bad" d={dialArc(d, trip, GAUGE_MAX, ring)} strokeWidth={6 * s} />
      <path className={`gauge-value ${tone}`} d={dialArc(d, 0, GAUGE_MAX, ring)} strokeWidth={6 * s} pathLength={100} strokeDasharray={`${(Math.min(GAUGE_MAX, v) / GAUGE_MAX) * 100} 100`} />
      <text className={`gauge-num ${tone}`} x={d.x} y={d.y + 6 * s} fontSize={20 * s} textAnchor="middle">
        {line ? kpa(v) : "–"}
      </text>
      <text className="gauge-unit" x={d.x} y={d.y + 22 * s} fontSize={10 * s + 1} textAnchor="middle">
        kPa
      </text>
      <text className="cap" x={d.x + d.r + 14 * s} y={d.y - 20 * s}>
        Line 3 pressure
      </text>
    </g>
  );
}

function Pump({ g: { pump: p, s }, running, flash }) {
  const blade = `M0,0 C${4 * s},${-10 * s} ${12 * s},${-16 * s} ${18 * s},${-14 * s}`;
  return (
    <g className={`pump ${running ? "running" : "stopped"}`}>
      <circle key={flash?.n ?? 0} className={`pump-body ${flash ? `lit ${flash.tone}` : ""}`} cx={p.x} cy={p.y} r={p.r} />
      <g transform={`translate(${p.x} ${p.y})`}>
        <g className="rotor">
          {[0, 120, 240].map((a) => (
            <path key={a} d={blade} transform={`rotate(${a})`} strokeWidth={3 * s} />
          ))}
          <circle r={4 * s} />
          {running && !reducedMotion() && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.9s" repeatCount="indefinite" />}
        </g>
      </g>
      <text className="cap" x={p.x} y={p.y - p.r - 12 * s} textAnchor="middle">
        Pump
      </text>
      <text className={`pump-state ${running ? "" : "ok"}`} x={p.x - 10 * s} y={p.y + p.r + 22 * s} textAnchor="end">
        {running ? "Running" : "Stopped"}
      </text>
    </g>
  );
}

function Lock({ g: { lock: l, keyholes, s, entry }, cmd, pending, ran, approvals, filled, hit }) {
  const state = ran ? "ok" : pending ? "warn" : "";
  const count = ran ? "Open" : pending ? `${filled} of 2` : "No request";
  return (
    <g className={`lock ${state}`}>
      {pending && (
        <text className="cap warn" x={l.x} y={l.top - 14 * s} textAnchor="middle">
          Request: stop Line 3's pumps
        </text>
      )}
      {ran && (
        <text className="cap ok" x={l.x} y={l.top - 14 * s} textAnchor="middle">
          Two operators agreed
        </text>
      )}
      <rect className="lock-body" x={l.x - l.w / 2} y={l.top} width={l.w} height={l.h} rx={18 * s} />
      {hit && <rect key={hit.n} className={`lock-hit ${hit.tone}`} x={l.x - l.w / 2} y={l.top} width={l.w} height={l.h} rx={18 * s} />}
      {s > 0.75 && (
        <text className="cap" x={l.x - l.w / 2 + 16 * s} y={l.top + 24 * s}>
          Two-key lock
        </text>
      )}
      <text className={`cap ${state}`} x={l.x + l.w / 2 - 16 * s} y={l.top + 24 * s} textAnchor="end">
        {count}
      </text>
      {keyholes.map((k, i) => {
        const who = i < filled ? approvals[i]?.username : null;
        return (
          <g key={i} className={`keyhole ${who ? (ran ? "ok" : "live") : ""}`}>
            <circle cx={k.x} cy={k.y} r={k.r} />
            {who ? (
              <text x={k.x} y={k.y + 6 * s} fontSize={17 * s} textAnchor="middle">
                {who[0].toUpperCase()}
              </text>
            ) : (
              <path d={`M${k.x},${k.y - 9 * s} a${5 * s},${5 * s} 0 1 1 0.01,0 M${k.x - 3 * s},${k.y - 3 * s} L${k.x - 5 * s},${k.y + 9 * s} H${k.x + 5 * s} L${k.x + 3 * s},${k.y - 3 * s}`} />
            )}
          </g>
        );
      })}
      {hit && hit.tone === "bad" && (
        <g key={`b${hit.n}`} className="bad">
          <circle className="burst" cx={entry[ACTORS.indexOf(hit.at)] ?? l.x} cy={l.bottom} r={14 * s} />
          <text className="cap refused" x={l.x + l.w / 2 + 12 * s} y={l.bottom - 6 * s}>
            Refused
          </text>
        </g>
      )}
    </g>
  );
}

/** A signal travelling along a line. Bouncing ones turn back at the lock. */
function Pulse({ d, color, bounce = false, dur = 800, delay = 0, onLand, onDone }) {
  const pathRef = useRef(null);
  const dotRef = useRef(null);
  const cb = useRef({ onLand, onDone });
  cb.current = { onLand, onDone };

  useEffect(() => {
    const path = pathRef.current;
    const total = path.getTotalLength();
    const span = bounce ? dur * 1.6 : dur;
    let start = null;
    let landed = false;
    let raf;
    const ease = (t) => 1 - (1 - t) ** 2;
    const frame = (now) => {
      start ??= now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / span));
      let f;
      if (bounce) {
        f = t < 0.55 ? ease(t / 0.55) : 1 - ease((t - 0.55) / 0.45) * 0.92;
        if (t >= 0.55 && !landed) {
          landed = true;
          cb.current.onLand?.();
        }
      } else f = ease(t);
      const p = path.getPointAtLength(total * f);
      dotRef.current?.setAttribute("transform", `translate(${p.x} ${p.y})`);
      dotRef.current?.setAttribute("opacity", now < start ? "0" : bounce && t > 0.55 ? String(1 - (t - 0.55) / 0.45) : "1");
      if (t < 1) raf = requestAnimationFrame(frame);
      else {
        if (!landed) cb.current.onLand?.();
        cb.current.onDone?.();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [d, bounce, dur, delay]);

  return (
    <g className={`signal ${TONE[color]}`}>
      <path ref={pathRef} d={d} fill="none" stroke="none" />
      <g ref={dotRef} opacity="0">
        <circle className="halo" r="13" />
        <circle r="6" />
      </g>
    </g>
  );
}
