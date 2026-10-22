# Handoff: finishing on the laptop

Written Thu 22 Oct 2026 by the cloud session. Deadline for our team: **Thu 22 Oct, 6:00 pm Vietnam
time** (11:00 UTC; see `docs/CHALLENGE.md`). Everything below needs your browser, your Docker, or
both, which the cloud session can't reach.

## Update, Thu 22 Oct afternoon

- Licensing failed: `npm run realm` stopped at `setUpTideRealm` with 500
  `TIDE-IDPEXT-VENDOR-KEYGEN_FAILED` (Midgard FinalizeWallet), repeatedly, on a clean container. The
  organisers then told every team to simulate TideCloak's protections, judged the same as a live
  integration ([Plan C](https://tide.org/unlocked/#plan-c)). The submission runs in **rehearsal
  mode**, and steps 2 to 5 below are skipped for it. They still apply to a live realm.
- Done: the demo video is built in code under `video/` from screens captured in rehearsal mode
  (replaces step 6). How to rebuild and export it: `docs/VIDEO.md`.
- Done: the README's `## Status` says why the submission runs in rehearsal mode.

What's left, for a person:

- [ ] If `demo/demo.mp4` isn't there yet, render and export it (`docs/VIDEO.md`, "Rebuild the video").
      Commit `video/` and `demo/demo.mp4` to `master` and push.
- [ ] Make the repo public: Settings → General → Danger Zone → Change repository visibility.
- [ ] In a private window, check that the README renders and `demo/demo.mp4` plays.
- [ ] Submit https://forms.gle/HRHYjnqB86j1LFS97 before **Thu 22 Oct, 6:00 pm Vietnam time**.

## Where things stand

This work was on branch **`claude/nice-turing-lmo2gp`**; it is merged into `master` (PR #3).

| Done | Where |
|---|---|
| One-command realm setup: `npm run realm` | `scripts/tide-realm.js`, `scripts/tide-realm.json`, `.env.example` |
| Landing stage redrawn as a control-room diagram (three.js removed) | `app/src/PlantStage.jsx`, `app/src/landing.css` |
| Sign-in returns to the screen you started on; Jo's change request survives a reload | `app/src/auth.js`, `app/src/governance.js` |
| README overview 291 words, realm setup under `## Setup` | `README.md` |
| Video script, ffmpeg command, submission checklist | `docs/VIDEO.md` |

**Verified in the cloud:** rehearsal mode end to end (only Kim plus Raj stops the pumps), 15/15
controller tests, both app builds. `npm run realm` ran in Docker up to (not including) licensing.
Against a real TideCloak 0.14.41, tide mode boots, shows Sign in, and sends `client_id=myclient`,
`redirect_uri=http://localhost:3000/auth/redirect` and PKCE. The admin API's CORS allows
`http://localhost:3000` and exposes `Location`, and a role grant becomes a `GRANT_ROLES` change request
on the user. The DPoP relay page is served.

**Not verified yet (needs you):** licensing, enrolment, the Tide sign-in itself, the controller
accepting real Tide-signed tokens, Jo's admin calls with a real token, approving and denying in QEA
Approvals, and tide-console's exact button labels.

## Decisions already made (don't redo them)

- Realm **`riverbend`**, client **`myclient`**, redirect `http://localhost:3000/*`, web origin
  `http://localhost:3000`, realm role **`plant-operator`**, users **jo**, **kim**, **raj**. Usernames
  may be 2 characters long (for `jo`).
- **DPoP is not required** by the realm (`dpop.bound.access.tokens=false`): the app sends plain Bearer
  tokens. Turning DPoP on would mean `secureFetch` everywhere plus proof checks in the controller, and
  that's untestable before the deadline. It stays a stated limit.
- The script creates the role, the users and the operator grants **before** anyone is an admin, so
  nothing needs approving by hand. Granting Jo `tide-realm-admin` comes last: after that, only admins
  can approve changes, in the browser.
- Licence email **enlarge@protonmail.com**; you agreed to Tide's terms. Both go in `.env` only.
- Not doing: network-signed commands (Forseti, PLAN Phase 4) or DPoP.
- Never commit `controller/tidecloak.json` or `.env` (both gitignored). Never run
  `npm init @tidecloak/nextjs` inside this repo: it would overwrite `app/`.

## What's left, in order

### 1. Get the branch (5 min)

```bash
git fetch origin && git checkout claude/nice-turing-lmo2gp && git pull
npm run setup
```

Needs Node ≥ 20.9 and Docker Desktop running, with ports 3000, 4000 and 8080 free.

### 2. Create the realm (15–30 min, mostly enrolment)

```bash
cp .env.example .env
```

In `.env`:

```
KC_BOOTSTRAP_ADMIN_PASSWORD=<a strong password you pick>
TIDE_LICENSE_EMAIL=enlarge@protonmail.com
TIDE_TERMS_ACCEPTED=yes
```

Then `npm run realm`. It prints three links. In Chrome, use the profile icon (top right) and **Add**
to create profiles **Jo**, **Kim** and **Raj**. Paste each link into that person's profile, create a
Tide account (pick a username and a strong password, write them down) and wait until it says it's
done. The script prints "All three are linked", makes Jo the first admin, and writes
`controller/tidecloak.json`.

- Docker Hub `429 Too Many Requests`: run
  `docker pull mirror.gcr.io/tideorg/tidecloak-dev:latest && docker tag mirror.gcr.io/tideorg/tidecloak-dev:latest tideorg/tidecloak-dev:latest`,
  then re-run.
- Ctrl-C is safe at any point. Re-running picks up where it stopped, and
  `npm run realm -- links` prints fresh links.
- `setUpTideRealm failed` or `NEED_PAYMENT`: run `docker logs two-person-rule-tidecloak | grep -i midgard`.
- To start completely over: `docker rm -f two-person-rule-tidecloak && docker volume rm two-person-rule-tidecloak-data`.

### 3. Make Kim and Raj admins (10 min)

In the **Jo** profile, open http://localhost:8080/realms/riverbend/tide-console/ and sign in as Jo.

1. People → **kim** → assign role **tide-realm-admin**.
2. QEA Approvals → review and approve it in the Tide window. If an admin-policy update is listed with
   it, approve that too.
3. Repeat for **raj**.

`npm run realm -- status` should then show 3 admins, 2 approvals needed and nothing pending.

### 4. Two quick decisions

- **Brand the login screen?** Right now people see Tide's logo. Optional. With Tide's MCP in a local
  Claude Code session (`claude mcp add tide-pack -- npx -y @tideorg/mcp`), ask it for `tide_branding`
  and run the command it gives. After step 3, a branding change is itself a change request needing 2
  of the 3 admins.
- **In-app onboarding form?** Probably not: the script already gives each user a first and last name.
  Skip it unless you want to collect something else.

### 5. Test tide mode (20 min)

`npm run demo` (it says "TideCloak mode"). Open http://localhost:3000 in all three profiles and sign
in. Then:

- [ ] **Start a pressure spike** (any window). Sentinel's request reaches the lock: 0 of 2.
- [ ] Attacker → **Trick the AI**, then **Forge a pass**: both refused.
- [ ] Jo → **Approve**: refused, "Not an operator".
- [ ] Jo → **Make me operator**: Jo's card shows "Admins 0 of 2". **Open in TideCloak** shows it in QEA
      Approvals. Reload Jo's page: the request is still shown.
- [ ] In Kim's and Raj's profiles, tide-console → QEA Approvals → **Deny**. Jo's card: "Admins said no".
- [ ] Kim → **Approve** (1 of 2), **Approve again** (still 1), Raj → **Approve**: the pumps stop.
- [ ] Control room (`#/control-room`): chart, audit trail, "Hash chain intact". Signing in from there
      brings you back there.

When it all passes, tick the last two boxes in the README's `## Status` and commit.

**If something misbehaves:**

| Symptom | Likely cause | Look at |
|---|---|---|
| Login page says `Invalid parameter: redirect_uri` | App opened as `127.0.0.1` | Use `http://localhost:3000` exactly |
| Token request fails with `DPoP proof is missing` | DPoP required on the client | tide-console → Apps → myclient: DPoP-bound tokens must be off |
| Kim's Approve: "Token is not a valid, current token from this realm" | Token's `iss`/`azp`/algorithm doesn't match `tidecloak.json` | Decode the token (jwt.io): `iss` must be `http://localhost:8080/realms/riverbend`, `azp` `myclient`, header `alg` `EdDSA`. If keys changed, run `npm run realm -- export` and restart the demo |
| Kim's Approve: "does not hold the plant-operator role" | Grant missing, or an old token | `npm run realm -- status`; sign out and in again |
| Jo: "TideCloak wouldn't look up the plant-operator role (403)" | Jo isn't an admin | Status should list jo as `tide-realm-admin` |
| Jo: "TideCloak applied the grant immediately" | Quorum governance is off | Realm setup didn't finish; re-run `npm run realm` |
| CORS error in the console | Usually an error response, which carries no CORS headers | Read the response body in the Network tab |

Tide's own check: with the pack fetched (step 1 of `tide_doctor`'s output), run
`bash .tide-pack/templates/shared/tide-doctor.sh --app app --url http://localhost:3000 --check`.
On this layout it always reports "no adapter JSON" (ours is `controller/tidecloak.json`) and "useDPoP
is not set" (deliberate). Both are expected.

### 6. The video (done in code)

Built under `video/` instead of screen-recorded. `docs/VIDEO.md` has how to rebuild it and export
`demo/demo.mp4`. Check it's 2:00 or less and under 100 MB, then commit `demo/demo.mp4`.

### 7. Ship (15 min, before 6:00 pm Vietnam time)

- [x] Open a PR from `claude/nice-turing-lmo2gp` to `master` and merge it.
- [ ] Run the secret check in `docs/VIDEO.md`.
- [ ] Make the repo public (Settings → General → Danger Zone).
- [ ] In a private window, check that the README renders and the video plays.
- [ ] Submit https://forms.gle/HRHYjnqB86j1LFS97.

## Handy commands

```bash
npm run realm -- status   # linked users, roles, admins, pending change requests
npm run realm -- links    # fresh enrolment links for anyone not linked
npm run realm -- export   # rewrite controller/tidecloak.json
npm run demo              # controller :4000, Sentinel, app :3000
npm test                  # controller tests (15)
docker logs -f two-person-rule-tidecloak
```

## Prompt for a local Claude Code session

Paste this if you'd like Claude on the laptop to drive the rest:

> Read `docs/HANDOFF.md` and continue from the first unfinished step. I'm on the laptop with Docker and
> Chrome. You can't click in the browser: tell me exactly what to click for enrolment and approvals,
> and I'll report back. Don't commit `controller/tidecloak.json` or `.env`, don't run
> `npm init @tidecloak/nextjs` inside the repo, and don't rewrite the UI unless something is broken in
> tide mode. Ask me before branding the login screen or adding an onboarding form. Keep the controller
> tests passing and commit as you go on `claude/nice-turing-lmo2gp`.
