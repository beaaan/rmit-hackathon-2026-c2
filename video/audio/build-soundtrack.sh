#!/usr/bin/env bash
# Rebuild assets/soundtrack.wav (107.5 s, 48 kHz / 24-bit stereo, ~-16 LUFS, TP <= -1.5 dBTP).
#   1. effects track from the kit:   scripts/audio/score.py -> out/sfx.wav (+ stems, QA json)
#   2. designed accents on top:      numpy synthesis (headline slams, denied impacts, payoff boom,
#                                    whooshes, highlighter swishes), onset/apex on frame/60 s
#   3. mix + master:                 VO delayed 8.000 s (cold open), effects ducked 5 dB under speech
#                                    (not in the payoff window), -16 LUFS, true-peak limit, 1.3 s fade
#   4. verify:                       ffprobe duration, ffmpeg ebur128 loudness / true peak
# Usage (from anywhere):  bash audio/build-soundtrack.sh        SKIP_SCORE=1 to reuse out/sfx.wav
# Needs python3 with numpy, scipy, soundfile, pyloudnorm; ffmpeg/ffprobe on PATH.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p out/stems out/qa
if [ "${SKIP_SCORE:-0}" != "1" ]; then
  python3 scripts/audio/score.py --cues out/cues.json --score audio/score.json \
    --out out/sfx.wav --stems out/stems --json out/qa/score.json --lufs -20
fi

python3 - <<'PY'
import json
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy import signal
from scipy.ndimage import maximum_filter1d, minimum_filter1d

SR, FPS = 48000, 60
N = 5_160_000                      # 107.5 s exactly
VO_DELAY = 8.0                     # cold open before the body timeline
TARGET_LUFS, CEIL_DBTP = -16.0, -1.8
DUCK_DB = 5.0
OUT = 'assets/soundtrack.wav'

cues = json.load(open('out/cues.json'))
assert cues['fps'] == FPS and cues['total'] == 6450
EV = {e['id']: e for e in cues['events']}
T = lambda i: EV[i]['f'] / FPS     # cue frames are on the full film timeline (cold open included)


def load(p):
    x, sr = sf.read(p, dtype='float64', always_2d=True)
    assert sr == SR, (p, sr)
    return np.repeat(x, 2, 1) if x.shape[1] == 1 else x


def fit(x, n=N):
    return x[:n] if len(x) >= n else np.vstack([x, np.zeros((n - len(x), x.shape[1]))])


# ---------------------------------------------------------------- synthesis helpers
def tt(d): return np.arange(int(round(d * SR))) / SR
def sos(kind, f, order=2): return signal.butter(order, f, kind, fs=SR, output='sos')
def lp(x, f, o=2): return signal.sosfilt(sos('lowpass', f, o), x)
def hp(x, f, o=2): return signal.sosfilt(sos('highpass', f, o), x)
def bp(x, lo, hi, o=2): return signal.sosfilt(sos('bandpass', [lo, hi], o), x)


def sweep(d, f0, f1, tau):
    """sine whose pitch falls exponentially f0 -> f1 (time constant tau): the body of a thump"""
    t = tt(d)
    return np.sin(2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t / tau)) / SR)


def env(d, att, tau, rel=0.05):
    t = tt(d)
    e = np.exp(-np.maximum(t - att, 0) / tau) * (np.clip(t / att, 0, 1) if att > 0 else 1)
    r = int(rel * SR)
    e[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return e


def verb(mono, rt60, wet, seed):
    """mono -> stereo with a short synthetic room (decorrelated decaying noise IR)"""
    r = np.random.default_rng(seed + 991)
    t = tt(rt60 * 1.1)
    e = 10 ** (-3 * t / rt60) * np.clip(t / 0.004, 0, 1)
    ir = np.stack([lp(r.standard_normal(len(t)) * e, 5000), lp(r.standard_normal(len(t)) * e, 5000)], 1)
    ir /= np.sqrt((ir ** 2).sum(0).mean())
    pre = int(0.012 * SR)
    y = np.stack([signal.fftconvolve(mono, ir[:, c]) for c in (0, 1)], 1)
    y = np.vstack([np.zeros((pre, 2)), y])
    out = np.zeros((len(y), 2))
    out[:len(mono)] += mono[:, None]
    return out + wet * y


def pan(st, p):
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.stack([st[:, 0] * np.cos(a) * np.sqrt(2), st[:, 1] * np.sin(a) * np.sqrt(2)], 1)


def svf_bp(x, fc, q):
    """TPT state-variable band-pass with a per-sample cutoff"""
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    y = np.empty_like(x); s1 = s2 = 0.0
    for i in range(len(x)):
        v3 = x[i] - s2
        v1 = a1[i] * s1 + a2[i] * v3
        v2 = s2 + a2[i] * s1 + a3[i] * v3
        s1 = 2 * v1 - s1; s2 = 2 * v2 - s2
        y[i] = v1
    return y


# ---------------------------------------------------------------- the designed accents
def headline(seed, k):
    """punchy low impact for a headline card slam: pitch-dropping sub + knock + lowpassed crack"""
    r = np.random.default_rng(seed); d = 1.1
    sub = sweep(d, 130 * k, 46 * k, 0.035) * env(d, 0.0015, 0.20, 0.1)
    knock = sweep(d, 260 * k, 170 * k, 0.02) * env(d, 0.001, 0.045) * 0.45
    crack = hp(lp(r.standard_normal(len(sub)), 4500), 250) * env(d, 0.0005, 0.010) * 0.6
    x = np.tanh(1.6 * (sub + knock + crack)) / np.tanh(1.6)
    return verb(x, 0.9, 0.12, seed)


def denied(seed):
    """short hard 'denied': low thump + a buzzy edge (two detuned bandlimited saws, a semitone apart)"""
    r = np.random.default_rng(seed); d = 0.7; t = tt(d)
    thump = sweep(d, 95, 52, 0.03) * env(d, 0.0015, 0.11, 0.1)
    bz = np.zeros_like(t)
    for f0, ph in ((92.5, 0.0), (98.0, 1.3)):
        for h in range(1, int(5000 / f0)):
            bz += np.sin(2 * np.pi * f0 * h * t + ph * h) / h
    bz = bp(bz, 250, 3200)
    benv = np.clip(t / 0.003, 0, 1) * np.where(t < 0.075, 1.0, np.exp(-(t - 0.075) / 0.035))
    bz = np.tanh(2.5 * bz / np.abs(bz).max()) * benv * 0.42
    crack = hp(r.standard_normal(len(t)), 1500) * env(d, 0.0003, 0.006) * 0.25
    x = thump + bz + crack
    return verb(x, 0.6, 0.10, seed)


def payoff(seed):
    """deep boom with a release: falling sub + punch, then a pressure-release hiss and a G-major bloom"""
    r = np.random.default_rng(seed); d = 4.0; t = tt(d)
    sub = sweep(d, 75, 33, 0.09) * env(d, 0.002, 0.85, 0.4)
    punch = sweep(d, 160, 85, 0.04) * env(d, 0.001, 0.09) * 0.5
    crack = hp(lp(r.standard_normal(len(t)), 5000), 200) * env(d, 0.0005, 0.014) * 0.6
    boom = np.tanh(1.3 * (sub + punch + crack)) / np.tanh(1.3)
    hiss = lp(bp(r.standard_normal(len(t)), 500, 4000), 2600)
    henv = np.clip((t - 0.06) / 0.3, 0, 1) ** 1.5 * np.exp(-np.maximum(t - 0.36, 0) / 0.9)
    hiss = hiss / np.abs(hiss).max() * henv * 0.10
    chord = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((98.0, .5), (146.83, .35), (196.0, .3), (246.94, .18)))
    chord *= np.clip(t / 0.25, 0, 1) * np.exp(-t / 1.5) * 0.22
    x = (boom + hiss + chord) * env(d, 0, 1e9, 0.5)
    return verb(x, 2.2, 0.18, seed)


def whoosh(dur, apex_frac, seed, f_lo=250, f_hi=1600, width=0.5, tail=0.35, q=1.1):
    """band-passed pink noise, cutoff and level rising to the apex then falling; pans across.
    Returns (stereo, apex offset in s)."""
    r = np.random.default_rng(seed)
    d = dur + tail; n = int(round(d * SR)); t = np.arange(n) / SR; a = apex_frac * dur
    pink = signal.lfilter([0.049922035, -0.095993537, 0.050612699, -0.004408786],
                          [1, -2.494956002, 2.017265875, -0.522189400], r.standard_normal(n))
    rise = np.clip(t / a, 0, 1); fall = np.clip((t - a) / (d - a), 0, 1)
    fc = np.where(t < a, f_lo * (f_hi / f_lo) ** (rise ** 1.5), f_hi * (1.5 * f_lo / f_hi) ** (fall ** 0.7))
    y = svf_bp(pink, fc, q)
    amp = np.where(t < a, rise ** 2.2, np.exp(-(t - a) / ((d - a) * 0.3)))
    k = int(0.03 * SR); amp[-k:] *= np.linspace(1, 0, k)
    y = y * amp
    y /= np.abs(y).max()
    p = -width + 2 * width * t / d
    ang = (p + 1) * np.pi / 4
    return np.stack([y * np.cos(ang) * np.sqrt(2), y * np.sin(ang) * np.sqrt(2)], 1), a


# ---------------------------------------------------------------- loudness helpers
METER = pyln.Meter(SR)
M400 = pyln.Meter(SR, block_size=0.400)


def mmax(x, hop=0.05):
    """max momentary (400 ms) loudness of a short sound"""
    w = int(0.4 * SR)
    if len(x) < w: x = np.vstack([x, np.zeros((w - len(x), 2))])
    vals = [M400.integrated_loudness(x[i:i + w]) for i in range(0, len(x) - w + 1, int(hop * SR))]
    return max(v for v in vals if np.isfinite(v))


def momentary(x, t0, t1, hop=0.1):
    w = int(0.4 * SR); out = []
    for s in np.arange(t0, t1 - 0.4 + 1e-9, hop):
        i = int(s * SR); v = M400.integrated_loudness(x[i:i + w])
        out.append(v if np.isfinite(v) else -99.0)
    return np.array(out)


# ---------------------------------------------------------------- inputs
vo = fit(np.vstack([np.zeros((int(VO_DELAY * SR), 2)), load('out/vo-placed.wav')]))
bed = fit(load('out/sfx.wav'))

# VO speech reference: median momentary loudness where the voice is talking
vm = momentary(vo, 0, N / SR)
M_VO = float(np.median(vm[vm > -40]))
print(f'VO (delayed) integrated {METER.integrated_loudness(vo):.2f} LUFS, speech median momentary {M_VO:.2f} LUFS')

# ---------------------------------------------------------------- build the accent bus
acc = np.zeros((N + 10 * SR, 2))
added = []


def place(x, start, target_rel, label, src, ref_t):
    """x scaled so its max momentary loudness = M_VO + target_rel, first sample at `start` s"""
    g = 10 ** ((M_VO + target_rel - mmax(x)) / 20)
    i = int(round(start * SR))
    acc[i:i + len(x)] += x * g
    added.append(dict(id=label, t=round(ref_t, 4), start=round(start, 4), level_rel_vo_db=target_rel, source=src))


for n in range(1, 5):                       # cold open: bold, no VO yet
    e = EV[f'headline-{n}']
    x = pan(headline(100 + n, (1.0, 0.94, 1.05, 0.9)[n - 1]), 0.6 * e['pan'])
    place(x, T(e['id']), -1.0, e['id'], 'numpy: sub thump 130->46 Hz + knock + crack, room 0.9 s', T(e['id']))
for n in range(1, 5):                       # highlighter sweep: a quick bright marker swish from the frame
    e = EV[f'highlight-{n}']
    x, a = whoosh(0.30, 0.25, 200 + n, f_lo=1400, f_hi=4800, width=0.25, tail=0.12, q=1.6)
    x = pan(x, e['pan'])
    place(x, T(e['id']), -9.0, e['id'], 'numpy: band-passed noise swish 1.4->4.8 kHz, 0.42 s', T(e['id']))
for i, k in enumerate(('refused-sentinel', 'refused-forged', 'refused-jo', 'refused-kim-again')):
    place(denied(300 + i), T(k), +2.0, k, 'numpy: thump 95->52 Hz + detuned saw buzz 92.5/98 Hz, 0.15 s edge', T(k))
place(payoff(400), T('pumps-stop'), -1.0, 'pumps-stop',
      'numpy: sub boom 75->33 Hz + punch + crack, pressure-release hiss, G-major bloom, room 2.2 s', T('pumps-stop'))
for k, rel, lo, hi, w in (('into-the-plant', -6.0, 220, 1700, 0.6), ('to-control-room', -4.0, 260, 1500, 0.5),
                          ('back-to-console', -4.0, 260, 1500, -0.5), ('into-the-mark', -5.0, 180, 1400, 0.4)):
    e = EV[k]
    dur = e['dur'] / FPS
    x, a = whoosh(dur, e['apexFrac'], 500 + e['f'] % 97, f_lo=lo, f_hi=hi, width=w)
    place(x, T(k) - a, rel, k, f'numpy: soft whoosh {dur:.2f} s, apex on frame (apexFrac {e["apexFrac"]})', T(k))
acc = acc[:N]

# ---------------------------------------------------------------- ducking under the voice
mono = vo.mean(1)
hopn = 48                                    # 1 ms control rate
frames = mono[: N // hopn * hopn].reshape(-1, hopn)
rms_db = 10 * np.log10(np.convolve((frames ** 2).mean(1), np.ones(30) / 30, 'same') + 1e-14)
act = (rms_db > -50).astype(float)
act = maximum_filter1d(act, 250)             # bridge gaps between words (250 ms)
act = np.roll(act, -30); act[-30:] = 0       # 30 ms lookahead
sm = np.empty_like(act); s = 0.0
for i, v in enumerate(act):                  # attack 25 ms, release 300 ms
    s += (v - s) * (1 - np.exp(-1 / (25 if v > s else 300)))
    sm[i] = s
tc = np.arange(len(sm)) / 1000.0
tp_ = T('pumps-stop')
exempt = np.clip(np.minimum((tc - (tp_ - 0.4)) / 0.2, ((tp_ + 3.5) - tc) / 0.4), 0, 1)  # payoff not ducked
exempt[tc < VO_DELAY] = 1.0                                                            # cold open
duck_db = -DUCK_DB * sm * (1 - exempt)
duck = 10 ** (np.interp(np.arange(N) / SR, tc, duck_db) / 20)

# bed level: its event loudness ~4 dB under the voice before ducking
bm = momentary(bed, 0, N / SR)
BED_REL = -4.0
bed_g = 10 ** ((M_VO + BED_REL - float(np.percentile(bm[bm > -60], 90))) / 20)
print(f'bed gain {20 * np.log10(bed_g):+.2f} dB')

fx = (bed * bed_g + acc) * duck[:, None]
mix = vo + fx

# ---------------------------------------------------------------- master
def tp_limit(x, ceil_db):
    c = 10 ** (ceil_db / 20)
    pk = np.abs(x).max(1)
    for ch in (0, 1):
        up = signal.resample_poly(x[:, ch], 4, 1)
        pk = np.maximum(pk, np.abs(up[: 4 * len(x)]).reshape(-1, 4).max(1))
    req = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    L = int(0.004 * SR) | 1
    g = minimum_filter1d(req, L)
    g = 1 - maximum_filter1d(1 - g, int(0.05 * SR))       # 50 ms hold, fewer gain wobbles
    h = np.hanning(L); h /= h.sum()
    g = np.minimum(np.convolve(np.pad(g, L // 2, mode='edge'), h, 'valid'), g)
    tp_limit.g = g
    return x * g[:, None], float(20 * np.log10(g.min()))


fade = int(1.3 * SR)
fcurve = np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
mix[-fade:] *= fcurve[:, None]

gain = 10 ** ((TARGET_LUFS - METER.integrated_loudness(mix)) / 20)
for it in range(4):
    y, gr = tp_limit(mix * gain, CEIL_DBTP)
    L = METER.integrated_loudness(y)
    print(f'master pass {it}: gain {20 * np.log10(gain):+.2f} dB, LUFS {L:.2f}, max limiting {gr:.2f} dB')
    if abs(L - TARGET_LUFS) < 0.05: break
    gain *= 10 ** ((TARGET_LUFS - L) / 20)
y[-480:] = 0.0
gdb = 20 * np.log10(tp_limit.g[::480])  # 10 ms
for sec in sorted(set(int(i / 100) for i in np.where(gdb < -1.0)[0])):
    w = gdb[sec * 100:(sec + 1) * 100]
    print(f'  limiter: {sec}-{sec + 1} s  max {w.min():.1f} dB at {sec + np.argmin(w) / 100:.2f} s')
assert len(y) == N
sf.write(OUT, y, SR, subtype='PCM_24')

# ---------------------------------------------------------------- QA: alignment + voice vs effects
def onset_near(x, t, win=0.06):
    """time of the steepest rise of the <200 Hz + >2 kHz energy (2 ms hops) within t +- win"""
    i0, i1 = int((t - win) * SR), int((t + win) * SR)
    seg = x[i0 - 960:i1].mean(1)
    lo = lp(seg, 200, 4); hi = hp(seg, 2000, 4)
    h = 96
    def edb(z):
        f = z[: len(z) // h * h].reshape(-1, h)
        return 10 * np.log10((f ** 2).mean(1) + 1e-14)
    d = np.maximum(np.diff(edb(lo)), np.diff(edb(hi)))[10:]
    j = int(np.argmax(d))
    return (i0 - 960 + (j + 11) * h) / SR - t

vo_m = vo * gain
qa = []
for a in added:
    ev_t = a['t']
    off = onset_near(y, ev_t) if not a['id'].startswith(('into-', 'to-', 'back-')) else None
    fx_m = momentary(fx * gain, max(0, ev_t - 0.2), ev_t + 0.8, 0.05).max()
    vw = momentary(vo_m, max(0, ev_t - 3), min(N / SR, ev_t + 3))
    vo_ref = float(np.median(vw[vw > -45])) if (vw > -45).any() else None
    qa.append(dict(a, onset_offset_ms=None if off is None else round(off * 1000, 1),
                   fx_momentary_lufs=round(float(fx_m), 1), vo_nearby_momentary_lufs=None if vo_ref is None else round(vo_ref, 1)))
for q in qa:
    print(json.dumps(q))
json.dump(dict(lufs_vo_speech_momentary=M_VO, bed_gain_db=20 * np.log10(bed_g), master_gain_db=20 * np.log10(gain),
               accents=qa), open('out/qa/soundtrack.json', 'w'), indent=1)
PY

echo "--- verify"
ffprobe -v error -show_entries stream=sample_rate,channels,bits_per_raw_sample,duration_ts,duration -of default=nw=1 assets/soundtrack.wav
ffmpeg -hide_banner -nostats -i assets/soundtrack.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "^ +(I|LRA|Peak|Threshold):"
