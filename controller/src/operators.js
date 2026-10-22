import { verifyTideCloakToken } from "@tidecloak/verify";

export const OPERATOR_ROLE = "plant-operator";

/**
 * Builds the controller's only identity check. The controller holds no secret:
 * `tidecloakConfig` is the client adapter JSON exported from TideCloak, and its
 * `jwk` block is the realm's public key. Tokens are signed by the Tide network,
 * so nothing on this machine (or the app server) can mint one.
 *
 * Returns `{ ok: true, operator }` or `{ ok: false, status, reason }`.
 */
export function createOperatorVerifier(tidecloakConfig, { role = OPERATOR_ROLE } = {}) {
  if (!tidecloakConfig?.jwk?.keys?.length) {
    throw new Error("tidecloak.json has no jwk.keys; export it from Apps → myclient → Credentials");
  }
  const client = tidecloakConfig.resource;

  return async function verifyOperator(token) {
    if (!token) return { ok: false, status: 401, reason: "No operator token" };

    // Checks signature (realm public key), issuer, expiry and azp.
    const claims = await verifyTideCloakToken(tidecloakConfig, token);
    if (!claims) return { ok: false, status: 401, reason: "Token is not a valid, current token from this realm" };
    if (!claims.sub) return { ok: false, status: 401, reason: "Token has no subject" };

    const roles = new Set([
      ...(claims.realm_access?.roles ?? []),
      ...(claims.resource_access?.[client]?.roles ?? []),
    ]);
    if (!roles.has(role)) {
      return { ok: false, status: 403, reason: `Signed-in user does not hold the ${role} role`, sub: claims.sub };
    }

    return {
      ok: true,
      operator: {
        sub: claims.sub,
        username: claims.preferred_username ?? claims.name ?? `operator-${claims.sub.slice(0, 8)}`,
      },
    };
  };
}

export function bearerToken(req) {
  const header = req.get("authorization") ?? "";
  const match = /^(?:Bearer|DPoP)\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}
