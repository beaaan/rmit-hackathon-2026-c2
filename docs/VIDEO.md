# Demo video and submission

The brief: a demo video of **2:00 or less**, `.mp4`, **under 100 MB**, saved in the repo. Deadline for
our team: **Thu 22 Oct 2026, 6:00 pm Vietnam time** (11:00 UTC; see `docs/CHALLENGE.md`). Form:
https://forms.gle/HRHYjnqB86j1LFS97

## How the video is made

The video is built in code, not screen-recorded. It is a HyperFrames HTML composition in `video/`
(1920×1080, 60 fps, 107.5 s):

- `video/index.html`: the composition, including the cold open.
- `video/film.js`: the picture as a function of time. The captured screens sit under a camera, and the
  moving parts (water flow, the pump, signals travelling up their lines, flashes on the lock, button
  presses) are redrawn on top from the geometry captured with the screens.
- `video/timeline.js`: timing shared by picture and sound. Each cue is placed on a word of the
  voice-over.
- `video/capture/capture.mjs`: drives the running demo (`npm run demo`) with puppeteer and saves a
  screenshot of each state, plus the stage geometry, to `video/assets/ui/`. The UI in the film is the real
  app, not a mock-up.
- The voice-over was generated with ElevenLabs (`video/assets/vo/take-a.mp3`).
  `video/assets/soundtrack.wav` is the audio track muxed into the film.

The cold open (8 s) shows four real news headlines, each cited on screen by outlet and date: three
about AI agents going wrong (Fortune, July 2025; BBC News, May 2025; WIRED, August 2025) and one about
a hacker trying to contaminate a US town's water supply (Al Jazeera, February 2021).

The app was captured in **rehearsal mode**. On submission day Tide's network couldn't license new
realms (`setUpTideRealm` returned 500 `TIDE-IDPEXT-VENDOR-KEYGEN_FAILED`, repeatedly, on a clean
container). The organisers' [Plan C](https://tide.org/unlocked/#plan-c) guidance is to build as though
TideCloak protects the prototype and simulate those protections, and it is judged the same as a live
integration. `npm run realm` and TideCloak mode stay in the repo for a live realm.

## What's in it

| Time | Act | On screen |
|---|---|---|
| 0:00–0:08 | Cold open | The four headlines |
| 0:08–0:20 | The problem | Line 3, from the pressure gauge to the pump and the city |
| 0:20–0:32 | The rule | The whole console, the two-key lock, the two operators |
| 0:32–0:42 | The spike | The gauge climbs; Sentinel's shutdown request reaches the lock, 0 of 2 |
| 0:42–1:15 | The attacks | The tricked AI is refused, the forged pass is blocked, Jo's approval doesn't count, and Jo's request to become an operator waits for two admins |
| 1:15–1:30 | The real path | Kim approves (1 of 2), Kim again (still 1), Raj approves: the pumps stop and the pressure falls |
| 1:30–1:35 | Audit | The control room's audit trail, hash chain intact |
| 1:35–1:48 | Close | End card with the repo URL |

## Rebuild the video

Needs Node ≥ 20.9, ffmpeg and a Chrome or Chromium binary (set `CHROME_PATH` if `capture.mjs` can't
find one). In one terminal, from the repo root, run the demo in rehearsal mode (no
`controller/tidecloak.json`):

```bash
npm run demo
```

In another:

```bash
cd video && npm install
node capture/capture.mjs        # refreshes assets/ui/ from http://localhost:3000
```

The submitted file was rendered with `capture/render.mjs`, which seeks the composition frame by frame
in headless Chrome over a pipe and encodes with ffmpeg (on the laptop, HyperFrames' own renderer kept
losing its localhost connection to Chrome). Render it in four parallel chunks, then join them and mux
the soundtrack into `demo/demo.mp4`:

```bash
node capture/render.mjs out/part-1.mp4 0 27 &
node capture/render.mjs out/part-2.mp4 27 54 &
node capture/render.mjs out/part-3.mp4 54 81 &
node capture/render.mjs out/part-4.mp4 81 107.5 &
wait
bash capture/finish.sh assets/soundtrack.wav
```

`bash scripts/hf-finish.sh . out/film.mp4 --audio assets/soundtrack.wav` is the HyperFrames route to
the same picture, where its renderer works.

Check it: `ffprobe -v error -show_entries format=duration -of csv=p=0 demo/demo.mp4` is at most 120,
and `ls -lh demo/demo.mp4` is under 100 MB (raise `-crf` to 26–28 if not). Then
`git add demo/demo.mp4 && git commit -m "Add the demo video" && git push`.

## Submission checklist

- [ ] `demo/demo.mp4` committed: 2:00 or less, under 100 MB, plays.
- [ ] Everything merged into `master` (the default branch is what judges see).
- [ ] No secrets in git: `git ls-files | grep -E '(^|/)\.env$|tidecloak\.json$'` prints nothing, and
      `git log --all --oneline -- .env controller/tidecloak.json` prints nothing.
- [ ] README overview still 300 words or fewer:
      `awk '/^## Project overview/{f=1} /^## Setup/{f=0} f' README.md | wc -w`
- [ ] Repo **public**: GitHub → Settings → General → Danger Zone → Change repository visibility.
- [ ] Logged out (a private window): the README renders with the badge and the five sections, and
      `demo/demo.mp4` plays in GitHub's viewer.
- [ ] Form submitted **before Thu 22 Oct, 6:00 pm Vietnam time**: https://forms.gle/HRHYjnqB86j1LFS97
