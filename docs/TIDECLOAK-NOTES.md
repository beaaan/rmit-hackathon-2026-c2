# TideCloak research notes

What we learned from the Tide docs and Tide's MCP pack (Raziel, `@tideorg/mcp` 1.9.33) on
22 Oct 2026, and how it affects the Two-Person Rule build. Quotes are trimmed; follow the links for
full context.

## 1. Setup facts

- Dev server: `tideorg/tidecloak-dev:latest` Docker image on port 8080. It talks to the **live Tide
  network** (home ORK `ork1.tideprotocol.com`, threshold 14 of 20), so it needs internet.
  ([Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart))
- App template: `npm init @tidecloak/nextjs@latest my-app` creates realm `nextjs-test`, client
  `myclient`, licence, first admin and QEA. It **pauses for Tide enrolment** at a link it prints; a
  person must complete it in a browser. Needs Node ≥ 20.9, `curl`, `jq`.
- Free developer licence: up to 100 users.
- tide-console: `http://localhost:8080/realms/{realm}/tide-console/`. Nav: Home, Apps, People,
  QEA Approvals; Advanced toggle shows Roles, Policies, etc.

## 2. Quorum-enforced governance (QEA)

Source: [Quorum Enforced Governance](https://docs.tide.org/Core-Concepts/iga-workflow),
[Setting up QEA](https://docs.tide.org/Admin/SetupIGA)

- Governed writes (role grants, role creation, client changes) become **PENDING change requests**
  (`202 Accepted`) shown in **QEA Approvals**. Each admin authorizes in the Tide enclave.
- Approvals needed = `max(1, floor(0.7 × N))` where N = number of `tide-realm-admin` holders:
  1→1, 2→1, **3→2**, 4→2, 5→3. So we need **3 admins** for a real 2-approval quorum.
- Granting `tide-realm-admin` is itself governed. Do cheap setup (roles, operator grants) while
  there's one admin, then add admins.
- Committing under quorum returns `412 QUORUM_NOT_MET`. An admin's approval counts once per request.
- Denied requests are logged with reasons; everything is in the audit log.

## 3. Tokens and verification

Source: [Next.js reference](https://docs.tide.org/Languages/NextJS/tidecloak-nextjs-reference),
[Verify JWT](https://docs.tide.org/Languages/NextJS/VerifyJWT)

- `@tidecloak/nextjs`: `TideCloakProvider`, `useTideCloak()` (`token`, `hasRealmRole`,
  `doEncrypt`/`doDecrypt`), guard components, `createTideCloakMiddleware` / `createTideCloakProxy`
  (Next 16) with `protectedRoutes` → roles.
- `@tidecloak/verify`: `verifyTideCloakToken(config, token, allowedRoles?)` checks signature, issuer,
  `azp` and roles. Works in plain Node/Express. Tokens from a QEA realm are **EdDSA**-signed; it can
  verify offline using `config.jwk.keys` from `tidecloak.json`. **This is what the controller uses.**
- DPoP (sender-constrained tokens) is supported; the pack's `templates/dpop-verify/verifyDpop.ts`
  verifies proofs server-side. Without server-side verification, a stolen token replays fine.

## 4. Forseti (programmable policy)

Source: [Forseti engine](https://docs.tide.org/Core-Concepts/forseti-engine), MCP pack
`canon/custom-contracts.md`

- Contracts are C# (`IAccessPolicy`: `ValidateData`, `ValidateApprovers`, `ValidateExecutor`) run on
  every ORK. If the contract fails, the network **cannot** produce the signature. Helpers include
  `RequireMinWithRole`, `ForbidSelfApproval`.
- **Custom contract upload is done by the Tide team** ("experimental, test networks only"). We can't
  deploy our own in the time available.
- **Built-in contracts** need no upload:

  | Contract | Checks |
  |---|---|
  | `GenericRealmAccessThresholdRole:1` | At least `threshold` approvers hold realm role `role`. Approvers only; no executor check. |
  | `GenericResourceAccessThresholdRole:1` | Same, for client roles. |
  | `SimpleTagBasedDecryption:1` | Executor holds tag roles. |
  | `RelationshipAttestation:1` | Per-record encrypt/decrypt access. |

- Multi-approver flows need `ApprovalType.EXPLICIT` (the only way `ValidateApprovers` runs) and a
  custom request built with `BasicCustomRequest` (`asgard-tide`) using `Custom<...>`-wrapped
  name/version, giving model id `BasicCustom<Custom<X>>:BasicCustom<Custom<1>>`. Tide's notes mark
  this exact shape as **"predicted, not yet network-verified"**. Hence Phase 4 is a stretch.
- Signing flow: `tc = IAMService._tc` → `createTideRequest` → `requestTideOperatorApproval` →
  `executeSignRequest(..., true)` → 64-byte Ed25519 signature. Policies must be signed by the realm
  admin policy (named `tide-realm-admin`, fetched from `/admin/realms/{realm}/iga/role-policies`).
- Import `Models` from `@tideorg/js` (not `@tidecloak/nextjs`, which returns `undefined`).

## 5. AI agents and Tide (important for our story)

Source: MCP pack `canon/agent-authority.md`

- "An autonomous process cannot authenticate to Tide, and cannot produce a signature by itself."
  No headless login, no service accounts (GAP-064); ORK signing is browser JS only (GAP-063).
- Recommended pattern: the agent's **decision is an input**; **authority** comes from a doken in a
  human-owned browser session holding the right role.
- What this buys: an attacker who owns the orchestrator **cannot mint an approval** for a role it
  doesn't hold. The ORKs check independently of our backend.
- What it does **not** buy, and we should say so: no workload attestation. Compromising an
  operator's session is equivalent to compromising that operator.
- Anti-pattern to avoid: backend auto-approving on an agent's behalf (AP-37).

## 6. Honesty notes for README and video

- In the core tier, the "two distinct operators" count is enforced by our controller. TideCloak's
  part: operators can't be forged (no password store, no signing key on any server, EdDSA tokens
  from the threshold network), and operator status can't be granted without quorum.
- Bybit lesson from the pack: a quorum is only as good as what approvers independently see. Our
  operators view the command details **from the controller**, not from the app server that relayed
  Sentinel's proposal.

## 7. Discord question to post now (#support)

> Hi Tide team! We're building an UNLOCKED entry where an AI proposes plant commands and two
> operators must approve before execution. Can we use the built-in `GenericRealmAccessThresholdRole:1`
> contract with `ApprovalType.EXPLICIT`, `ExecutionType.PUBLIC` and a custom model
> `BasicCustom<Custom<PlantCommand>>:BasicCustom<Custom<1>>` (params `role=plant-operator`,
> `threshold=2`) on the dev image's network, without a custom contract upload? And what's the right
> way to collect approvals from two different users' browser sessions on one request before
> `executeSignRequest`? Thanks!

## 8. Sources

- https://tide.org/unlocked (challenge page and its `config.js`: judging criteria, README template, FAQ)
- https://docs.tide.org/ (Quickstart, Admin/SetupIGA, Core-Concepts/iga-workflow,
  Core-Concepts/forseti-engine, Admin/e2ee, Languages/NextJS/*, ai-agent-pack)
- `@tideorg/mcp` 1.9.33 on npm (canon/custom-contracts.md, canon/agent-authority.md,
  reference-apps/INDEX.md, GAP_REGISTER.md, templates/dpop-verify)
