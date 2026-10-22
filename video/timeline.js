/*
 * timeline.js: the film's timing, shared by the picture (film.js) and the sound (FILM.cues()).
 *
 * The film is cut to its voice-over (assets/vo/take-a.mp3), so cues are seconds: v(P, sec) is the
 * word at `sec` in paragraph P of the source audio, moved to where VO_SEGMENTS places that
 * paragraph in the film. Keep index.html's root data-duration equal to TOTAL / FPS.
 */
(function (root) {
  'use strict';
  const MOTION = root.MOTION || (typeof require === 'function' ? require('./motion.js') : null);
  if (!MOTION) throw new Error('timeline.js: load motion.js first');
  const { FPS, BPM, pace, wordCount, holdFor, readingWindows } = MOTION;

  // Paragraphs of the voice-over: [source start, source end, offset into the film] in seconds.
  const VO_SEGMENTS = [
    [0.0, 11.7, 0.5],
    [12.06, 22.7, 0.7],
    [23.1, 32.0, 1.7],
    [32.4, 42.4, 1.9],
    [42.8, 48.15, 2.1],
    [48.5, 53.25, 2.3],
    [53.55, 64.15, 2.5],
    [64.5, 77.3, 3.3],
    [77.55, 82.15, 4.5],
    [82.4, 91.2, 5.3],
  ];
  const v = (p, sec) => sec + VO_SEGMENTS[p - 1][2];
  // The cold open: four real headlines before the film proper. Everything after it (the voice-over,
  // the body's cues below) is written in body time and moved by HOOK.
  const HOOK = 8.0;
  const BODY = 99.5;
  const SECONDS = HOOK + BODY;
  const CARDS = [0.3, 1.9, 3.5, 5.1]; // each headline starts to rise
  const TOTAL = Math.round(SECONDS * FPS);
  const f = (sec) => Math.round(sec * FPS);

  const ACT = {
    hook: { from: 0, dur: f(HOOK) },
    problem: { from: f(HOOK), dur: f(12.4) },
    rule: { from: f(HOOK + 12.4), dur: f(24.3 - 12.4) },
    spike: { from: f(HOOK + 24.3), dur: f(33.8 - 24.3) },
    attacks: { from: f(HOOK + 33.8), dur: f(66.6 - 33.8) },
    realPath: { from: f(HOOK + 66.6), dur: f(82.0 - 66.6) },
    audit: { from: f(HOOK + 82.0), dur: f(87.4 - 82.0) },
    close: { from: f(HOOK + 87.4), dur: TOTAL - f(HOOK + 87.4) },
  };

  // What happens when, in seconds; film.js draws these and the sound plays them.
  const T = {
    trick: v(4, 33.08) - 0.1, // Attacker presses "Trick the AI"
    trickLands: v(4, 34.0), // the planted order reaches Sentinel
    sentinelAsks: v(3, 27.38), // Sentinel's request reaches the lock
    sentinelRefused: v(4, 39.0), // the tricked Sentinel bounces off the lock
    forge: v(5, 43.86) - 0.15,
    forgeRefused: v(5, 47.38),
    joApprove: v(6, 50.08),
    joRefused: v(6, 52.44),
    promote: v(7, 54.54) - 0.05,
    promoteShown: v(7, 54.98),
    kimApprove: v(8, 66.12) + 0.1,
    kimKey: v(8, 67.24),
    kimAgain: v(8, 68.3),
    kimAgainRefused: v(8, 69.38),
    rajApprove: v(8, 71.0),
    rajKey: v(8, 73.14),
    ran: v(8, 75.5), // the stop command reaches the pump
    control: 82.0,
    back: 87.4,
    markFly: 92.2,
    name: 93.78,
    line: v(10, 89.86),
    url: 96.3,
  };

  const COPY = [
    ...CARDS.map((c, i) => ({ id: `hook.${i + 1}`, text: ["wiped out a software company's database", 'resorts to blackmail', "Hijacked Google's Gemini AI", "contaminate US town's water supply"][i], in: f(c), resolved: f(c + 1.0), out: f(HOOK) })),
    { id: 'end.name', text: 'Two-Person Rule', in: f(HOOK + T.name), resolved: f(HOOK + T.name + 0.6), out: TOTAL },
    { id: 'end.line', text: 'Built with TideCloak', in: f(HOOK + T.line), resolved: f(HOOK + T.line + 0.6), out: TOTAL },
    { id: 'end.url', text: 'github.com/beaaan/rmit-hackathon-2026-c2', in: f(HOOK + T.url), resolved: f(HOOK + T.url + 0.6), out: TOTAL },
  ];
  const READ = readingWindows(COPY, pace, FPS, TOTAL);

  // Stage x (page px) to a gentle pan.
  const pan = (x) => Math.max(-0.5, Math.min(0.5, ((x - 960) / 960) * 0.5));
  const X = { sentinel: 226, attacker: 593, jo: 960, kim: 1327, raj: 1694, lock: 960, pump: 1500 };

  function cues() {
    const at = (sec, kind, weight, x, id, extra = {}) => ({ f: f(sec), kind, weight, pan: pan(x), id, ...extra });
    const ev = (sec, ...rest) => at(HOOK + sec, ...rest);
    const events = [
      ...CARDS.flatMap((c, i) => [
        at(c + 0.14, 'land', 0.9, [700, 1240, 680, 1220][i], `headline-${i + 1}`),
        at(c + 0.55, 'tick', 0.7, [700, 1240, 680, 1220][i], `highlight-${i + 1}`),
      ]),
      at(HOOK - 0.45, 'whoosh', 0.7, 960, 'into-the-plant', { dur: 42, apexFrac: 0.7 }),
      ev(T.sentinelAsks, 'land', 0.6, X.lock, 'sentinel-asks', { variant: 'light' }),
      ev(T.trick, 'click', 0.8, X.attacker, 'press-trick'),
      ev(T.trickLands, 'tock', 0.6, X.sentinel, 'trick-lands'),
      ev(T.sentinelRefused, 'snap', 1.0, X.lock, 'refused-sentinel'),
      ev(T.forge, 'click', 0.8, X.attacker, 'press-forge'),
      ev(T.forgeRefused, 'snap', 1.0, X.lock, 'refused-forged'),
      ev(T.joApprove, 'click', 0.8, X.jo, 'press-jo'),
      ev(T.joRefused, 'snap', 1.0, X.lock, 'refused-jo'),
      ev(T.promote, 'click', 0.8, X.jo, 'press-promote'),
      ev(T.promoteShown, 'land', 0.5, X.jo, 'promote-shown', { variant: 'light' }),
      ev(T.kimApprove, 'click', 0.8, X.kim, 'press-kim'),
      ev(T.kimKey, 'bell', 0.8, X.lock, 'key-1', { note: 'D5' }),
      ev(T.kimAgain, 'click', 0.8, X.kim, 'press-kim-again'),
      ev(T.kimAgainRefused, 'snap', 1.0, X.lock, 'refused-kim-again'),
      ev(T.rajApprove, 'click', 0.8, X.raj, 'press-raj'),
      ev(T.rajKey, 'bell', 0.9, X.lock, 'key-2', { note: 'G5' }),
      ev(T.ran, 'hit', 1.0, X.pump, 'pumps-stop'),
      ev(T.control - 0.25, 'whoosh', 0.6, 960, 'to-control-room', { dur: 30, apexFrac: 0.8 }),
      ev(T.back - 0.25, 'whoosh', 0.6, 960, 'back-to-console', { dur: 30, apexFrac: 0.8 }),
      ev(T.markFly + 1.0, 'whoosh', 0.9, 960, 'into-the-mark', { dur: f(1.45), apexFrac: 0.7 }),
      ev(T.name + 0.6, 'text', 0.8, 960, 'end-name'),
      ev(T.line + 0.6, 'text', 0.7, 960, 'end-line'),
    ].sort((p, q) => p.f - q.f);
    const copy = COPY.map((c) => ({ ...c, words: wordCount(c.text), kind: 'copy', read: READ[c.id] || [] }));
    return { fps: FPS, bpm: BPM, total: TOTAL, pace: MOTION.PACE_NAME, acts: ACT, cue: Object.fromEntries(Object.entries(T).map(([k, s]) => [k, f(HOOK + s)])), copy, events };
  }

  const FILM = { FPS, BPM, ACT, TOTAL, SECONDS, HOOK, BODY, CARDS, VO_SEGMENTS, v, T, COPY, READ, PACE_NAME: MOTION.PACE_NAME, PACE: MOTION.PACE, cues, holdFor };
  root.FILM = FILM;
  if (typeof module === 'object' && module.exports) module.exports = FILM;
})(typeof window !== 'undefined' ? window : globalThis);
