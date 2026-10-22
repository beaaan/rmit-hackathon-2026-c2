// "Make myself an operator": the IT admin grants himself the plant-operator role.
//
// With TideCloak this is real. The grant goes straight from Jo's browser to TideCloak's admin API
// with his own token. On a realm with quorum-enforced governance (QEA) TideCloak doesn't apply it:
// it answers 202 and files a change request that needs approvals from 2 of the 3 admins. We then
// read that request back and show its count. (Approving or denying happens in TideCloak's console.)
// Checked against TideCloak 0.14.41: the admin API answers the app's origin (CORS, Location exposed)
// and a role grant is filed as a GRANT_ROLES change request on the user (entityId = the token's sub).
//
// In rehearsal and in the preview there is no TideCloak, so the same flow is simulated in the page
// and says so.
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_MODE, auth } from "./auth.js";

const REALM_URL = __TIDECLOAK_URL__; // {server}/realms/{realm}
const ADMIN_URL = REALM_URL.replace("/realms/", "/admin/realms/");
const ROLE = "plant-operator";

async function api(path, init = {}) {
  const token = await auth.getToken();
  const res = await fetch(`${ADMIN_URL}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data, location: res.headers.get("location") };
}

const isJosGrant = (sub) => (cr) => cr.entityId === sub && cr.actionType === "GRANT_ROLES";

/** Normalises TideCloak's change-request object to what the page shows. */
function fromChangeRequest(cr) {
  return {
    id: cr.id,
    status: cr.status, // PENDING | APPROVED | DENIED | CANCELLED
    approvals: typeof cr.authorizationCount === "number" ? cr.authorizationCount : null,
    approvers: (cr.authorizers ?? []).map((a) => a.username),
    threshold: cr.threshold ?? null,
    ready: !!cr.readyToCommit,
    simulated: false,
  };
}

export function useSelfPromotion(session) {
  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef(null);

  useEffect(() => () => clearInterval(poll.current), []);

  const watch = useCallback((id) => {
    clearInterval(poll.current);
    const read = async () => {
      const res = await api(`/iga/change-requests/${id}`);
      if (!res.ok || !res.data) return;
      setRequest(fromChangeRequest(res.data));
      if (res.data.status !== "PENDING") clearInterval(poll.current);
    };
    read();
    poll.current = setInterval(read, 3000);
  }, []);

  // A pending request outlives a page reload: pick up the one Jo already filed.
  const sub = session?.sub;
  const operator = session?.isOperator;
  useEffect(() => {
    if (AUTH_MODE !== "tide" || !sub || operator) return;
    let gone = false;
    api(`/iga/change-requests?status=PENDING`)
      .then((list) => {
        const mine = Array.isArray(list.data) ? list.data.find(isJosGrant(sub)) : null;
        if (mine && !gone) watch(mine.id);
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [sub, operator, watch]);

  const file = useCallback(async () => {
    setError(null);
    if (AUTH_MODE !== "tide") {
      // Rehearsal and preview: what TideCloak does, played out in the page.
      setRequest({ id: "simulated", status: "PENDING", approvals: 0, approvers: [], threshold: 2, simulated: true });
      return;
    }
    if (!session?.sub) return setError("Sign in first.");
    setBusy(true);
    try {
      const role = await api(`/roles/${ROLE}`);
      if (!role.ok) return setError(`TideCloak wouldn't look up the ${ROLE} role (${role.status}).`);
      const grant = await api(`/users/${session.sub}/role-mappings/realm`, {
        method: "POST",
        body: JSON.stringify([{ id: role.data.id, name: role.data.name }]),
      });
      if (grant.status === 202) {
        const id = grant.location?.split("/").pop();
        if (id) return watch(id);
        // The Location header may not be readable cross-origin; find the request instead.
        const list = await api(`/iga/change-requests?status=PENDING`);
        const mine = Array.isArray(list.data) ? list.data.find(isJosGrant(session.sub)) : null;
        if (mine) return watch(mine.id);
        return setRequest({ id: "?", status: "PENDING", approvals: null, approvers: [], threshold: null, simulated: false });
      }
      if (grant.status === 204) {
        return setError("TideCloak applied the grant immediately. Quorum governance (QEA) isn't switched on in this realm, so check the realm setup.");
      }
      // Already filed (say, before a reload): show that request instead.
      if (grant.status === 409 && grant.data?.conflictingChangeRequestId) return watch(grant.data.conflictingChangeRequestId);
      if (grant.status === 409) return setError("There's already a pending change for Jo. Look in TideCloak's change requests.");
      if (grant.status === 403) return setError("TideCloak refused: this account can't manage roles.");
      setError(`TideCloak answered ${grant.status}.`);
    } catch (err) {
      setError(`Couldn't reach TideCloak: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, [session, watch]);

  /** Rehearsal only: Jo approves his own request (TideCloak allows the filer to approve). */
  const approveOwn = useCallback(() => {
    setRequest((r) => (r && r.simulated && !r.approvers.includes("jo") ? { ...r, approvals: r.approvals + 1, approvers: [...r.approvers, "jo"] } : r));
  }, []);

  const reset = useCallback(() => {
    clearInterval(poll.current);
    setRequest(null);
    setError(null);
  }, []);

  return { request, error, busy, file, approveOwn, reset, tideConsole: REALM_URL ? `${REALM_URL}/tide-console/` : null };
}
