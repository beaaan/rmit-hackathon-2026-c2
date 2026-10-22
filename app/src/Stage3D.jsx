// The live 3D stage: the whole system at a glance, driven by the controller's own records.
// Left: Sentinel, the AI. Centre: the two-key lock (one keyhole per operator). Right: Line 3's
// pipe and pump. Front: the people who can try to act. Every attempt in the audit trail plays out
// here: refused ones bounce off the lock, an operator's approval turns one key, two keys open the
// lock and the pump stops.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const C = {
  ink: 0x111111,
  surface: 0xf1f1f1,
  floor: 0xf6f6f6,
  steel: 0xb9bec8,
  accent: 0x1a4be0,
  accentSoft: 0x8ea6f2,
  red: 0xd0312d,
  amber: 0xe0a020,
  green: 0x1f9d63,
  water: 0x3d7bf0,
  white: 0xffffff,
};

const POS = {
  sentinel: new THREE.Vector3(-6.2, 1.6, 0),
  lock: new THREE.Vector3(0, 1.7, 0),
  pump: new THREE.Vector3(6.2, 1.1, -0.4),
  attacker: new THREE.Vector3(-5.2, 0, 3.6),
  jo: new THREE.Vector3(-2, 0, 3.6),
  kim: new THREE.Vector3(1.6, 0, 3.6),
  raj: new THREE.Vector3(4.6, 0, 3.6),
};
const KEYHOLES = [new THREE.Vector3(-0.72, 1.7, 0.18), new THREE.Vector3(0.72, 1.7, 0.18)];

export const STAGE_LABELS = [
  { id: "sentinel", text: "Sentinel, the AI", short: "Sentinel", at: POS.sentinel, dy: 1.7 },
  { id: "lock", text: "Two-key lock", short: "Lock", at: POS.lock, dy: 1.75 },
  { id: "pump", text: "Line 3 pump", short: "Pump", at: POS.pump, dy: 1.6 },
  { id: "attacker", text: "Attacker", short: "Attacker", at: POS.attacker, dy: 1.75 },
  { id: "jo", text: "Jo, IT admin", short: "Jo", at: POS.jo, dy: 1.75 },
  { id: "kim", text: "Kim, operator", short: "Kim", at: POS.kim, dy: 1.75 },
  { id: "raj", text: "Raj, operator", short: "Raj", at: POS.raj, dy: 1.75 },
];

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });
}

function person(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, 16), mat(color));
  body.position.y = 0.77;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), mat(color));
  head.position.y = 1.62;
  g.add(body, head);
  return g;
}

function shadow(radius, x = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.01, z);
  return m;
}

/** Builds the scene once and returns handles the effects drive. */
function buildWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3ea, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-4, 10, 8);
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), mat(C.floor, { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Sentinel: a faceted core inside a slowly turning wire cage.
  const sentinel = new THREE.Group();
  const coreMat = mat(C.ink, { emissive: new THREE.Color(C.accent), emissiveIntensity: 0.25, flatShading: true });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), coreMat);
  const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), new THREE.MeshBasicMaterial({ color: C.accent, wireframe: true, transparent: true, opacity: 0.35 }));
  sentinel.add(core, cage);
  sentinel.position.copy(POS.sentinel);
  scene.add(sentinel, shadow(1.1, POS.sentinel.x, 0));

  // The lock: a white disc with two keyholes, inside a ring that shows its state.
  const lock = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.3, 64), mat(C.white));
  face.rotation.x = Math.PI / 2;
  const ringMat = mat(C.steel, { emissive: new THREE.Color(0x000000) });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.12, 16, 96), ringMat);
  lock.add(face, ring);
  lock.position.copy(POS.lock);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.7, 16), mat(C.steel));
  stand.position.set(0, 0.85 - 1.7, -0.05);
  lock.add(stand);
  scene.add(lock, shadow(1.2, 0, 0));

  const keys = KEYHOLES.map((p) => {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.46, 40), new THREE.MeshBasicMaterial({ color: 0xdedede }));
    hole.position.copy(p).sub(POS.lock);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(0.46, 40), new THREE.MeshBasicMaterial({ color: C.accent }));
    fill.position.copy(hole.position).setZ(hole.position.z + 0.005);
    fill.scale.setScalar(0.001);
    const key = new THREE.Group();
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 24), mat(C.white));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.06), mat(C.white));
    bow.position.y = 0.16;
    blade.position.y = -0.1;
    key.add(bow, blade);
    key.position.copy(hole.position).setZ(hole.position.z + 0.06);
    key.visible = false;
    lock.add(hole, fill, key);
    return { fill, key, shown: 0, target: 0 };
  });

  // The pipe along the back and the pump, with water flowing through.
  const pipeMat = mat(C.steel, { transparent: true, opacity: 0.45 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 22, 32, 1, true), pipeMat);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0, 0.6, -2.6);
  scene.add(pipe);
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: C.water }), 60);
  const dropX = Array.from({ length: 60 }, (_, i) => -11 + (i * 22) / 60);
  const dropJitter = Array.from({ length: 60 }, () => [(Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4]);
  scene.add(drops);

  const pump = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.9, 48), mat(C.ink));
  housing.rotation.x = Math.PI / 2;
  const impeller = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.12), mat(C.white));
    blade.rotation.z = (i * Math.PI) / 4;
    impeller.add(blade);
  }
  impeller.position.z = 0.5;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.4), mat(C.steel));
  base.position.set(0, -0.85, 0);
  pump.add(housing, impeller, base);
  pump.position.copy(POS.pump);
  const link = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 16), mat(C.steel));
  link.position.set(POS.pump.x, 0.6, -1.5);
  link.rotation.x = Math.PI / 2;
  scene.add(pump, link, shadow(1.4, POS.pump.x, POS.pump.z));

  // The people.
  const people = {
    attacker: person(0x7a1f22),
    jo: person(0x8a8f99),
    kim: person(C.accent),
    raj: person(C.accent),
  };
  for (const [id, g] of Object.entries(people)) {
    g.position.copy(POS[id]);
    scene.add(g, shadow(0.6, POS[id].x, POS[id].z));
  }

  return { renderer, scene, camera, sentinel, core, coreMat, cage, lock, ring, ringMat, keys, pump, impeller, pipeMat, drops, dropX, dropJitter, people };
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

export default function Stage3D({ line, thresholds, cmd, run }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const worldRef = useRef(null);
  const fx = useRef({ shots: [], bursts: [], pulses: [], seen: new Set(), firstSeq: null, tricked: 0, pumpSpeed: 1 });
  const [failed, setFailed] = useState(false);
  const [labels, setLabels] = useState([]);

  // Build once; render on animation frames while visible.
  useEffect(() => {
    let world;
    try {
      world = buildWorld(canvasRef.current);
    } catch (err) {
      console.warn("3D stage unavailable, showing the text version:", err);
      setFailed(true);
      return;
    }
    worldRef.current = world;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const { renderer, scene, camera } = world;
    let visible = true;
    let raf = 0;
    const clock = new THREE.Clock();
    const tmp = new THREE.Object3D();

    const resize = () => {
      const el = wrapRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Fit the scene's width (Sentinel to the pump, plus their labels) to the card, looking down at
      // about 35 degrees so the people in front sit clear of the pipe and the lock behind them.
      const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      const dist = Math.max(13, 8.4 / Math.tan(halfFov));
      camera.position.set(0, dist * 0.58, dist * 0.82 + 1.4);
      camera.lookAt(0, 0.9, 1.4);
      // Shift the picture up so the captions along the bottom don't cover the front row.
      camera.setViewOffset(w, h, 0, Math.round(h * 0.03), w, h);
      camera.updateProjectionMatrix();
      setLabels(
        STAGE_LABELS.map((l) => {
          const p = l.at.clone().add(new THREE.Vector3(0, l.dy, 0)).project(camera);
          return { ...l, text: w < 560 ? l.short : l.text, x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
        }),
      );
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    resize();

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(wrapRef.current);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;
      const f = fx.current;

      // Sentinel idles; it flashes red for a moment each time it is tricked.
      world.cage.rotation.y += dt * 0.4;
      world.core.rotation.y -= dt * 0.25;
      world.sentinel.position.y = POS.sentinel.y + (reduce ? 0 : Math.sin(t * 1.4) * 0.08);
      f.tricked = Math.max(0, f.tricked - dt);
      world.coreMat.emissive.setHex(f.tricked > 0 ? C.red : C.accent);
      world.coreMat.emissiveIntensity = f.tricked > 0 ? 0.9 : 0.25;

      // The pump turns while it runs and coasts to a stop when the command executes.
      f.pumpSpeed += ((world.pumpTarget ?? 1) - f.pumpSpeed) * Math.min(1, dt * 1.2);
      world.impeller.rotation.z -= dt * 6 * f.pumpSpeed;

      // Water flows at the pump's speed.
      for (let i = 0; i < world.dropX.length; i++) {
        world.dropX[i] += dt * 3 * f.pumpSpeed;
        if (world.dropX[i] > 11) world.dropX[i] -= 22;
        tmp.position.set(world.dropX[i], 0.6 + world.dropJitter[i][0], -2.6 + world.dropJitter[i][1]);
        tmp.updateMatrix();
        world.drops.setMatrixAt(i, tmp.matrix);
      }
      world.drops.instanceMatrix.needsUpdate = true;

      // Keys fill their keyhole and turn when an operator's approval lands.
      for (const k of world.keys) {
        k.shown += (k.target - k.shown) * Math.min(1, dt * 6);
        k.fill.scale.setScalar(Math.max(0.001, k.shown));
        k.key.visible = k.shown > 0.5;
        k.key.rotation.z = -Math.PI / 2 * ease(Math.min(1, Math.max(0, (k.shown - 0.5) * 2)));
      }

      // Shots travel in an arc from whoever acted to their target; refused ones bounce back.
      f.shots = f.shots.filter((s) => {
        s.t += dt / s.dur;
        if (s.t >= 1 && !s.landed) {
          s.landed = true;
          s.onLand?.();
        }
        if (s.t >= (s.bounce ? 1.6 : 1)) {
          scene.remove(s.mesh);
          return false;
        }
        const u = Math.min(1, s.t);
        const p = s.from.clone().lerp(s.to, ease(u));
        p.y += Math.sin(Math.PI * u) * s.arc;
        if (s.t > 1 && s.bounce) {
          const back = (s.t - 1) / 0.6;
          p.copy(s.to).lerp(s.from, back * 0.35);
          p.y -= back * 1.2;
          s.mesh.material.opacity = 1 - back;
        }
        s.mesh.position.copy(p);
        return true;
      });

      // Rings that spread and fade where something was refused or opened.
      f.bursts = f.bursts.filter((b) => {
        b.t += dt / 0.7;
        if (b.t >= 1) {
          scene.remove(b.mesh);
          return false;
        }
        b.mesh.scale.setScalar(1 + b.t * 1.4);
        b.mesh.material.opacity = 0.8 * (1 - b.t);
        return true;
      });

      // A pulse running from the open lock to the pump.
      f.pulses = f.pulses.filter((p) => {
        p.t += dt / 0.9;
        if (p.t >= 1) {
          scene.remove(p.mesh);
          p.onLand?.();
          return false;
        }
        p.mesh.visible = p.t >= 0;
        p.mesh.position.copy(POS.lock.clone().lerp(POS.pump, ease(Math.max(0, p.t))));
        return true;
      });

      // The lock ring's colour says where things stand; it glows briefly when it opens or refuses.
      world.lock.rotation.z += ((world.lockTurn ?? 0) - world.lock.rotation.z) * Math.min(1, dt * 3);
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
    };
  }, []);

  // State: pressure colour on the pipe, ring colour, pump target, keys.
  useEffect(() => {
    const w = worldRef.current;
    if (!w || !line || !thresholds) return;
    const pressure = line.pressureKpa;
    const pipeColor = pressure >= thresholds.tripKpa ? C.red : pressure >= thresholds.alarmKpa ? C.amber : C.steel;
    w.pipeMat.color.setHex(pipeColor);
    w.pipeMat.opacity = pipeColor === C.steel ? 0.45 : 0.75;
    w.pumpTarget = line.pumps === "running" ? 0.35 + Math.min(1.2, Math.max(0, (pressure - 300) / 400)) : 0;
    const approvals = cmd?.approvals.length ?? 0;
    w.keys.forEach((k, i) => (k.target = i < approvals ? 1 : 0));
    const status = cmd?.status;
    w.ringMat.color.setHex(status === "executed" ? C.green : status === "pending" ? C.amber : C.steel);
    w.lockTurn = status === "executed" ? -Math.PI / 2 : 0;
  }, [line, thresholds, cmd]);

  // Events: each new entry in the audit trail becomes a moving shot on the stage.
  useEffect(() => {
    const w = worldRef.current;
    if (!w) return;
    const f = fx.current;
    const first = run[0]?.seq ?? null;
    if (first !== f.firstSeq) {
      // A new run (after "Start over"): forget what was shown, but don't replay the past.
      f.firstSeq = first;
      if (f.seen.size === 0) run.forEach((e) => f.seen.add(e.seq));
      else f.seen = new Set();
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const at = (id) => (id === "sentinel" ? POS.sentinel.clone() : POS[id].clone().add(new THREE.Vector3(0, 1.6, 0)));
    const shot = (from, to, color, { bounce = false, arc = 1.6, dur = 0.8, onLand } = {}) => {
      if (reduce) return onLand?.();
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.position.copy(from);
      w.scene.add(mesh);
      f.shots.push({ mesh, from, to, color, bounce, arc, dur, t: 0, onLand });
    };
    const burst = (where, color) => {
      if (reduce) return;
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.06, 8, 64), new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.position.copy(where);
      w.scene.add(mesh);
      f.bursts.push({ mesh, t: 0 });
    };
    const refused = (fromId) => shot(at(fromId), POS.lock.clone(), C.red, { bounce: true, onLand: () => burst(POS.lock, C.red) });
    const who = (e) => {
      const u = e.actor?.username;
      if (u === "jo" || u === "kim" || u === "raj") return u;
      const c = String(e.actor?.claimed ?? "");
      if (c === "sentinel") return "sentinel";
      if (c.startsWith("forged")) return "attacker";
      if (e.actor?.kind === "signed-in") return "jo";
      return e.approvals > 1 ? "raj" : "kim";
    };

    for (const e of run) {
      if (f.seen.has(e.seq)) continue;
      f.seen.add(e.seq);
      switch (e.type) {
        case "command.proposed":
          shot(POS.sentinel.clone(), POS.lock.clone(), C.amber, { arc: 1.2, onLand: () => burst(POS.lock, C.amber) });
          break;
        case "ops-log.added":
          shot(at("attacker"), POS.sentinel.clone(), C.ink, { arc: 2.2, dur: 0.9, onLand: () => (f.tricked = 1.6) });
          break;
        case "execute.refused":
        case "approval.refused":
          refused(who(e));
          break;
        case "approval.duplicate":
          shot(at(who(e)), POS.lock.clone(), C.amber, { bounce: true, onLand: () => burst(POS.lock, C.amber) });
          break;
        case "approval.recorded": {
          const slot = KEYHOLES[Math.min(1, (e.approvals ?? 1) - 1)];
          shot(at(who(e)), slot.clone(), C.accent, { arc: 1.4 });
          break;
        }
        case "command.executed":
          if (!reduce) {
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: C.green }));
            w.scene.add(mesh);
            f.pulses.push({ mesh, t: -0.6, onLand: () => burst(POS.pump, C.green) });
          }
          setTimeout(() => burst(POS.lock, C.green), 500);
          break;
        default:
      }
    }
  }, [run]);

  return (
    <div className="stage3d" ref={wrapRef}>
      {failed ? (
        <p className="stage-fallback">
          This browser can't draw the 3D view. Everything below still works: each move's result appears in its panel and in the
          feed.
        </p>
      ) : (
        <canvas ref={canvasRef} aria-label="Live view of Sentinel, the two-key lock, Line 3's pump and the people who can act" role="img" />
      )}
      {!failed &&
        labels.map((l) => (
          <span key={l.id} className={`stage-label ${l.id}`} style={{ transform: `translate(${l.x}px, ${l.y}px)` }} aria-hidden="true">
            {l.text}
          </span>
        ))}
    </div>
  );
}
