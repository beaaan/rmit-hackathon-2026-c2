# Plant controller

Mock plant-side gateway. It runs a command only after **two distinct operators** approve it, each
proven by a TideCloak access token holding the `plant-operator` role. It holds no secret: its only
TideCloak material is the realm's public key in `tidecloak.json`.

```bash
npm install
cp /path/to/tidecloak.json .     # Apps → myclient → Credentials in tide-console
npm start                        # http://localhost:4000
npm test
```

## API

| Method & path | Who calls it | Auth | What it does |
|---|---|---|---|
| `GET /plant/state` | dashboard, Sentinel | none | Lines, pumps, pressure history, alarm/trip thresholds |
| `POST /plant/scenario` | demo staging | none | `{kind: "pressure-spike", line}` or `{kind: "reset"}`. Off with `DEMO_CONTROLS=0` |
| `POST /commands` | Sentinel, app server | none (untrusted) | Propose `{action, line, reason, evidence}`. Returns the pending command |
| `GET /commands`, `GET /commands/:id` | operator browsers | none | What operators review before approving, served by the controller itself |
| `POST /commands/:id/approve` | operator browser | `Authorization: Bearer <token>` | Verifies the token and records the operator once. Executes at 2 distinct operators |
| `POST /commands/:id/reject` | operator browser | `Authorization: Bearer <token>` | One operator can stop a command |
| `POST /commands/:id/execute` | nobody legitimate | none | Always refuses (`403`) and logs it. This is the path a prompt-injected agent tries |
| `GET /audit` | audit view | none | Hash-chained, append-only log, plus `chain.ok` |

Actions: `shutdown_pumps`, `restart_pumps`, `close_inlet_valve`. Lines: `L1`, `L2`, `L3`.
Unauthenticated callers can label themselves with an `X-Actor` header; the audit log records it as
`unverified`.

## Configuration

| Variable | Default | |
|---|---|---|
| `TIDECLOAK_CONFIG` | `tidecloak.json` | Adapter JSON with the realm's `jwk` |
| `PORT` | `4000` | |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Browser origins allowed by CORS, comma-separated |
| `AUDIT_LOG` | `data/audit.jsonl` | Delete it to start a fresh trail |
| `DEMO_CONTROLS` | on | `0` hides `/plant/scenario` |

## Rehearsing without TideCloak

`npm run dev:keys` writes `dev/tidecloak.dev.json` (a locally generated Ed25519 key, standing in
for the realm) and `dev/tokens.json` (tokens for jo, kim and raj). Then:

```bash
TIDECLOAK_CONFIG=dev/tidecloak.dev.json npm start
curl -XPOST localhost:4000/commands/<id>/approve -H "Authorization: Bearer $(jq -r .kim dev/tokens.json)"
```

This exists for tests and offline rehearsal only. With a real realm, no private key exists anywhere
you could mint a token with.

## Limits (say these out loud)

- The "two distinct operators" count is enforced here, by the controller. TideCloak guarantees that
  operator tokens can't be forged and that nobody becomes an operator without an admin quorum.
- An approval token is not bound to a specific command yet; any valid operator token approves
  whichever command it's sent to. DPoP binding and network-signed commands are the next steps.
- Plant and command state live in memory and reset on restart; the audit file persists.
