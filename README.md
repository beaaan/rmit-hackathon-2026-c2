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

Work in progress. What runs today:

```bash
# Plant controller (needs tidecloak.json from your realm, or `npm run dev:keys` to rehearse offline)
cd controller && npm install && npm start      # http://localhost:4000

# Sentinel, the operations AI (no credentials): start a Line 3 spike, propose, try the injected execute
cd sentinel && npm run demo:inject
```

Details and the API: [`controller/README.md`](controller/README.md). The TideCloak realm setup
(Docker, three admins, `plant-operator` role) is in [`docs/PLAN.md` → Phase 1](docs/PLAN.md#phase-1-tidecloak-up-and-governed-1530-1700).
The Next.js app comes next.

## Project documents

| Document | What's in it |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Work plan: architecture, demo storyline, phased timeline, video script, risks |
| [`docs/TIDECLOAK-NOTES.md`](docs/TIDECLOAK-NOTES.md) | What the Tide docs say about quorum, tokens, Forseti and AI agents, with sources |
| [`docs/IDEAS.md`](docs/IDEAS.md) | The 20 ideas we considered, the ranking, and why we chose this one |
| [`docs/CHALLENGE.md`](docs/CHALLENGE.md) | The hackathon brief, deliverables and judging criteria |

All data in this project is synthetic.
