[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

_Two-Person Rule: an AI watches a water plant around the clock and proposes urgent actions, but nothing runs until two human operators approve._

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

An operations AI for critical infrastructure that can **propose** but never **execute**. Every command needs two different operators, and no AI, admin or server holds a key that skips them.

### 2. Trust constraint insight

Plants keep AI away from their controls: its credentials, or one admin account, could trigger a dangerous action, and prompt injection can't be fully prevented. Remove that single point of control and the AI's speed becomes safe to use.

### 3. Value & impact

Operators and the towns they supply. At 3 a.m., a pressure spike gets a ready shutdown with its evidence in seconds, confirmed by two operators within a minute, instead of whenever someone notices.

### 4. Why TideCloak matters

Operators' tokens are signed by Tide's threshold network, and the plant controller holds only the realm's public key, so no server, ours included, can mint an operator. Becoming one is governed too: with three admins, TideCloak holds every role grant until two approve, so no admin can promote themselves. The AI has no Tide identity at all. Honest limit: our controller counts the approvals; TideCloak guarantees who can be counted.

### 5. Prototype & storytelling

A prompt-injected AI tries to run the shutdown: refused. A forged operator pass fails the realm's signature. Jo, the IT admin, tries to become an operator; TideCloak files it as a change request that Kim and Raj deny in QEA Approvals. Kim approving twice counts once. Only Kim plus Raj stops the pumps, and every step lands in a hash-chained audit trail.

Demo video: [`demo/demo.mp4`](demo/demo.mp4).

## Setup

Needs Node ≥ 20.9, and Docker for the TideCloak realm.

```bash
npm run setup     # installs controller/ and app/
npm run demo      # controller :4000, Sentinel, web app :3000
```

Without a realm, the demo runs in **rehearsal mode**: a stand-in realm generated on your machine and a
Jo / Kim / Raj switch. With `controller/tidecloak.json` present it runs in **TideCloak mode**.

### TideCloak realm

1. `cp .env.example .env`, then set a master-admin password, the email that manages your Tide licence,
   and `TIDE_TERMS_ACCEPTED=yes` only if you agree to Tide's [Terms & Conditions](https://tide.org/legal).
   `.env` is gitignored.
2. `npm run realm` starts `tideorg/tidecloak-dev` on :8080 and creates realm `riverbend`: client
   `myclient` (redirect `http://localhost:3000/*`), role `plant-operator`, users jo, kim and raj, with
   kim and raj as operators. It licenses the realm, switches on quorum governance and prints an
   enrolment link per person.
3. Open each link in that person's own Chrome profile and create their Tide account. The script waits,
   makes Jo the first admin, and writes `controller/tidecloak.json` (gitignored, never commit it).
4. As Jo, in tide-console (`http://localhost:8080/realms/riverbend/tide-console/`): People → kim →
   assign `tide-realm-admin`, then approve it in QEA Approvals (plus the admin-policy update it brings
   along, if listed). Repeat for raj. With three admins, every governed change needs two approvals.
5. `npm run demo`, and sign in as Jo, Kim and Raj, each in their own profile.

`npm run realm -- status` shows who is linked, who holds which role and what's pending. The script is
safe to re-run; it picks up where it stopped.

### Using it

Open http://localhost:3000. Under the headline is the working prototype: a live diagram of Line 3
(pressure gauge, two-key lock, pump) with a signal line from each of the five who can act, ending
over their controls. Start a pressure spike so Sentinel proposes a shutdown, then try to get it run
without two operators: trick Sentinel through its maintenance log, forge an operator's pass, have Jo
approve or ask to become an operator, approve twice as Kim. Every attempt travels up its line and is
refused at the lock; Kim's and Raj's approvals are the only keys that open it. The operators' control
room is at `#/control-room`. In TideCloak mode each person's controls are live only for whoever is
signed in as them.

`npm run build:preview --prefix app` builds a static preview (`app/dist-preview/`) in which the
controller, Sentinel and a stand-in sign-in service run inside the page.

`npm test` runs the controller tests. API and limits: [`controller/README.md`](controller/README.md).

## Status

- [x] Plant controller: runs a command only after two different operators approve, each verified from
      their sign-in token; refuses direct execution; hash-chained audit log; 15 tests.
- [x] Sentinel, the scripted AI: proposes a shutdown with its evidence and has no credentials. It obeys
      instructions planted in its maintenance log, and the controller still refuses it.
- [x] Landing page with the live plant diagram, and the operators' control room.
- [x] Every bypass is refused on screen: the prompt-injected AI, a forged operator pass, the admin
      approving, one operator approving twice.
- [x] One-command realm setup (`npm run realm`).
- [ ] Tested end to end against the enrolled realm, including Jo's request as a real change request.
- [ ] The 2-minute video.

The demo video and the submission run in rehearsal mode. On submission day Tide's network couldn't
license new realms (`setUpTideRealm` returned `TIDE-IDPEXT-VENDOR-KEYGEN_FAILED`), and the organisers'
[Plan C](https://tide.org/unlocked/#plan-c) guidance says simulated protections are judged the same as
a live integration. `npm run realm` and TideCloak mode are ready for a live realm.

Photographs and the clip on the page are from Wikimedia Commons, credited in the page footer and in
`app/public/photos/credits.json`. The control-room screen follows
[taste-skill](https://github.com/leonxlnx/taste-skill)'s app-screen rules ("data-terminal" style); its
chart helper is vendored in `app/src/vendor/charts.js` (MIT). The realm setup is adapted from Tide's
agent pack (`@tideorg/mcp`).

## Project documents

| Document | What's in it |
|---|---|
| [`docs/RESEARCH.md`](docs/RESEARCH.md) | Real incidents: AI that deceives, escapes and gets prompt-injected, with sources |
| [`docs/PLAN.md`](docs/PLAN.md) | Work plan: architecture, demo storyline, phased timeline, video script, risks |
| [`docs/TIDECLOAK-NOTES.md`](docs/TIDECLOAK-NOTES.md) | What the Tide docs say about quorum, tokens, Forseti and AI agents, with sources |
| [`docs/IDEAS.md`](docs/IDEAS.md) | The 20 ideas we considered, the ranking, and why we chose this one |
| [`docs/CHALLENGE.md`](docs/CHALLENGE.md) | The hackathon brief, deliverables and judging criteria |
| [`docs/VIDEO.md`](docs/VIDEO.md) | How the demo video is built in code and rebuilt, and the submission checklist |

All data in this project is synthetic.
