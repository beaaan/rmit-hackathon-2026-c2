/*
 * film.js: the whole film as one pure function of time, render(t).
 *
 * Picture: screenshots of the real app (capture/capture.mjs), stacked in story order and cross-faded
 * on the frame each state changes, under a camera. The moving parts the screenshots can't carry
 * (water flow, the pump's rotor, signals travelling up their lines, flashes on the lock, button
 * presses) are redrawn on top in the app's own colours, from the geometry captured with the shots.
 *
 * Timing: every cue below is a word in the voice-over (assets/vo/take-a.mp3, ElevenLabs), placed by
 * VO_SEGMENTS. A cue written as v(P, sec) is "the word at sec in paragraph P's source audio".
 */
(function () {
  "use strict";
  const { E, clamp, mix, lmix } = window.MOTION;
  const G = window.GEO;
  const FPS = 60;

  // Voice-over placement and the cue helper live in timeline.js, shared with the sound.
  const { VO_SEGMENTS, BODY: TOTAL, HOOK, CARDS, SECONDS, v } = window.FILM;

  // ---- where things are, in page px --------------------------------------------------------
  const SX = G.stage.x;
  const SY = G.stage.y;
  const st = (x, y) => [SX + x, SY + y]; // stage coords to page coords
  const lockC = st(G.lock.x + G.lock.w / 2, G.lock.y + G.lock.h / 2);
  const card = (id) => G.cards[id];
  const cardC = (id) => [card(id).x + card(id).w / 2, card(id).y + card(id).h / 2];
  const btn = (actor, text) => G.buttons.find((b) => b.actor === actor && b.text === text);

  // ---- camera: [start, duration, cx, cy, zoom, ease], contiguous -----------------------------
  const CAM0 = { x: 540, y: 460, z: 1.75 };
  const CAM = [];
  // anchor: the target point travels to the centre of the frame in a straight line while the zoom runs
  // in log space, instead of the centre and zoom moving independently (a 10x zoom would swing it off-screen).
  const cam = (t0, dur, x, y, z, ease = E.cam, anchor = false) => CAM.push({ t0, dur, x, y, z, ease, anchor });

  // Framing rule: zoom stays at or under ~1.85, so the 2x screenshots are never upscaled (no softness),
  // and every shot frames a group of things (caption + line, lock + routes, cards), not empty stage.
  // Act 1, the problem: along Line 3 from the gauge to the pump and the city.
  cam(0, 5.2, 600, 460, 1.75, E.linear);
  cam(5.2, 2.3, 1360, 460, 1.75, E.cam);
  cam(7.5, 4.9, 1370, 455, 1.82, E.dolly);
  // Act 2, the rule: pull out to the whole page, then the lock, then the two operators.
  cam(12.4, 2.1, 960, 556, 1.0, E.cam);
  cam(14.5, 2.5, 960, 556, 1.03, E.dolly);
  cam(17.0, 1.6, 960, 520, 1.8, E.cam);
  cam(18.6, 1.7, 960, 520, 1.85, E.dolly);
  cam(20.3, 1.7, 1320, 700, 1.6, E.cam);
  cam(22.0, 2.3, 1320, 700, 1.64, E.dolly);
  // Act 3, the spike: the gauge, then Sentinel's request reaching the lock.
  cam(24.3, 1.5, 560, 440, 1.8, E.cam);
  cam(25.8, 1.7, 565, 440, 1.85, E.dolly);
  cam(27.5, 1.4, 760, 545, 1.3, E.cam);
  cam(28.9, 1.3, 960, 540, 1.75, E.cam);
  cam(30.2, 3.6, 960, 540, 1.82, E.dolly);
  // Act 4, the tricked AI.
  cam(33.8, 1.4, 640, 700, 1.6, E.cam);
  cam(35.2, 2.2, 640, 700, 1.64, E.dolly);
  cam(37.4, 2.0, 760, 560, 1.3, E.cam);
  cam(39.4, 1.9, 770, 560, 1.34, E.dolly);
  cam(41.3, 1.3, 620, 760, 1.8, E.cam);
  cam(42.6, 1.8, 620, 760, 1.85, E.dolly);
  // Act 5, the forged pass.
  cam(44.4, 1.3, 640, 770, 1.8, E.cam);
  cam(45.7, 1.1, 640, 770, 1.85, E.dolly);
  cam(46.8, 1.3, 800, 600, 1.4, E.cam);
  cam(48.1, 2.2, 805, 600, 1.44, E.dolly);
  // Act 6, the admin approving.
  cam(50.3, 1.3, 960, 700, 1.6, E.cam);
  cam(51.6, 4.0, 960, 700, 1.66, E.dolly);
  // Act 7, the admin promoting themselves.
  cam(55.6, 1.3, 960, 770, 1.8, E.cam);
  cam(56.9, 3.4, 960, 770, 1.86, E.dolly);
  cam(60.3, 1.7, 1320, 700, 1.6, E.cam);
  cam(62.0, 4.6, 1320, 700, 1.66, E.dolly);
  // Act 8, the real path.
  cam(66.6, 1.4, 1150, 650, 1.5, E.cam);
  cam(68.0, 5.4, 1160, 650, 1.56, E.dolly);
  cam(73.4, 1.3, 1250, 600, 1.5, E.cam);
  cam(74.7, 2.1, 1250, 600, 1.55, E.dolly);
  cam(76.8, 1.4, 1230, 450, 1.6, E.cam);
  cam(78.2, 0.9, 1230, 450, 1.63, E.dolly);
  cam(79.1, 1.3, 560, 440, 1.8, E.cam);
  cam(80.4, 1.6, 565, 440, 1.86, E.dolly);
  // Act 9, the control room (its own page, cut at 82.0).
  cam(82.0, 0.001, 1250, 455, 1.42, E.linear);
  cam(82.0, 2.0, 1260, 455, 1.47, E.dolly);
  cam(84.0, 1.6, 1085, 760, 1.15, E.cam);
  cam(85.6, 1.8, 1085, 770, 1.18, E.dolly);
  // Act 10, the close: back on the console after it all, then into the mark.
  cam(87.4, 0.001, 1100, 700, 1.45, E.linear);
  cam(87.4, 4.8, 960, 540, 1.0, E.dolly);
  cam(92.2, 1.45, 43.0, 38.4, 10, E.inOut, true);

  function camAt(t) {
    let cur = CAM0;
    for (const k of CAM) {
      if (t < k.t0) break;
      if (t < k.t0 + k.dur) {
        const p = k.ease(clamp((t - k.t0) / k.dur));
        const z = lmix(cur.z, k.z, p);
        if (k.anchor) {
          const sx = mix((k.x - cur.x) * cur.z, 0, p);
          const sy = mix((k.y - cur.y) * cur.z, 0, p);
          return { x: k.x - sx / z, y: k.y - sy / z, z };
        }
        return { x: mix(cur.x, k.x, p), y: mix(cur.y, k.y, p), z };
      }
      cur = k;
    }
    return { x: cur.x, y: cur.y, z: cur.z };
  }

  // ---- picture layers, in story order (later ones sit on top) --------------------------------
  // [file, time it fades in, fade length, kind] - kind: full | control | patch | clip:<x,y,w,h>
  const LAYERS = [
    ["ui/s00-idle", 0, 0, "full"],
    ...Array.from({ length: 10 }, (_, i) => [`gauge/s01-rise-${String(i).padStart(2, "0")}`, v(3, 23.5) + i * 0.3, 0.12, "patch"]),
  ];
  const SIGNALS = [];
  const FLASH = [];
  const PRESS = [];
  const RINGS = [];
  const GLOW = [];
  const layer = (file, t, dur = 0.2, kind = "full") => LAYERS.push([file, t, dur, kind]);
  // A signal up `path`: travels `up` seconds and lands at `land` (a refusal bounces back off the lock).
  function signal(path, color, land, up, bounce = false) {
    SIGNALS.push({ path, color, t0: land - up, up, back: up * 0.82, bounce });
    if (path === "wire" || path === "trick" || path === "sense") return;
    FLASH.push({ kind: "hit", color, t: land });
    if (bounce && color === "hot") FLASH.push({ kind: "refused", t: land });
  }
  const press = (actor, text, t) => {
    PRESS.push({ b: btn(actor, text), t });
    GLOW.push({ id: actor, t, color: actor === "attacker" ? "hot" : actor === "jo" ? "grey" : "live" });
  };
  const entryX = (path) => {
    const i = ["sentinel", "attacker", "jo", "kim", "raj"].indexOf(path);
    return G.lock.x + G.lock.w / 2 + (i - 2) * 34 * G.s;
  };

  // Act 1: Sentinel watches the gauge (a reading runs down its sensing line).
  signal("sense", "liveInk", v(1, 2.4), 1.4);
  // Act 2: the two keyholes, then the two operators.
  RINGS.push({ kind: "keyholes", t: v(2, 17.96) });
  GLOW.push({ id: "kim", t: v(2, 21.12), color: "live" }, { id: "raj", t: v(2, 21.3), color: "live" });
  RINGS.push({ kind: "card", id: "kim", t: v(2, 21.12) }, { kind: "card", id: "raj", t: v(2, 21.3) });
  // Act 3: Sentinel files its request.
  GLOW.push({ id: "sentinel", t: v(3, 26.9) - 0.9, color: "warm" });
  signal("sentinel", "warm", v(3, 27.38), 0.85);
  layer("ui/s02-pending", v(3, 27.38), 0.08);
  RINGS.push({ kind: "keyholes", t: v(3, 30.7) });
  // Act 4: the planted note, then Sentinel trying to run it.
  press("attacker", "Trick the AI", v(4, 33.08) - 0.1);
  signal("trick", "hot", v(4, 34.0), 0.95);
  GLOW.push({ id: "sentinel", t: v(4, 34.0), color: "hot" });
  signal("sentinel", "hot", v(4, 39.0), 1.25, true);
  layer("ui/s03-trick", v(4, 39.0), 0.08);
  // Act 5: the forged pass.
  press("attacker", "Forge a pass", v(5, 43.86) - 0.15);
  signal("attacker", "hot", v(5, 47.38), 0.95, true);
  layer("ui/s04-forged", v(5, 47.38), 0.08);
  // Act 6: Jo approves.
  press("jo", "Approve", v(6, 50.08));
  signal("jo", "hot", v(6, 52.44), 0.8, true);
  layer("ui/s05-jo", v(6, 52.44), 0.08);
  // Act 7: Jo asks TideCloak for the operator role.
  press("jo", "Make me operator", v(7, 54.54) - 0.05);
  layer("ui/s06-promote", v(7, 54.98), 0.08);
  RINGS.push({ kind: "card", id: "kim", t: v(7, 60.52) }, { kind: "card", id: "raj", t: v(7, 60.68) });
  // Act 8: Kim, Kim again, Raj, and the command reaching the pump.
  press("kim", "Approve", v(8, 66.12) + 0.1);
  signal("kim", "live", v(8, 67.24), 0.85);
  layer("ui/s07-kim", v(8, 67.24), 0.08);
  press("kim", "Approve", v(8, 68.3));
  signal("kim", "warm", v(8, 69.38), 0.8, true);
  layer("ui/s08-kim-again", v(8, 69.38), 0.08);
  press("raj", "Approve", v(8, 71.0));
  signal("raj", "live", v(8, 73.14), 1.15);
  FLASH.push({ kind: "key2", t: v(8, 73.14) });
  layer("ui/s09-raj", v(8, 73.14) + 0.5, 0.25, `clip:${SX + G.lock.x - 30},${SY + G.lock.y - 72},${G.lock.w + 140},${G.lock.h + 100}`);
  const RAN = v(8, 75.5); // the stop command reaches the pump
  signal("wire", "ok", RAN, 1.15);
  FLASH.push({ kind: "pump", t: RAN });
  layer("ui/s09-raj", RAN, 0.08);
  for (let i = 0; i < 16; i++) layer(`gauge/s09-fall-${String(i).padStart(2, "0")}`, v(8, 76.3) + 0.35 + i * 0.19, 0.1, "patch");
  // Act 9 and 10.
  const CONTROL = [82.0, 87.4];
  layer("ui/s10-control-full", CONTROL[0], 0, "control");
  RINGS.push({ kind: "hash", t: v(9, 80.74) });
  layer("ui/s09-fall-15", CONTROL[1], 0, "full");

  // ---- VFX on the beats that matter: refusals jolt, keys ripple, the payoff punches in ----
  const T = window.FILM.T;
  const REFUSALS = [T.sentinelRefused, T.forgeRefused, T.joRefused, T.kimAgainRefused];
  const KEYS = [[T.kimKey, 0], [T.rajKey, 1]];
  // [t, amplitude px, duration s] - a decaying two-axis shake in screen space.
  const SHAKES = [...REFUSALS.map((t) => [t, 4, 0.45]), [RAN, 6, 0.6]];
  // [t, zoom gain, duration s] - a quick push in that relaxes back.
  const PUNCHES = [...REFUSALS.map((t) => [t, 0.018, 0.7]), ...KEYS.map(([t]) => [t, 0.012, 0.7]), [RAN, 0.035, 1.4]];
  // [t, colour, peak opacity, duration s] - the frame's edges flush with the beat's colour.
  const EDGES = []; // tried: a coloured wash at the frame edges muddied the picture
  const bump = (q) => (q < 0 || q > 1 ? 0 : q < 0.14 ? E.out(q / 0.14) : 1 - E.smooth((q - 0.14) / 0.86));
  function shakeAt(t) {
    let x = 0;
    let y = 0;
    for (const [t0, a, d] of SHAKES) {
      const dt = t - t0;
      if (dt < 0 || dt > d) continue;
      const env = a * Math.exp(-5.5 * dt) * (1 - dt / d);
      x += env * Math.sin(2 * Math.PI * 11 * dt);
      y += env * Math.sin(2 * Math.PI * 13 * dt + 1.3);
    }
    return [x, y];
  }
  const punchAt = (t) => PUNCHES.reduce((z, [t0, g, d]) => z * (1 + g * bump((t - t0) / d)), 1);

  // ---- moving parts ----------------------------------------------------------------------------
  // Speeds as functions of time, integrated per frame so stopping and restarting stay smooth.
  const N = Math.ceil(TOTAL * FPS) + 2;
  const HOOK_CUT = v(1, 10.48); // "could cut a city's water"
  const HOOK_BACK = v(2, 12.18); // "Two-Person Rule changes that"
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const rotorSpeed = (t) => {
    // 400 deg/s while running; slows to a stop on "cut" and starts again on the turn; stops for good when the command lands.
    const hook = t < HOOK_BACK ? 1 - ramp(t, HOOK_CUT, HOOK_CUT + 0.9) : ramp(t, HOOK_BACK, HOOK_BACK + 0.8);
    return 400 * hook * (1 - ramp(t, RAN, RAN + 0.35));
  };
  const downstreamSpeed = (t) => (t < HOOK_BACK ? 1 - ramp(t, HOOK_CUT, HOOK_CUT + 0.7) : ramp(t, HOOK_BACK, HOOK_BACK + 0.8));
  const ROTOR = new Float64Array(N);
  const FLOW_DOWN = new Float64Array(N);
  for (let f = 1; f < N; f++) {
    const t = f / FPS;
    ROTOR[f] = ROTOR[f - 1] + rotorSpeed(t) / FPS;
    FLOW_DOWN[f] = FLOW_DOWN[f - 1] + (downstreamSpeed(t) * 14) / 0.6 / FPS;
  }
  const sampleArr = (arr, t) => {
    const x = clamp(t * FPS, 0, N - 1);
    const i = Math.floor(x);
    return mix(arr[i], arr[Math.min(N - 1, i + 1)], x - i);
  };

  const COLORS = { live: "#3d6bff", liveInk: "#9db4ff", hot: "#ff6b6d", warm: "#ffb020", ok: "#3ddc8c", grey: "#9aa1ad" };
  const quadOut = (p) => 1 - (1 - p) ** 2;

  // ---- DOM ------------------------------------------------------------------------------------------
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, val] of Object.entries(attrs)) n.setAttribute(k, val);
    if (parent) parent.appendChild(n);
    return n;
  };
  let camEl, vfxEl, layerEls, ov, stageG, parts;

  function build() {
    camEl = document.getElementById("cam");
    vfxEl = document.getElementById("vfx");
    const stack = document.getElementById("stack");
    layerEls = LAYERS.map(([file, t, dur, kind]) => {
      const img = document.createElement("img");
      // Full frames load only around their moment on screen (render() sets src), so at most a few
      // 3840x2160 bitmaps are decoded at once; the small gauge patches load up front.
      const src = `assets/${file}.png`;
      if (kind === "patch") img.src = src;
      img.className = kind === "patch" ? "patch" : "layer";
      if (kind === "control") img.classList.add("tall");
      if (kind === "patch") {
        img.style.left = "174px";
        img.style.top = "284px";
      }
      if (kind.startsWith("clip:")) {
        const [x, y, w, h] = kind.slice(5).split(",").map(Number);
        img.style.clipPath = `inset(${y}px ${1920 - x - w}px ${1080 - y - h}px ${x}px round 18px)`;
      }
      stack.appendChild(img);
      return { img, src, t, dur, kind, cover: kind === "full" || kind === "control", lazy: kind !== "patch" };
    });

    ov = document.getElementById("ov");
    // No frame inside the frame: everything outside the console is painted the console's own colour,
    // so no white page or rounded edge ever slides through a shot. The headline and the logo are
    // redrawn light on the dark.
    const C = G.console;
    parts = {};
    parts.page = el("g", {}, ov);
    el("path", {
      d: `M-4000,-4000 H6000 V6000 H-4000 Z M${C.x + 2},${C.y + 2 + 28} a28,28 0 0 1 28,-28 H${C.x + C.w - 2 - 28} a28,28 0 0 1 28,28 V${C.y + C.h - 2 - 28} a28,28 0 0 1 -28,28 H${C.x + 2 + 28} a28,28 0 0 1 -28,-28 Z`,
      fill: "#0b0d13",
      "fill-rule": "evenodd",
    }, parts.page);
    parts.hero = el("g", {}, parts.page);
    parts.logo = el("g", {}, parts.page);
    const hero = el("text", { x: G.hero.x, y: G.hero.y + 56, "font-size": 73.6, "font-weight": 800, "letter-spacing": "-3.68", fill: "#f3f5fa" }, parts.hero);
    hero.innerHTML = 'The AI can ask. <tspan fill="#5b85ff">Two people decide.</tspan>';
    el("circle", { cx: 39.33, cy: 38.4, r: 6.42, fill: "#f3f5fa" }, parts.logo);
    el("circle", { cx: 46.67, cy: 38.4, r: 6.42, fill: "#3d6bff", opacity: 0.9 }, parts.logo);
    const word = el("text", { x: 58, y: 44.5, "font-size": 17, "font-weight": 700, "letter-spacing": "-0.3", fill: "#f3f5fa" }, parts.logo);
    word.textContent = "Two-Person Rule";
    stageG = el("g", { transform: `translate(${SX} ${SY})` }, ov);

    // Water flow along Line 3, in three runs between the gauge and the pump.
    const y = G.pipe.y;
    const runs = [
      [0, G.gauge.x - G.gauge.r],
      [G.gauge.x + G.gauge.r, G.pump.x - G.pump.r],
      [G.pump.x + G.pump.r, G.stage.w],
    ];
    parts.flow = el("g", {}, stageG);
    parts.runs = runs.map(([a, b]) => {
      const g = el("g", {}, parts.flow);
      el("line", { x1: a, y1: y, x2: b, y2: y, stroke: "#161b26", "stroke-width": 7 }, g);
      const dash = el("line", { x1: a, y1: y, x2: b, y2: y, stroke: COLORS.live, "stroke-width": 4, "stroke-dasharray": "2 12", "stroke-linecap": "round", opacity: 0.9 }, g);
      return { g, dash, a };
    });

    // The pump's rotor, drawn over the screenshot's still one.
    const p = G.pump;
    parts.rotor = el("g", { transform: `translate(${p.x} ${p.y})` }, stageG);
    el("circle", { r: p.r - 1.5, fill: "#10141d" }, parts.rotor);
    parts.rotorSpin = el("g", {}, parts.rotor);
    for (const a of [0, 120, 240]) el("path", { d: "M0,0 C4,-10 12,-16 18,-14", transform: `rotate(${a})`, fill: "none", stroke: "#f3f5fa", "stroke-width": 3, "stroke-linecap": "round" }, parts.rotorSpin);
    el("circle", { r: 4, fill: "#f3f5fa" }, parts.rotorSpin);
    parts.pumpFlash = el("circle", { cx: p.x, cy: p.y, r: p.r, fill: COLORS.ok, opacity: 0 }, stageG);

    // The screenshots catch the lock's fading "Refused" at random points: cover it, draw our own.
    const L = G.lock;
    el("rect", { x: L.x + L.w + 6, y: L.y + L.h - 22, width: 92, height: 22, fill: "#0b0d13" }, stageG);
    parts.refused = el("text", { x: L.x + L.w + 12 * G.s, y: L.y + L.h - 6 * G.s, fill: COLORS.hot, "font-size": 11, "font-weight": 700, "letter-spacing": "0.08em", opacity: 0 }, stageG);
    parts.refused.textContent = "REFUSED";

    // Port glows, the second key, flashes on the lock, bursts.
    parts.glows = GLOW.map((gl) => {
      const port = G.ports.find((q) => q.id === gl.id);
      return { ...gl, n: el("circle", { cx: port.x, cy: port.y, r: port.r, fill: COLORS[gl.color], opacity: 0 }, stageG) };
    });
    const k2 = G.keyholes[1];
    parts.key2 = el("g", { opacity: 0 }, stageG);
    el("circle", { cx: k2.x, cy: k2.y, r: k2.r, fill: COLORS.live }, parts.key2);
    const k2t = el("text", { x: k2.x, y: k2.y + 6, "text-anchor": "middle", "font-size": 17, "font-weight": 800, fill: "#fff" }, parts.key2);
    k2t.textContent = "R";
    parts.flash = FLASH.map((fl) => {
      if (fl.kind === "hit") return { ...fl, n: el("rect", { x: L.x, y: L.y, width: L.w, height: L.h, rx: L.rx, fill: "none", stroke: COLORS[fl.color], "stroke-width": 4, opacity: 0 }, stageG) };
      if (fl.kind === "burst") return { ...fl, n: el("circle", { cx: fl.x, cy: L.y + L.h, r: 14, fill: "none", stroke: COLORS.hot, "stroke-width": 2, opacity: 0 }, stageG) };
      return { ...fl };
    });

    // Shockwaves: red off the lock for each refusal, blue off a keyhole for each key, green off the pump.
    const lockMid = [L.x + L.w / 2, L.y + L.h / 2];
    parts.waves = [
      ...REFUSALS.map((t) => ({ t, c: lockMid, r0: 70, r1: 165, w: 2.5, color: COLORS.hot, d: 0.65 })),
      ...KEYS.map(([t, i]) => ({ t, c: [G.keyholes[i].x, G.keyholes[i].y], r0: G.keyholes[i].r, r1: 70, w: 2.5, color: COLORS.live, d: 0.7 })),
      { t: RAN, c: [G.pump.x, G.pump.y], r0: G.pump.r, r1: 210, w: 3, color: COLORS.ok, d: 1.1 },
      { t: RAN, c: lockMid, r0: 70, r1: 160, w: 2.5, color: COLORS.ok, d: 0.9 },
    ].map((w) => ({ ...w, n: el("circle", { cx: w.c[0], cy: w.c[1], r: w.r0, fill: "none", stroke: w.color, "stroke-width": w.w, opacity: 0 }, stageG) }));

    // Signals: sampled once, then placed by time.
    const probe = el("path", { fill: "none", stroke: "none" }, stageG);
    const samples = {};
    for (const [name, d] of Object.entries(G.routes)) {
      probe.setAttribute("d", d);
      const len = probe.getTotalLength();
      samples[name] = Array.from({ length: 241 }, (_, i) => {
        const q = probe.getPointAtLength((len * i) / 240);
        return [q.x, q.y];
      });
    }
    parts.samples = samples;
    parts.signals = SIGNALS.map((sg) => {
      const g = el("g", { opacity: 0 }, stageG);
      el("circle", { r: sg.path === "sense" ? 9 : 13, fill: COLORS[sg.color], opacity: 0.22 }, g);
      el("circle", { r: sg.path === "sense" ? 4 : 6, fill: COLORS[sg.color] }, g);
      return { ...sg, g };
    });

    // Presses: the app's own "ping" ring around the button, and a quick lift of its fill.
    const pg = el("g", {}, ov);
    parts.press = PRESS.map((pr) => {
      const b = pr.b;
      const fill = el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.h / 2, fill: "#ffffff", opacity: 0 }, pg);
      const ring = el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.h / 2, fill: "none", stroke: COLORS.live, "stroke-width": 3, opacity: 0 }, pg);
      return { ...pr, fill, ring };
    });

    // Rings that point at things the voice names.
    parts.rings = RINGS.map((r) => {
      if (r.kind === "keyholes") return { ...r, n: G.keyholes.map((k) => el("circle", { cx: SX + k.x, cy: SY + k.y, r: k.r, fill: "none", stroke: COLORS.live, "stroke-width": 2.5, opacity: 0 }, ov)) };
      if (r.kind === "card") {
        const c = card(r.id);
        return { ...r, n: [el("rect", { x: c.x, y: c.y, width: c.w, height: 58, rx: 18, fill: "none", stroke: COLORS.live, "stroke-width": 2.5, opacity: 0 }, ov)], box: c };
      }
      return { ...r, n: [el("rect", { x: 1712, y: 663, width: 155, height: 30, rx: 15, fill: "none", stroke: COLORS.ok, "stroke-width": 2.5, opacity: 0 }, ov)] };
    });

    // The close: the page whitens around its own mark, which the camera flies into.
    parts.veil = el("rect", { x: -200, y: -200, width: 2400, height: 1600, fill: "#ffffff", opacity: 0 }, ov);
    parts.mark = el("g", { opacity: 0 }, ov);
    parts.markInk = el("circle", { cx: 39.33, cy: 38.4, r: 6.42, fill: "#111111" }, parts.mark);
    el("circle", { cx: 46.67, cy: 38.4, r: 6.42, fill: "#1a4be0", style: "mix-blend-mode:multiply" }, parts.mark);
  }

  // ---- render(t): everything on screen at time t ----------------------------------------------
  const fade = (t, t0, dur, ease = E.smooth) => (dur <= 0 ? (t >= t0 ? 1 : 0) : ease(clamp((t - t0) / dur)));
  const onLanding = (t) => t < CONTROL[0] || t >= CONTROL[1];

  function renderBody(t) {
    // Camera.
    const c = camAt(t);
    if (t < 92.2) {
      // Keep the frame inside the page (the control room's page is taller).
      const pageH = t >= CONTROL[0] && t < CONTROL[1] ? 1233 : 1080;
      c.x = clamp(c.x, 960 / c.z, 1920 - 960 / c.z);
      c.y = clamp(c.y, 540 / c.z, pageH - 540 / c.z);
    }
    const z = c.z * punchAt(t);
    const [sx, sy] = shakeAt(t);
    camEl.style.transform = `translate(${(960 - c.x * z + sx).toFixed(2)}px, ${(540 - c.y * z + sy).toFixed(2)}px) scale(${z.toFixed(5)})`;
    // The headline and the logo show only when the frame holds them whole: never cut by the top edge.
    const frameTop = c.y - 540 / z;
    const frameLeft = c.x - 960 / z;
    parts.hero.setAttribute("opacity", Math.min(clamp((100 - frameTop) / 30, 0, 1), clamp((50 - frameLeft) / 22, 0, 1)).toFixed(3));
    parts.logo.setAttribute("opacity", t >= 92.2 ? 1 : clamp((22 - frameTop) / 12, 0, 1).toFixed(3));

    // Shockwaves and edge flushes.
    for (const w of parts.waves) {
      const q = (t - w.t) / w.d;
      if (q < 0 || q > 1) {
        w.n.setAttribute("opacity", 0);
        continue;
      }
      w.n.setAttribute("r", mix(w.r0, w.r1, E.out(q)).toFixed(2));
      w.n.setAttribute("stroke-width", mix(w.w, 0.5, q).toFixed(2));
      w.n.setAttribute("opacity", (0.75 * (1 - E.smooth(q))).toFixed(3));
    }
    let edge = null;
    for (const [t0, rgb, peak, d] of EDGES) {
      const o = peak * bump((t - t0) / d);
      if (o > 0.001 && (!edge || o > edge[1])) edge = [rgb, o];
    }
    vfxEl.style.opacity = edge ? edge[1].toFixed(3) : 0;
    if (edge) vfxEl.style.background = `radial-gradient(ellipse at center, rgba(${edge[0]},0) 52%, rgba(${edge[0]},0.85) 100%)`;

    // Layers: fade in on their cue; anything under a fully opaque full layer is hidden.
    let top = 0;
    layerEls.forEach((L, i) => {
      L.o = t < L.t ? 0 : fade(t, L.t, L.dur);
      if (L.cover && L.o >= 1) top = i;
    });
    layerEls.forEach((L, i) => {
      L.img.style.opacity = i < top ? 0 : L.o;
      L.img.style.visibility = i < top || L.o === 0 ? "hidden" : "visible";
      if (L.lazy) {
        const need = i >= top && t >= L.t - 0.6;
        const has = L.img.hasAttribute("src");
        if (need && !has) L.img.setAttribute("src", L.src);
        if (!need && has) L.img.removeAttribute("src");
      }
    });

    const land = onLanding(t);
    stageG.style.visibility = land && t < 93.6 ? "visible" : "hidden";
    parts.page.style.visibility = land && t < 93.6 ? "visible" : "hidden";

    // Flow: upstream keeps moving; downstream stops on the hook's "cut"; all of it dims when the command lands.
    const up = -((t * 14) / 0.6);
    const down = -sampleArr(FLOW_DOWN, t);
    const stopped = fade(t, RAN + 0.1, 0.8);
    parts.runs.forEach((r, i) => {
      r.dash.setAttribute("stroke-dashoffset", ((i === 2 ? down : up) % 14).toFixed(3));
      const dim = i === 2 ? 0.9 - 0.6 * (1 - downstreamSpeed(t)) : 0.9;
      r.dash.setAttribute("opacity", dim.toFixed(3));
      r.g.setAttribute("opacity", (1 - stopped).toFixed(3));
    });

    // Rotor spins until the command lands, then hands over to the screenshot's green, stopped rotor.
    parts.rotorSpin.setAttribute("transform", `rotate(${(sampleArr(ROTOR, t) % 360).toFixed(2)})`);
    parts.rotor.setAttribute("opacity", (1 - fade(t, RAN + 0.15, 0.3)).toFixed(3));

    // Signals.
    for (const sg of parts.signals) {
      const s = parts.samples[sg.path];
      const span = sg.bounce ? sg.up + sg.back : sg.up;
      const lt = t - sg.t0;
      if (lt < 0 || lt > span) {
        sg.g.setAttribute("opacity", 0);
        continue;
      }
      let f;
      let o = 1;
      if (!sg.bounce || lt <= sg.up) f = quadOut(clamp(lt / sg.up));
      else {
        const q = clamp((lt - sg.up) / sg.back);
        f = 1 - quadOut(q) * 0.92;
        o = 1 - q;
      }
      if (!sg.bounce && lt > sg.up - 0.12) o = clamp((sg.up - lt) / 0.12 + 0.0001); // absorbed on arrival
      const x = f * 240;
      const i = Math.floor(x);
      const [x1, y1] = s[i];
      const [x2, y2] = s[Math.min(240, i + 1)];
      sg.g.setAttribute("transform", `translate(${mix(x1, x2, x - i).toFixed(2)} ${mix(y1, y2, x - i).toFixed(2)})`);
      sg.g.setAttribute("opacity", o.toFixed(3));
    }

    // Lock flashes, bursts, our own "Refused", the second key, the pump's flash.
    let refused = 0;
    for (const fl of parts.flash) {
      const lt = t - fl.t;
      if (fl.kind === "hit") fl.n.setAttribute("opacity", lt < 0 ? 0 : (1 - E.outSoft(clamp(lt / 0.75))).toFixed(3));
      if (fl.kind === "burst") {
        const q = clamp(lt / 0.7);
        const sc = mix(0.4, 2.8, E.outSoft(q));
        fl.n.setAttribute("r", (14 * sc).toFixed(2));
        fl.n.setAttribute("opacity", lt < 0 || q >= 1 ? 0 : (1 - q).toFixed(3));
      }
      if (fl.kind === "refused" && lt >= 0 && lt < 1.6) refused = Math.max(refused, lt < 0.2 ? E.out(lt / 0.2) : 1 - E.in(clamp((lt - 0.2) / 1.4)));
    }
    parts.refused.setAttribute("opacity", refused.toFixed(3));
    const k2 = FLASH.find((fl) => fl.kind === "key2").t;
    parts.key2.setAttribute("opacity", t < k2 ? 0 : t < RAN ? E.out(clamp((t - k2) / 0.2)) : 1 - fade(t, RAN, 0.22));
    const pf = t - RAN;
    parts.pumpFlash.setAttribute("opacity", pf < 0 ? 0 : (0.85 * (1 - E.outSoft(clamp(pf / 1.2)))).toFixed(3));

    for (const gl of parts.glows) {
      const lt = t - gl.t;
      const q = clamp(lt / 1.1);
      gl.n.setAttribute("opacity", lt < 0 || q >= 1 ? 0 : (1 - E.outSoft(q)).toFixed(3));
      gl.n.setAttribute("r", (8 * mix(1.6, 1, E.outSoft(q))).toFixed(2));
    }

    // Presses.
    for (const pr of parts.press) {
      const lt = t - pr.t;
      const q = clamp(lt / 0.65);
      const off = 10 * E.outSoft(q);
      pr.ring.setAttribute("opacity", lt < 0 || q >= 1 || !land ? 0 : (0.95 * (1 - q)).toFixed(3));
      pr.ring.setAttribute("x", pr.b.x - off);
      pr.ring.setAttribute("y", pr.b.y - off);
      pr.ring.setAttribute("width", pr.b.w + off * 2);
      pr.ring.setAttribute("height", pr.b.h + off * 2);
      pr.ring.setAttribute("rx", pr.b.h / 2 + off);
      pr.fill.setAttribute("opacity", lt < 0 || lt > 0.3 || !land ? 0 : (0.22 * (1 - lt / 0.3)).toFixed(3));
    }

    // Rings.
    for (const r of parts.rings) {
      r.n.forEach((n, i) => {
        const lt = t - r.t - i * 0.12;
        const q = clamp(lt / 0.8);
        const visible = lt >= 0 && q < 1 && (r.kind === "hash" ? !land : land);
        n.setAttribute("opacity", visible ? (0.95 * (1 - E.in(q))).toFixed(3) : 0);
        const grow = 8 * E.outSoft(q);
        if (r.kind === "keyholes") n.setAttribute("r", (G.keyholes[i].r + grow).toFixed(2));
        else {
          const b = r.kind === "card" ? { x: r.box.x, y: r.box.y, w: r.box.w, h: 58 } : { x: 1712, y: 663, w: 155, h: 30 };
          n.setAttribute("x", b.x - grow);
          n.setAttribute("y", b.y - grow);
          n.setAttribute("width", b.w + 2 * grow);
          n.setAttribute("height", b.h + 2 * grow);
        }
      });
    }

    // The close.
    const veil = fade(t, 92.55, 0.75);
    parts.veil.setAttribute("opacity", veil.toFixed(3));
    // The mark's ink turns from light (on the dark page) to the brand's near-black as the page whitens.
    const ink = Math.round(mix(243, 17, veil));
    parts.markInk.setAttribute("fill", `rgb(${ink},${ink},${Math.round(mix(250, 17, veil))})`);
    parts.mark.setAttribute("opacity", t >= 92.2 && t < 93.62 ? 1 : 0);
    renderEnd(t);
  }

  // ---- the cold open (screen space): four headlines land one after another, each marked as it settles ----
  const CARD_ROT = [-1.6, 1.2, -0.8, 1.4];
  let hookEls;
  function renderHook(t) {
    hookEls ??= {
      cam: document.getElementById("hookcam"),
      cards: CARDS.map((_, i) => {
        const c = document.getElementById(`card${i + 1}`);
        return { c, mk: c.querySelector(".mk"), dim: c.querySelector(".dim") };
      }),
    };
    // Opacity, not visibility: HyperFrames owns a clip's visibility, and other renderers have no runtime.
    const hookEl = document.getElementById("hook");
    if (t >= HOOK) {
      hookEl.style.opacity = 0;
      return;
    }
    // A slow push, a small knock as each headline lands.
    let knock = 1;
    let kx = 0;
    let ky = 0;
    for (const a of CARDS) {
      const dt = t - a - 0.12;
      knock *= 1 + 0.018 * bump(dt / 0.6);
      if (dt > 0 && dt < 0.45) {
        const env = 6 * Math.exp(-7 * dt) * (1 - dt / 0.45);
        kx += env * Math.sin(2 * Math.PI * 12 * dt);
        ky += env * Math.sin(2 * Math.PI * 14 * dt + 0.9);
      }
    }
    hookEls.cam.style.transform = `translate(${kx.toFixed(2)}px, ${ky.toFixed(2)}px) scale(${((1 + 0.05 * E.dolly(clamp(t / HOOK))) * knock).toFixed(4)})`;
    hookEls.cards.forEach((k, i) => {
      const a = CARDS[i];
      const p = E.out(clamp((t - a) / 0.6));
      k.c.style.opacity = clamp((t - a) / 0.18).toFixed(3);
      k.c.style.transform = `translateY(${((1 - p) * 90).toFixed(2)}px) rotate(${(CARD_ROT[i] + (1 - p) * 3 * Math.sign(CARD_ROT[i])).toFixed(3)}deg)`;
      k.mk.style.backgroundSize = `${(100 * E.smooth(clamp((t - a - 0.5) / 0.55))).toFixed(2)}% 100%`;
      // Older headlines sink back as the next one lands; all of them as the film takes over.
      const next = CARDS[i + 1];
      const sink = next == null ? 0 : 0.55 * E.smooth(clamp((t - next - 0.1) / 0.4));
      const end = 0.25 * E.smooth(clamp((t - (HOOK - 1.3)) / 0.6));
      k.dim.style.opacity = Math.min(0.8, sink + end).toFixed(3);
    });
    // The film's first shot (the plant, same dark stage) shows through as the headlines fade.
    hookEl.style.opacity = (1 - E.smooth(clamp((t - (HOOK - 0.7)) / 0.7))).toFixed(3);
  }

  function render(t) {
    renderHook(t);
    renderBody(Math.max(0, t - HOOK));
  }

  // ---- end card (screen space): the mark slides aside for the name, then one line, then the URL ----
  let endEls;
  function renderEnd(t) {
    endEls ??= {
      root: document.getElementById("end"),
      lockup: document.getElementById("lockup"),
      mark: document.getElementById("endmark"),
      name: document.getElementById("endname"),
      line: document.getElementById("endline"),
      url: document.getElementById("endurl"),
    };
    // The clip (data-start = HOOK + 93.6) is hidden by HyperFrames' runtime; opacity covers other renderers.
    endEls.root.style.opacity = t >= 93.6 ? 1 : 0;
    if (t < 93.6) return;
    // The mark arrives where the camera left it (centred, r = 64) and slides left as the name rises.
    const slide = E.glide(clamp((t - 93.62) / 0.9));
    endEls.mark.style.transform = `translateX(${mix(endEls.centreOffset, 0, slide).toFixed(2)}px)`;
    const nameP = E.outSoft(clamp((t - 93.78) / 0.6));
    endEls.name.style.opacity = nameP.toFixed(3);
    endEls.name.style.transform = `translateY(${(1 - nameP) * 0.2 * 120}px)`;
    const lineP = E.outSoft(clamp((t - v(10, 89.86)) / 0.6));
    endEls.line.style.opacity = lineP.toFixed(3);
    endEls.line.style.transform = `translateY(${(1 - lineP) * 0.2 * 48}px)`;
    const urlP = E.outSoft(clamp((t - 96.3) / 0.6));
    endEls.url.style.opacity = urlP.toFixed(3);
    // A slow creep keeps the hold alive.
    const creep = 1 + 0.025 * E.dolly(clamp((t - 94.4) / (TOTAL - 94.4)));
    endEls.lockup.style.transform = `scale(${creep.toFixed(4)})`;
  }

  // ---- timeline ------------------------------------------------------------------------------------
  window.FILM_TIMES = { VO_SEGMENTS, TOTAL, RAN, CONTROL, SIGNALS, FLASH, PRESS, LAYERS, v };

  function start() {
    build();
    // Where the name will push the mark from: the mark starts centred on the frame.
    const m = document.getElementById("endmark").getBoundingClientRect();
    endEls = null;
    renderEnd(0);
    endEls.centreOffset = 960 - (m.left + m.width / 2);
    const clock = { t: 0 };
    const tl = gsap.timeline({ paused: true });
    tl.to(clock, { t: SECONDS, duration: SECONDS, ease: "none", onUpdate: () => render(clock.t) });
    render(0);
    window.__timelines["main"] = tl;
  }

  document.fonts.load('700 120px "Schibsted Grotesk"').then(() => document.fonts.ready).then(start);
})();
