# Demo video and submission

The brief: a demo video of **2:00 or less**, `.mp4`, **under 100 MB**, saved in the repo. Deadline
**Fri 23 Oct 2026, 10:00 AEDT** (Thu 22 Oct, 23:00 UTC). Form: https://forms.gle/HRHYjnqB86j1LFS97

## Before recording

- `npm run realm -- status` shows jo, kim and raj linked, kim and raj with `plant-operator`, 3 admins,
  2 approvals needed, and no pending change requests (deny any leftover one in tide-console first).
- `npm run demo` (it says "TideCloak mode"). Three Chrome profiles, each signed in at
  http://localhost:3000: **Jo**, **Kim**, **Raj**. Make each window at least 1280 px wide so the five
  cards sit in one row under the diagram; zoom 110–125 % reads better on video.
- In the Kim and Raj profiles, a second tab on tide-console → **QEA Approvals**:
  http://localhost:8080/realms/riverbend/tide-console/
- Press **Start over** in any window. The diagram is live in every window, so you can stay on Jo's
  window for the opening and switch windows only for Kim's and Raj's clicks.
- Record each segment separately (OBS or QuickTime, 1080p, 30 fps) and cut. Waiting for the enclave or
  a page load is dead time: cut it.

## Script (2:00)

Voice-over is about 220 words, roughly 1:35 of speech, which leaves room for the clicks.

| Time | Window | On screen / what to click | Voice-over |
|---|---|---|---|
| 0:00–0:12 | Jo | Headline "The AI can ask. Two people decide." and the idle diagram, water flowing | "AI could watch a water plant around the clock and catch trouble in seconds. But no plant lets it near the controls: one stolen key, or one tricked AI, could cut a city's water." |
| 0:12–0:22 | Jo | Slow scroll so the whole console is in frame | "Two-Person Rule changes that. The AI can propose anything. A command runs only when two operators approve, and TideCloak makes sure nobody can fake being one." |
| 0:22–0:34 | Jo | **Start a pressure spike**. The gauge climbs into amber; Sentinel's amber signal reaches the lock: "Request: stop Line 3's pumps", 0 of 2 | "Line 3's pressure spikes. Sentinel, our AI, drafts a shutdown with its evidence. The lock needs two operator keys." |
| 0:34–0:46 | Jo | Attacker → **Trick the AI**. A red signal reaches Sentinel, then Sentinel's bounces off the lock: "Refused" | "An attacker plants an order in Sentinel's maintenance log. Sentinel obeys and tries to run the shutdown itself. Refused: the AI holds no credentials at all." |
| 0:46–0:54 | Jo | Attacker → **Forge a pass**. Red bounce, "Forged pass blocked" | "A forged operator pass looks right, but Tide's network never signed it. Refused." |
| 0:54–1:02 | Jo | Jo → **Approve**. Red bounce, "Not an operator" | "Jo runs IT and is signed in for real. Jo's approval doesn't count." |
| 1:02–1:24 | Jo, then Kim, then Raj | Jo → **Make me operator** → "Admins 0 of 2" → **Open in TideCloak**: the request in QEA Approvals. Cut to Kim's tide-console tab → **Deny**; Raj's → **Deny**. Back to Jo's card: "Admins said no" | "So Jo grants themselves the operator role. TideCloak doesn't apply it: with three admins, every role change needs two approvals, and no server can sign for them. Kim and Raj say no." |
| 1:24–1:40 | Kim, then Raj | Kim → **Approve**: a blue signal fills the first keyhole, "1 of 2". **Approve again**: amber bounce, "Twice counts once". Raj → **Approve**: second keyhole, the line to the pump turns green, the pump stops, the flow stops | "Now the real path. Kim approves: one key. Kim again: still one key. Raj approves from another device: two keys, the stop command reaches the pump, and the pressure falls." |
| 1:40–1:52 | Raj | **Control room** (top right): the pressure chart dropping, the audit trail with "Hash chain intact" | "Every proposal, refusal and approval is in a hash-chained audit trail." |
| 1:52–2:00 | Jo | Back to the headline; end card: "Two-Person Rule · Built with TideCloak" and the repo URL | "Critical sites get the AI's speed, and no AI, insider or server can act alone." |

If a segment runs long, cut the "Approve again" beat first, then the forged pass.

## Export

```bash
ffmpeg -i in.mov -vcodec libx264 -crf 28 demo/demo.mp4
```

If it won't play everywhere (some players reject 4:4:4 colour) or you need it smaller or shorter:

```bash
ffmpeg -i in.mov -t 120 -vf "scale=1920:-2" -c:v libx264 -crf 28 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart demo/demo.mp4
```

Check it: `ffprobe -v error -show_entries format=duration -of csv=p=0 demo/demo.mp4` is at most 120,
and `ls -lh demo/demo.mp4` is under 100 MB (raise `-crf` to 30–32 if not). Then
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
- [ ] Form submitted **before 10:00 AEDT Fri 23 Oct**: https://forms.gle/HRHYjnqB86j1LFS97
