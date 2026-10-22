// The live 3D stage: the whole system at a glance, driven by the controller's own records.
// Back row, the plant: Line 3's pressure gauge, the two-key lock and the pump. Front row, everyone who
// can try to act: Sentinel (the AI), an attacker, Jo the admin, and the operators Kim and Raj. Each
// figure stands over its own controls: BreakIt passes the column strip and the figures line up with it.
// Every attempt in the audit trail plays out here: refused ones bounce off the lock, an operator's
// approval turns one key, two keys open the lock and the pump stops.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const BG = 0x0b0d13;
const C = {
  floor: 0x11141c,
  steel: 0x9aa3b5,
  dark: 0x2a303c,
  face: 0x171b25,
  accent: 0x3d6bff,
  red: 0xff4d4f,
  amber: 0xffb020,
  green: 0x2fd27f,
  water: 0x6b9bff,
  white: 0xffffff,
};

export const ACTORS = ["sentinel", "attacker", "jo", "kim", "raj"];
const TINT = { sentinel: C.accent, attacker: 0xc23b3b, jo: 0x9aa1ad, kim: C.accent, raj: C.accent };
const DEFAULT_X = [-6, -3, 0, 3, 6];
const FRONT_Z = 4.2;
const BACK = {
  gauge: new THREE.Vector3(-5.2, 2.05, -1.2),
  lock: new THREE.Vector3(0, 2.15, -1.2),
  pump: new THREE.Vector3(5.2, 1.3, -1.4),
};
const TILT = -0.3; // the back row's faces lean toward the camera
const KEYHOLES = [new THREE.Vector3(-0.68, 0, 0.17), new THREE.Vector3(0.68, 0, 0.17)];
const LABELS = [
  { id: "gauge", at: BACK.gauge, dy: 1.75 },
  { id: "lock", at: BACK.lock, dy: 1.85 },
  { id: "pump", at: BACK.pump, dy: 1.45 },
];

// The gauge reads 0 to 800 kPa over a 270° sweep, starting bottom left.
const GAUGE_MAX = 800;
const gaugeAngle = (kpa) => 1.25 * Math.PI - (Math.min(GAUGE_MAX, Math.max(0, kpa)) / GAUGE_MAX) * 1.5 * Math.PI;

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...extra });
}

function person(color) {
  const g = new THREE.Group();
  const m = mat(color, { roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.44, 0.72, 8, 20), m);
  body.position.y = 0.86;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 20), m);
  head.position.y = 1.76;
  g.add(body, head);
  return g;
}

/** Builds the scene once and returns handles the effects drive. */
function buildWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(BG);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 24, 46);
  const camera = new THREE.PerspectiveCamera(14, 2, 0.1, 300);

  scene.add(new THREE.HemisphereLight(0xc9d6ff, BG, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-5, 13, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 10, bottom: -8, near: 1, far: 40 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x7f9cff, 1.2);
  rim.position.set(4, 6, -10);
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(C.floor, { roughness: 0.95, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // The pipe along the back, with water flowing through it.
  const pipeMat = mat(C.steel, { transparent: true, opacity: 0.22, roughness: 0.2, depthWrite: false });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 30, 40, 1, true), pipeMat);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0, 0.6, -3);
  scene.add(pipe);
  const DROPS = 80;
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: C.water }), DROPS);
  const dropX = Array.from({ length: DROPS }, (_, i) => -15 + (i * 30) / DROPS);
  const dropJitter = Array.from({ length: DROPS }, () => [(Math.random() - 0.5) * 0.46, (Math.random() - 0.5) * 0.46]);
  scene.add(drops);

  const post = (x, z, top) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, top, 20), mat(C.dark, { metalness: 0.5 }));
    m.position.set(x, top / 2, z);
    scene.add(m);
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, Math.abs(-3 - z), 12), mat(C.dark, { metalness: 0.5 }));
    tap.rotation.x = Math.PI / 2;
    tap.position.set(x, 0.6, (z - 3) / 2);
    scene.add(tap);
  };

  // The pressure gauge: a dial with alarm and trip zones and a needle.
  const gauge = new THREE.Group();
  const gFace = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.22, 64), mat(C.face));
  gFace.rotation.x = Math.PI / 2;
  const gRim = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.08, 14, 96), mat(C.steel, { metalness: 0.7, roughness: 0.3 }));
  const needle = new THREE.Group();
  const nBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.98, 0.04), new THREE.MeshBasicMaterial({ color: C.white }));
  nBody.position.y = 0.4;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24), mat(C.white));
  hub.rotation.x = Math.PI / 2;
  needle.add(nBody, hub);
  needle.position.z = 0.16;
  gauge.add(gFace, gRim, needle);
  gauge.position.copy(BACK.gauge);
  gauge.rotation.x = TILT;
  scene.add(gauge);
  post(BACK.gauge.x, BACK.gauge.z, BACK.gauge.y - 1.1);

  // The lock: a white disc with two keyholes, inside a ring that shows its state.
  const lock = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.3, 64), mat(C.white, { roughness: 0.35 }));
  face.rotation.x = Math.PI / 2;
  const ringMat = mat(C.steel, { emissive: new THREE.Color(0x000000), metalness: 0.6, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 18, 120), ringMat);
  lock.add(face, ring);
  const keys = KEYHOLES.map((p) => {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.44, 48), new THREE.MeshBasicMaterial({ color: 0xc3c8d4 }));
    hole.position.copy(p);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(0.44, 48), new THREE.MeshBasicMaterial({ color: C.accent }));
    fill.position.copy(p).setZ(p.z + 0.005);
    fill.scale.setScalar(0.001);
    const key = new THREE.Group();
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 24), mat(C.white));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.06), mat(C.white));
    bow.position.y = 0.16;
    blade.position.y = -0.1;
    key.add(bow, blade);
    key.position.copy(p).setZ(p.z + 0.06);
    key.visible = false;
    lock.add(hole, fill, key);
    return { fill, key, shown: 0, target: 0 };
  });
  lock.position.copy(BACK.lock);
  lock.rotation.x = TILT;
  scene.add(lock);
  post(BACK.lock.x, BACK.lock.z, BACK.lock.y - 1.2);

  // The pump: a housing with a turning impeller, fed from the pipe.
  const pump = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.9, 56), mat(C.dark, { metalness: 0.6, roughness: 0.35 }));
  housing.rotation.x = Math.PI / 2;
  const impeller = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.12), mat(C.white));
    blade.rotation.z = (i * Math.PI) / 4;
    impeller.add(blade);
  }
  impeller.position.z = 0.5;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 1.5), mat(C.dark, { metalness: 0.4 }));
  base.position.set(0, -1.02, 0);
  pump.add(housing, impeller, base);
  pump.position.copy(BACK.pump);
  scene.add(pump);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.9, 20), mat(C.dark, { metalness: 0.5 }));
  feed.rotation.x = Math.PI / 2;
  feed.position.set(BACK.pump.x, 0.6, -2.05);
  scene.add(feed);

  // The cable from the lock to the pump: the only way a command reaches it.
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(BACK.lock.x + 0.2, 0.06, BACK.lock.z),
    new THREE.Vector3(2.4, 0.06, BACK.lock.z + 0.7),
    new THREE.Vector3(BACK.pump.x - 1, 0.06, BACK.pump.z + 0.4),
    new THREE.Vector3(BACK.pump.x - 0.6, 0.3, BACK.pump.z + 0.1),
  ]);
  const cableMat = mat(C.dark, { emissive: new THREE.Color(0x000000) });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 60, 0.06, 10), cableMat));

  // The front row: a lit disc to stand on, and the figure.
  const front = {};
  for (const [i, id] of ACTORS.entries()) {
    const g = new THREE.Group();
    const padMat = mat(0x1a1f2b, { emissive: new THREE.Color(TINT[id]), emissiveIntensity: 0.12, roughness: 0.6 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.08, 48), padMat);
    pad.position.y = 0.04;
    pad.receiveShadow = true;
    g.add(pad);
    let figure;
    if (id === "sentinel") {
      figure = new THREE.Group();
      const coreMat = mat(0x0d1020, { emissive: new THREE.Color(C.accent), emissiveIntensity: 0.6, flatShading: true });
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 0), coreMat);
      const cage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.92, 1),
        new THREE.MeshBasicMaterial({ color: 0x7f9cff, wireframe: true, transparent: true, opacity: 0.45 }),
      );
      cage.userData.noShadow = true;
      figure.add(core, cage);
      figure.position.y = 1.35;
      Object.assign(g.userData, { core, coreMat, cage });
    } else {
      figure = person(TINT[id]);
    }
    g.add(figure);
    g.position.set(DEFAULT_X[i], 0, FRONT_Z);
    g.scale.setScalar(1.15);
    scene.add(g);
    front[id] = { id, group: g, figure, padMat, flash: 0, flashColor: new THREE.Color() };
  }

  scene.traverse((o) => {
    if (o.isMesh && o !== floor && o !== pipe && !o.userData.noShadow && !o.isInstancedMesh) o.castShadow = true;
  });
  scene.updateMatrixWorld(true);

  return { renderer, scene, camera, gauge, needle, lock, ring, ringMat, keys, impeller, pipeMat, drops, dropX, dropJitter, front, cableCurve, cableMat };
}

// Points that must stay in frame: the label anchors over the back row, the plant's outer edges and the
// front row's discs. The camera keeps one direction (looking down at about 37 degrees) and backs off
// until they all fit, leaving room above for the labels; then the picture is centred on them.
const VIEW_DIR = new THREE.Vector3(0, 0.6, 0.8).normalize();
const VIEW_AT = new THREE.Vector3(0, 1.4, 1.6);
const FIT = [
  ...LABELS.map((l) => ({ p: l.at.clone().add(new THREE.Vector3(0, l.dy, 0)), label: true })),
  { p: new THREE.Vector3(-6.6, 2.05, -1.2) },
  { p: new THREE.Vector3(6.4, 1.3, -1.4) },
  { p: new THREE.Vector3(0, 0, FRONT_Z + 1.1) },
];
const LABEL_PX = 46;
export const NARROW = 560; // below this the stage uses short labels

function fitCamera(camera, w, h) {
  camera.clearViewOffset();
  const room = (2 * LABEL_PX) / h; // the label above the topmost anchor, in device units
  const bounds = () => {
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    let top = -Infinity;
    let bottom = Infinity;
    let side = 0;
    const half = (w < NARROW ? 40 : 72) * (2 / w); // half a label's width, in device units
    for (const { p, label } of FIT) {
      const q = p.clone().project(camera);
      top = Math.max(top, q.y);
      bottom = Math.min(bottom, q.y);
      side = Math.max(side, Math.abs(q.x) + (label ? half : 0));
    }
    return { top, bottom, side };
  };
  let dist = 30;
  for (let i = 0; i < 5; i++) {
    camera.position.copy(VIEW_AT).addScaledVector(VIEW_DIR, dist);
    camera.lookAt(VIEW_AT);
    const b = bounds();
    dist *= Math.max((b.top - b.bottom) / (2 - room - 0.1), b.side / 0.94);
  }
  camera.position.copy(VIEW_AT).addScaledVector(VIEW_DIR, dist);
  camera.lookAt(VIEW_AT);
  const b = bounds();
  const want = (1 - room + (-1 + 0.06)) / 2;
  camera.setViewOffset(w, h, 0, -Math.round((((b.top + b.bottom) / 2 - want) * h) / 2), w, h);
  camera.updateProjectionMatrix();
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

export default function Stage3D({ line, thresholds, cmd, run, anchorsRef, labels: labelText = {} }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const worldRef = useRef(null);
  const fx = useRef({ shots: [], bursts: [], pulses: [], seen: new Set(), firstSeq: null, tricked: 0, pumpSpeed: 1 });
  const [failed, setFailed] = useState(false);
  const [spots, setSpots] = useState([]);

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
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      fitCamera(camera, w, h);
      // The far floor fades into the console's black, so the stage has no edge.
      const back = camera.position.distanceTo(new THREE.Vector3(0, 0, -3));
      scene.fog.near = back - 1;
      scene.fog.far = back + 5;

      // Stand each figure over its column. Columns stacked on a phone fall back to an even row.
      const box = el.getBoundingClientRect();
      const centres = ACTORS.map((id) => {
        const col = anchorsRef?.current?.querySelector(`[data-actor="${id}"]`);
        if (!col) return null;
        const r = col.getBoundingClientRect();
        return r.left + r.width / 2 - box.left;
      });
      const known = centres.filter((c) => c != null);
      const spread = known.length === ACTORS.length ? Math.max(...known) - Math.min(...known) : 0;
      const k = new THREE.Vector3(1, 1, FRONT_Z).project(camera).x - new THREE.Vector3(0, 1, FRONT_Z).project(camera).x;
      ACTORS.forEach((id, i) => {
        world.front[id].group.position.x = spread > w * 0.5 ? ((centres[i] / w) * 2 - 1) / k : DEFAULT_X[i] * Math.min(1, 0.72 / (6 * k));
      });
      scene.updateMatrixWorld(true);

      setSpots(
        LABELS.map((l) => {
          const p = l.at.clone().add(new THREE.Vector3(0, l.dy, 0)).project(camera);
          return { id: l.id, x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, short: w < NARROW };
        }),
      );
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    if (anchorsRef?.current) ro.observe(anchorsRef.current);
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
      const s = world.front.sentinel.group.userData;
      s.cage.rotation.y += dt * 0.5;
      s.cage.rotation.x += dt * 0.15;
      s.core.rotation.y -= dt * 0.3;
      world.front.sentinel.figure.position.y = 1.35 + (reduce ? 0 : Math.sin(t * 1.6) * 0.09);
      f.tricked = Math.max(0, f.tricked - dt);
      s.coreMat.emissive.setHex(f.tricked > 0 ? C.red : C.accent);
      s.coreMat.emissiveIntensity = f.tricked > 0 ? 1.4 : 0.6 + (reduce ? 0 : Math.sin(t * 2) * 0.15);

      // Each figure's disc glows in the colour of its last result, then settles back.
      for (const a of Object.values(world.front)) {
        a.flash = Math.max(0, a.flash - dt / 1.6);
        if (a.flash > 0) {
          a.padMat.emissive.copy(a.flashColor);
          a.padMat.emissiveIntensity = 0.12 + a.flash * 1.1;
        } else if (a.padMat.emissiveIntensity !== 0.12) {
          a.padMat.emissive.setHex(TINT[a.id]);
          a.padMat.emissiveIntensity = 0.12;
        }
      }

      // The needle follows the pressure.
      world.needle.rotation.z += ((world.needleTarget ?? world.needle.rotation.z) - world.needle.rotation.z) * Math.min(1, dt * 4);

      // The pump turns while it runs and coasts to a stop when the command executes.
      f.pumpSpeed += ((world.pumpTarget ?? 1) - f.pumpSpeed) * Math.min(1, dt * 1.2);
      world.impeller.rotation.z -= dt * 6 * f.pumpSpeed;

      // Water flows at the pump's speed.
      for (let i = 0; i < world.dropX.length; i++) {
        world.dropX[i] += dt * 3.2 * f.pumpSpeed;
        if (world.dropX[i] > 15) world.dropX[i] -= 30;
        tmp.position.set(world.dropX[i], 0.6 + world.dropJitter[i][0], -3 + world.dropJitter[i][1]);
        tmp.updateMatrix();
        world.drops.setMatrixAt(i, tmp.matrix);
      }
      world.drops.instanceMatrix.needsUpdate = true;

      // Keys fill their keyhole and turn when an operator's approval lands.
      for (const k of world.keys) {
        k.shown += (k.target - k.shown) * Math.min(1, dt * 6);
        k.fill.scale.setScalar(Math.max(0.001, k.shown));
        k.key.visible = k.shown > 0.5;
        k.key.rotation.z = (-Math.PI / 2) * ease(Math.min(1, Math.max(0, (k.shown - 0.5) * 2)));
      }

      // While a command waits, the ring breathes amber.
      if (world.ringPulse && !reduce) world.ringMat.emissiveIntensity = 0.35 + Math.sin(t * 3) * 0.25;

      // Shots travel in an arc from whoever acted to their target; refused ones bounce back.
      f.shots = f.shots.filter((sh) => {
        sh.t += dt / sh.dur;
        if (sh.t >= 1 && !sh.landed) {
          sh.landed = true;
          sh.onLand?.();
        }
        if (sh.t >= (sh.bounce ? 1.6 : 1)) {
          scene.remove(sh.mesh);
          return false;
        }
        const u = Math.min(1, sh.t);
        const p = sh.from.clone().lerp(sh.to, ease(u));
        p.y += Math.sin(Math.PI * u) * sh.arc;
        if (sh.t > 1 && sh.bounce) {
          const back = (sh.t - 1) / 0.6;
          p.copy(sh.to).lerp(sh.from, back * 0.35);
          p.y -= back * 1.4;
          sh.mesh.material.opacity = 1 - back;
        }
        sh.mesh.position.copy(p);
        return true;
      });

      // Rings that spread and fade where something was refused or opened.
      f.bursts = f.bursts.filter((b) => {
        b.t += dt / 0.8;
        if (b.t >= 1) {
          scene.remove(b.mesh);
          return false;
        }
        b.mesh.scale.setScalar(1 + b.t * 1.5);
        b.mesh.material.opacity = 0.9 * (1 - b.t);
        return true;
      });

      // A pulse running down the cable from the open lock to the pump.
      f.pulses = f.pulses.filter((p) => {
        p.t += dt / 1.1;
        if (p.t >= 1) {
          scene.remove(p.mesh);
          p.onLand?.();
          return false;
        }
        p.mesh.visible = p.t >= 0;
        p.mesh.position.copy(world.cableCurve.getPointAt(ease(Math.max(0, p.t))));
        return true;
      });

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
  }, [anchorsRef]);

  // State: gauge zones and needle, pipe colour, ring and cable colour, pump speed, keys.
  useEffect(() => {
    const w = worldRef.current;
    if (!w || !line || !thresholds) return;
    if (!w.zones) {
      w.zones = [
        [0, thresholds.alarmKpa, C.steel],
        [thresholds.alarmKpa, thresholds.tripKpa, C.amber],
        [thresholds.tripKpa, GAUGE_MAX, C.red],
      ].map(([from, to, color]) => {
        const arc = ((to - from) / GAUGE_MAX) * 1.5 * Math.PI;
        const m = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.07, 10, 64, arc), new THREE.MeshBasicMaterial({ color, transparent: color === C.steel, opacity: 0.35 }));
        m.rotation.z = gaugeAngle(to);
        m.position.z = 0.13;
        w.gauge.add(m);
        return m;
      });
    }
    const pressure = line.pressureKpa;
    w.needleTarget = gaugeAngle(pressure) - Math.PI / 2;
    const hot = pressure >= thresholds.tripKpa ? C.red : pressure >= thresholds.alarmKpa ? C.amber : null;
    w.pipeMat.color.setHex(hot ?? C.steel);
    w.pipeMat.opacity = hot ? 0.5 : 0.22;
    w.pumpTarget = line.pumps === "running" ? 0.35 + Math.min(1.2, Math.max(0, (pressure - 300) / 400)) : 0;
    const approvals = cmd?.approvals.length ?? 0;
    w.keys.forEach((k, i) => (k.target = i < approvals ? 1 : 0));
    const status = cmd?.status;
    const ringColor = status === "executed" ? C.green : status === "pending" ? C.amber : C.steel;
    w.ringMat.color.setHex(ringColor);
    w.ringMat.emissive.setHex(status === "executed" || status === "pending" ? ringColor : 0x000000);
    w.ringMat.emissiveIntensity = status === "executed" ? 0.5 : 0.35;
    w.ringPulse = status === "pending";
    w.cableMat.emissive.setHex(status === "executed" ? C.green : 0x000000);
    w.cableMat.emissiveIntensity = status === "executed" ? 0.8 : 0;
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
    const lockAt = () => w.lock.position.clone();
    const at = (id) => w.front[id].group.position.clone().add(new THREE.Vector3(0, id === "sentinel" ? 1.55 : 2.05, 0));
    const flash = (id, color) => {
      w.front[id].flash = 1;
      w.front[id].flashColor.setHex(color);
    };
    const shot = (from, to, color, { bounce = false, arc = 1.6, dur = 0.8, onLand } = {}) => {
      if (reduce) return onLand?.();
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.position.copy(from);
      w.scene.add(mesh);
      f.shots.push({ mesh, from, to, bounce, arc, dur, t: 0, onLand });
    };
    const burst = (where, color, size = 1.6) => {
      if (reduce) return;
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(size, 0.06, 8, 72), new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.position.copy(where);
      mesh.rotation.x = TILT;
      w.scene.add(mesh);
      f.bursts.push({ mesh, t: 0 });
    };
    const refused = (id) => {
      flash(id, C.red);
      shot(at(id), lockAt(), C.red, { bounce: true, onLand: () => burst(lockAt(), C.red) });
    };
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
          flash("sentinel", C.amber);
          shot(at("sentinel"), lockAt(), C.amber, { arc: 1.4, dur: 0.9, onLand: () => burst(lockAt(), C.amber) });
          break;
        case "ops-log.added":
          flash("attacker", C.red);
          shot(at("attacker"), at("sentinel"), 0xff7a7a, { arc: 1.8, dur: 0.8, onLand: () => (f.tricked = 1.8) });
          break;
        case "execute.refused":
        case "approval.refused":
          refused(who(e));
          break;
        case "approval.duplicate": {
          const id = who(e);
          flash(id, C.amber);
          shot(at(id), lockAt(), C.amber, { bounce: true, onLand: () => burst(lockAt(), C.amber) });
          break;
        }
        case "approval.recorded": {
          const id = who(e);
          flash(id, C.accent);
          const slot = w.lock.localToWorld(KEYHOLES[Math.min(1, (e.approvals ?? 1) - 1)].clone());
          shot(at(id), slot, C.accent, { arc: 1.4 });
          break;
        }
        case "command.executed":
          flash("kim", C.green);
          flash("raj", C.green);
          if (!reduce) {
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), new THREE.MeshBasicMaterial({ color: C.green }));
            mesh.visible = false;
            w.scene.add(mesh);
            f.pulses.push({ mesh, t: -0.5, onLand: () => burst(w.impeller.getWorldPosition(new THREE.Vector3()), C.green, 1.3) });
          }
          setTimeout(() => burst(lockAt(), C.green), 450);
          break;
        default:
      }
    }
  }, [run]);

  return (
    <div className="stage3d" ref={wrapRef}>
      {failed ? (
        <p className="stage-fallback">This browser can't draw the 3D view. The controls below still work.</p>
      ) : (
        <canvas ref={canvasRef} aria-label="Live view of Line 3's gauge, the two-key lock, the pump, and the five who can try to act" role="img" />
      )}
      {!failed &&
        spots.map((s) =>
          labelText[s.id] ? (
            <span key={s.id} className={`stage-label ${s.id} ${labelText[s.id].tone ?? ""}`} style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>
              {s.short ? labelText[s.id].short ?? labelText[s.id].text : labelText[s.id].text}
            </span>
          ) : null,
        )}
    </div>
  );
}
