// Sets up the Riverbend realm on a local TideCloak (Docker) and writes controller/tidecloak.json.
//
//   npm run realm            # start TideCloak, create the realm, enrol jo/kim/raj, export tidecloak.json
//   npm run realm -- status  # who is linked, who holds which role, pending change requests
//   npm run realm -- links   # print fresh enrolment links for anyone not linked yet
//   npm run realm -- export  # write controller/tidecloak.json again
//
// Reads .env at the repo root (gitignored): KC_BOOTSTRAP_ADMIN_PASSWORD, TIDE_LICENSE_EMAIL and
// TIDE_TERMS_ACCEPTED=yes. The person who owns the deployment fills in the last two.
//
// Order matters. Every governed write (role, users, operator grants, client settings) happens while
// the realm is in FirstAdmin mode, where this script can approve it. Granting Jo `tide-realm-admin`
// comes last: it flips the realm to MultiAdmin, after which only an admin in the browser enclave can
// approve a change. Making Kim and Raj admins is then done by hand in tide-console (see README).
// Adapted from Tide's bootstrap (MCP pack templates/shared/bootstrap-tidecloak.sh).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
loadEnv(at(".env"));

const TC = (process.env.TIDECLOAK_URL ?? "http://localhost:8080").replace(/\/$/, "");
const REALM = "riverbend";
const CLIENT = "myclient";
const CONTAINER = process.env.TIDECLOAK_CONTAINER ?? "two-person-rule-tidecloak";
const VOLUME = `${CONTAINER}-data`;
const IMAGE = process.env.TIDECLOAK_IMAGE ?? "tideorg/tidecloak-dev:latest";
const ADAPTER = at("controller/tidecloak.json");
const CAST = [
  { username: "jo", firstName: "Jo", lastName: "(IT admin)", operator: false },
  { username: "kim", firstName: "Kim", lastName: "(operator)", operator: true },
  { username: "raj", firstName: "Raj", lastName: "(operator)", operator: true },
];
const ADMIN_USER = process.env.KC_BOOTSTRAP_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.KC_BOOTSTRAP_ADMIN_PASSWORD ?? "";
// Only for testing this script without a licence: Tideless governance, no Tide sign-in.
const UNLICENSED = process.env.TIDE_UNLICENSED_TEST === "1";
const SKIP_DESTRUCTIVE = ["DISABLE_IGA", "DELETE_REALM", "OFFBOARD_REALM"];

const command = process.argv[2] ?? "setup";
const commands = { setup, status, links, export: exportAdapter };
if (!commands[command]) fail(`Unknown command "${command}". Use: setup | status | links | export`);
if (!ADMIN_PASSWORD) {
  fail(
    "KC_BOOTSTRAP_ADMIN_PASSWORD is not set.\n\n" +
      "  Create .env at the repo root (it is gitignored):\n" +
      "    cp .env.example .env    # then set a strong KC_BOOTSTRAP_ADMIN_PASSWORD",
  );
}
// Runs at the end of the file, once every helper below is defined.

// --- setup -----------------------------------------------------------------------------------------

async function setup() {
  const email = licenceAnswers();
  await startTideCloak();

  if ((await admin("GET", "")).status === 404) {
    step(`Creating realm "${REALM}" with client "${CLIENT}" and role plant-operator`);
    const realm = readFileSync(at("scripts/tide-realm.json"), "utf8");
    expectOk(await admin("POST", null, JSON.parse(realm), `${TC}/admin/realms`), "create realm");
    await skipReviewProfilePage();
  } else {
    step(`Realm "${REALM}" exists; picking up where it left off`);
  }

  const realm = (await admin("GET", "")).data;
  if (realm.attributes?.isIGAEnabled !== "true") {
    if (!UNLICENSED) await license(email);
    step("Switching on quorum governance (IGA)");
    if (!UNLICENSED) {
      realm.attributes = { ...(realm.attributes ?? {}), "iga.attestor": "tide" };
      expectOk(await admin("PUT", "", realm), "stamp iga.attestor=tide");
    }
    // toggle-iga flips the state, so it is called once, only while IGA is off.
    const res = await admin("POST", "/tide-admin/toggle-iga", form({ isIGAEnabled: "true" }));
    if (!JSON.stringify(res.data ?? "").includes('"enabled":true')) fail(`toggle-iga did not report enabled: ${res.status} ${JSON.stringify(res.data)}`);
    await drain();
  }

  const flipped = (await adminsOf()).length > 0;
  if (!flipped) {
    for (const person of CAST) {
      if (!(await user(person.username))) {
        step(`Adding ${person.username}`);
        const res = await admin("POST", "/users", {
          username: person.username,
          firstName: person.firstName,
          lastName: person.lastName,
          enabled: true,
          attributes: { tideInvitable: ["true"] },
        });
        if (![201, 202].includes(res.status)) fail(`create ${person.username}: ${res.status} ${JSON.stringify(res.data)}`);
      }
    }
    await drain();

    const role = (await admin("GET", "/roles/plant-operator")).data;
    for (const person of CAST.filter((p) => p.operator)) {
      const u = await user(person.username);
      if (!u) fail(`${person.username} was not created. Run \`npm run realm -- status\`.`);
      if (!(await realmRoles(u.id)).includes("plant-operator")) {
        step(`Granting plant-operator to ${person.username}`);
        const res = await admin("POST", `/users/${u.id}/role-mappings/realm`, [{ id: role.id, name: role.name }]);
        if (![202, 204].includes(res.status)) fail(`grant plant-operator to ${person.username}: ${res.status} ${JSON.stringify(res.data)}`);
      }
    }
    await drain();
    for (const person of CAST.filter((p) => p.operator)) {
      if (!(await realmRoles((await user(person.username)).id)).includes("plant-operator")) {
        fail(`plant-operator didn't stick for ${person.username}. Pending: ${JSON.stringify(await pending())}`);
      }
    }
  }

  if (UNLICENSED) {
    step("Unlicensed test run: stopping before enrolment (needs Tide).");
    return;
  }

  await waitForEnrolment();

  if (!flipped) {
    step("Signing the Tide sign-in settings for this realm");
    const idp = (await admin("GET", "/identity-provider/instances/tide")).data;
    idp.config = { ...idp.config, CustomAdminUIDomain: `${TC}/realms/${REALM}/tide-console/` };
    expectOk(await admin("PUT", "/identity-provider/instances/tide", idp), "set CustomAdminUIDomain");
    expectOk(await admin("POST", "/vendorResources/sign-idp-settings"), "sign-idp-settings");
    await drain();

    step("Making Jo the realm's first admin (tide-realm-admin). From here on, changes need an admin's approval.");
    const rm = await realmManagement();
    const adminRole = (await admin("GET", `/clients/${rm}/roles/tide-realm-admin`)).data;
    if (!adminRole?.id) fail(`tide-realm-admin role not found: ${JSON.stringify(adminRole)}`);
    const jo = await user("jo");
    const res = await admin("POST", `/users/${jo.id}/role-mappings/clients/${rm}`, [adminRole]);
    if (![202, 204].includes(res.status)) fail(`grant tide-realm-admin to jo: ${res.status} ${JSON.stringify(res.data)}`);
    await drain();
    if (!(await adminsOf()).includes("jo")) fail(`Jo isn't an admin yet. Pending: ${JSON.stringify(await pending())}`);
  }

  await exportAdapter();
  await status();
  console.log(`
Done. Next, in tide-console as Jo (${TC}/realms/${REALM}/tide-console/):
  1. People → kim → assign role tide-realm-admin → QEA Approvals → review and approve (Jo's enclave).
  2. The same for raj. Then there are 3 admins and every change needs 2 of them.
Then: npm run demo   (now in TideCloak mode; open http://localhost:3000 in each person's Chrome profile)
`);
}

function licenceAnswers() {
  const email = process.env.TIDE_LICENSE_EMAIL ?? "";
  const placeholder = /@(example\.(com|org|net)|test\.com|domain\.com|email\.com|localhost)$|\.(example|test|invalid|local)$/i;
  if (UNLICENSED) return null;
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email) || placeholder.test(email) || process.env.TIDE_TERMS_ACCEPTED !== "yes") {
    console.error(`
STOP: nothing was created.

Setting up the realm licenses it to an email address under Tide's Terms & Conditions
(https://tide.org/legal). Both answers belong to the person who owns this deployment. Put them in .env:

  TIDE_LICENSE_EMAIL=<an address you control>
  TIDE_TERMS_ACCEPTED=yes     # only if you have read and agree to https://tide.org/legal

Got: TIDE_LICENSE_EMAIL='${email}'  TIDE_TERMS_ACCEPTED='${process.env.TIDE_TERMS_ACCEPTED ?? ""}'`);
    process.exit(2);
  }
  console.log(`Licence email: ${email}\nTide Terms & Conditions (https://tide.org/legal): accepted by the operator`);
  return email;
}

async function startTideCloak() {
  if (spawnSync("docker", ["version"], { stdio: "ignore" }).status !== 0) fail("Docker isn't running. Start Docker Desktop and try again.");
  const state = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER], { encoding: "utf8" });
  if (state.status !== 0) {
    if (await reachable()) fail(`Something else is answering on ${TC}. Stop it (or set TIDECLOAK_URL) and try again.`);
    step(`Starting TideCloak (${IMAGE}) as container "${CONTAINER}"`);
    const run = spawnSync(
      "docker",
      // The volume sits on /opt/keycloak/data (owned by the keycloak user in the image) so the H2
      // database under data/h2 is writable and survives restarts.
      ["run", "-d", "--name", CONTAINER, "-p", "8080:8080", "-v", `${VOLUME}:/opt/keycloak/data`,
        "-e", `KC_BOOTSTRAP_ADMIN_USERNAME=${ADMIN_USER}`, "-e", "KC_BOOTSTRAP_ADMIN_PASSWORD", IMAGE],
      { stdio: "inherit", env: { ...process.env, KC_BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PASSWORD } },
    );
    if (run.status !== 0) fail("docker run failed.");
  } else if (state.stdout.trim() !== "true") {
    step(`Starting the existing container "${CONTAINER}"`);
    spawnSync("docker", ["start", CONTAINER], { stdio: "inherit" });
  }
  process.stdout.write("Waiting for TideCloak");
  for (let i = 0; i < 90 && !(await reachable()); i++) {
    const running = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER], { encoding: "utf8" }).stdout.trim();
    if (running === "false") fail(`The TideCloak container stopped. See \`docker logs ${CONTAINER}\`.`);
    process.stdout.write(".");
    await sleep(2000);
  }
  console.log("");
  if (!(await reachable())) fail(`TideCloak didn't come up. Check \`docker logs ${CONTAINER}\`.`);
  await token(); // fails loudly on a wrong password
}

/** Keycloak's "Update Account Information" page would show every new Tide user a 64-hex username. */
async function skipReviewProfilePage() {
  const execs = (await admin("GET", "/authentication/flows/first%20broker%20login/executions")).data ?? [];
  const review = execs.find((e) => e.providerId === "idp-review-profile");
  if (!review) return;
  const body = { alias: "review profile config", config: { "update.profile.on.first.login": "off" } };
  if (review.authenticationConfig) await admin("PUT", `/authentication/config/${review.authenticationConfig}`, body);
  else await admin("POST", `/authentication/executions/${review.id}/config`, body);
}

async function license(email) {
  step("Licensing the realm with Tide (takes 10–20 s)");
  const res = await admin("POST", "/vendorResources/setUpTideRealm", form({ email, isRagnarokEnabled: "true" }));
  const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data ?? "");
  if (res.status === 303) fail(`setUpTideRealm answered 303 (paid checkout): no free licence was issued. ${body}`);
  if (res.status >= 300) fail(`setUpTideRealm failed (${res.status}): ${body.slice(0, 400)}\nThe cause is in \`docker logs ${CONTAINER}\` (look for [Midgard]).`);
  if (body.includes("NEED_PAYMENT")) fail(`setUpTideRealm answered NEED_PAYMENT: the realm is not licensed. Check the licence email (${email}).`);
}

async function waitForEnrolment() {
  let shown = false;
  for (;;) {
    const waiting = [];
    for (const person of CAST) {
      const u = await user(person.username);
      if (!u.attributes?.tideUserKey?.[0]) waiting.push({ ...person, id: u.id });
    }
    if (!waiting.length) break;
    if (!shown) {
      await printLinks(waiting);
      shown = true;
      process.stdout.write(`Waiting for ${waiting.map((p) => p.username).join(", ")} to link (Ctrl-C is safe; re-run to resume)`);
    }
    await drain(); // linking files a change request per user
    process.stdout.write(".");
    await sleep(5000);
  }
  if (shown) console.log("\nAll three are linked.");
  await drain();
}

async function printLinks(people) {
  console.log(`
Enrol each person in their OWN Chrome profile (Chrome → profile icon → Add). Open the link,
create a Tide account (any username and a strong password; remember them) and wait until it
says you're done. The links work for 12 hours.
`);
  for (const p of people) {
    const res = await admin(
      "POST",
      `/tideAdminResources/get-required-action-link?userId=${p.id}&lifespan=43200`,
      ["link-tide-account-action"],
    );
    console.log(`  ${p.username.padEnd(4)} → ${typeof res.data === "string" ? res.data : JSON.stringify(res.data)}\n`);
  }
}

// --- status / links / export ----------------------------------------------------------------------

async function status() {
  const admins = await adminsOf();
  console.log(`\nRealm ${REALM} at ${TC}`);
  for (const person of CAST) {
    const u = await user(person.username);
    if (!u) {
      console.log(`  ${person.username.padEnd(4)} not created`);
      continue;
    }
    const roles = await realmRoles(u.id);
    const tags = [
      u.attributes?.tideUserKey?.[0] ? "linked" : "NOT linked",
      roles.includes("plant-operator") ? "plant-operator" : null,
      admins.includes(person.username) ? "tide-realm-admin" : null,
    ].filter(Boolean);
    console.log(`  ${person.username.padEnd(4)} ${tags.join(", ")}`);
  }
  const open = await pending();
  console.log(`  admins: ${admins.length} → governed changes need ${Math.max(1, Math.floor(0.7 * admins.length))} approval(s)`);
  console.log(`  pending change requests: ${open.length ? open.map((c) => `${c.actionType} ${c.authorizationCount ?? 0}/${c.threshold ?? "?"}`).join("; ") : "none"}`);
}

async function links() {
  const waiting = [];
  for (const person of CAST) {
    const u = await user(person.username);
    if (u && !u.attributes?.tideUserKey?.[0]) waiting.push({ ...person, id: u.id });
  }
  if (!waiting.length) return console.log("Everyone is linked.");
  await printLinks(waiting);
}

async function exportAdapter() {
  const clients = (await admin("GET", `/clients?clientId=${CLIENT}`)).data ?? [];
  if (!clients[0]) fail(`Client ${CLIENT} not found.`);
  const res = await admin("GET", `/vendorResources/get-installations-provider?clientId=${clients[0].id}&providerId=keycloak-oidc-keycloak-json`);
  const adapter = res.data;
  if (res.status !== 200 || !adapter?.jwk?.keys?.length || !adapter.vendorId || !adapter.homeOrkUrl) {
    fail(`The adapter export is missing jwk/vendorId/homeOrkUrl, so licensing didn't complete. (${res.status}) ${JSON.stringify(adapter).slice(0, 300)}`);
  }
  writeFileSync(ADAPTER, JSON.stringify(adapter, null, 2) + "\n");
  step(`Wrote controller/tidecloak.json (gitignored). Restart \`npm run demo\` to pick it up.`);
}

// --- TideCloak admin API --------------------------------------------------------------------------

let cached = null;
async function token() {
  if (cached && cached.until > Date.now()) return cached.value;
  const res = await fetch(`${TC}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "password", client_id: "admin-cli", username: ADMIN_USER, password: ADMIN_PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) fail(`Master admin sign-in failed (${res.status}). Is KC_BOOTSTRAP_ADMIN_PASSWORD the one the container was created with?`);
  // Master-admin tokens live about 60 seconds.
  cached = { value: data.access_token, until: Date.now() + 30_000 };
  return cached.value;
}

/** Calls {TC}/admin/realms/{REALM}{path}. A URLSearchParams body is sent as a form. */
async function admin(method, path, body, url = `${TC}/admin/realms/${REALM}${path}`) {
  const headers = { authorization: `Bearer ${await token()}` };
  let payload;
  if (body instanceof URLSearchParams) payload = body;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload, redirect: "manual" });
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, data, location: res.headers.get("location") };
}

const form = (fields) => new URLSearchParams(fields);
const user = async (username) => ((await admin("GET", `/users?username=${username}&exact=true`)).data ?? [])[0] ?? null;
const realmRoles = async (id) => ((await admin("GET", `/users/${id}/role-mappings/realm`)).data ?? []).map((r) => r.name);
const pending = async () => {
  const res = await admin("GET", "/iga/change-requests?status=PENDING");
  return Array.isArray(res.data) ? res.data : [];
};
async function realmManagement() {
  return ((await admin("GET", "/clients?clientId=realm-management")).data ?? [])[0]?.id;
}
async function adminsOf() {
  const rm = await realmManagement();
  const res = rm ? await admin("GET", `/clients/${rm}/roles/tide-realm-admin/users`) : { data: [] };
  return Array.isArray(res.data) ? res.data.map((u) => u.username) : [];
}

/** FirstAdmin mode: approve and apply every pending change request (never a destructive one). */
async function drain() {
  // Once anyone holds tide-realm-admin, approvals belong to the admins, never to this script.
  if ((await adminsOf()).length > 0) return;
  for (let pass = 0; pass < 5; pass++) {
    const open = (await pending()).filter((c) => !SKIP_DESTRUCTIVE.includes(c.actionType));
    if (!open.length) return;
    for (const cr of open) {
      if (!cr.readyToCommit) await admin("POST", `/iga/change-requests/${cr.id}/authorize`, {});
    }
    for (const cr of (await pending()).filter((c) => c.readyToCommit && !SKIP_DESTRUCTIVE.includes(c.actionType))) {
      await admin("POST", `/iga/change-requests/${cr.id}/commit`);
    }
  }
  const left = await pending();
  if (left.length) console.warn(`  (still pending: ${left.map((c) => `${c.actionType} ${c.id}`).join(", ")})`);
}

// --- helpers --------------------------------------------------------------------------------------

async function reachable() {
  try {
    return (await fetch(`${TC}/realms/master`)).ok;
  } catch {
    return false;
  }
}

function expectOk(res, what) {
  if (res.status >= 300) fail(`${what}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
}

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function step(text) {
  console.log(`==> ${text}`);
}

function fail(text) {
  console.error(`\nERROR: ${text}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

await commands[command]();
