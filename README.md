[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

_Two-Person Rule: an AI watches a water plant around the clock and proposes urgent actions, but nothing runs until two human operators approve, and no AI, admin or server can skip that rule._

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

> **Draft.** This overview is a working draft and will be finalised once the prototype is built. See [`docs/PLAN.md`](docs/PLAN.md).

### 1. Vision & originality

<!-- What new product, service, experience or way of working are you proposing? What makes your idea distinctive? -->

An AI operations assistant for critical infrastructure that can **propose** but never **execute**. Commands need two operators, enforced so that nobody holds a key that lets them skip the check.

### 2. Trust constraint insight

<!-- What is difficult, risky or impossible today because trust, privacy or security gets in the way? Explain what becomes possible when that constraint is removed. -->

Plants keep AI away from their controls because its credentials, or one admin, could trigger a dangerous action, and prompt injection can't be fully prevented. Remove that single point of control and the AI can safely help.

### 3. Value & impact

<!-- Who would benefit, and how would their lives or work improve? Give a concrete example of why this matters. -->

Operators and the communities they serve. A pressure spike gets a ready-to-approve shutdown in seconds, confirmed by two people within a minute, instead of waiting for someone to notice on a night shift.

### 4. Why TideCloak matters

<!-- How does your application use TideCloak, and how does that integration help enable your idea? Connect the technology to the possibility you are demonstrating. -->

Operator identity can't be forged: there's no password store and no signing key on any server. Becoming an operator needs a 2-of-3 admin quorum, so one admin can't promote themselves. The AI has no Tide identity at all. With ordinary login, an admin could grant themselves the role, and the server's keys would be a master key.

### 5. Prototype & storytelling

<!-- What does your prototype demonstrate today? Describe the key interaction judges should look for. -->

Watch a prompt-injected AI get refused, an admin's self-promotion stall in TideCloak's QEA Approvals, and the shutdown run only after two different operators approve.

## Setup

Needs Node ≥ 20.9.

```bash
npm run setup     # installs controller/ and app/
npm run demo      # controller :4000, Sentinel, web app :3000
```

Open http://localhost:3000. The page tells the story in five moments, each with one button: the
pressure climbs and Sentinel proposes a shutdown; a fake note tricks Sentinel into running it alone
(blocked); the IT admin tries to approve (blocked); one operator approves, twice (still 1 of 2); a
second operator approves and the pumps stop. **Start over** resets it. The operators' dashboard is
the second tab (`#/control-room`).

- **TideCloak mode (the real demo):** put your realm's `tidecloak.json` in `controller/`
  (tide-console → Apps → myclient → Credentials). Operators then sign in with TideCloak, each in their
  own browser profile. Realm setup (Docker, three admins, `plant-operator` role) is in
  [`docs/PLAN.md` → Phase 1](docs/PLAN.md#phase-1-tidecloak-up-and-governed-1530-1700).
- **Rehearsal mode:** without `tidecloak.json`, the demo generates a stand-in realm on your machine
  and shows a Jo / Kim / Raj switch (each browser tab can be a different person). Practice only.

`npm test` runs the controller tests. API and limits: [`controller/README.md`](controller/README.md).

The control-room screen follows [taste-skill](https://github.com/leonxlnx/taste-skill)'s app-screen rules
("data-terminal" style); its chart helper is vendored in `app/src/vendor/charts.js` (MIT).

## Project documents

| Document | What's in it |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Work plan: architecture, demo storyline, phased timeline, video script, risks |
| [`docs/TIDECLOAK-NOTES.md`](docs/TIDECLOAK-NOTES.md) | What the Tide docs say about quorum, tokens, Forseti and AI agents, with sources |
| [`docs/IDEAS.md`](docs/IDEAS.md) | The 20 ideas we considered, the ranking, and why we chose this one |
| [`docs/CHALLENGE.md`](docs/CHALLENGE.md) | The hackathon brief, deliverables and judging criteria |

All data in this project is synthetic.
