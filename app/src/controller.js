// The browser talks to the plant controller directly. Approval tokens never pass through
// an app server, and operators read command details from the controller itself.
import { auth } from "./auth.js";

export const CONTROLLER_URL = __CONTROLLER_URL__;

async function request(method, path, { body, withToken = false, as, token: given, actor } = {}) {
  const headers = { "content-type": "application/json" };
  if (withToken) {
    const token = given ?? (await auth.getToken(as));
    if (token) headers.authorization = `Bearer ${token}`;
  }
  if (actor) headers["x-actor"] = actor;
  const res = await fetch(CONTROLLER_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export const controller = {
  state: () => request("GET", "/plant/state"),
  commands: () => request("GET", "/commands"),
  audit: () => request("GET", "/audit"),
  // `as` picks a rehearsal persona; with TideCloak it is ignored and the signed-in person approves.
  approve: (id, as) => request("POST", `/commands/${id}/approve`, { withToken: true, as }),
  // The "hacked server" move: an approval carrying a token nobody in the realm signed.
  approveWithToken: (id, token, actor) => request("POST", `/commands/${id}/approve`, { withToken: true, token, actor }),
  reject: (id, note) => request("POST", `/commands/${id}/reject`, { withToken: true, body: { note } }),
  scenario: (body, actor) => request("POST", "/plant/scenario", { body, actor }),
  writeLog: (text, actor) => request("POST", "/ops-log", { body: { text }, actor }),
};
