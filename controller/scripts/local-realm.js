// A stand-in for a TideCloak realm, for tests and offline rehearsal only.
// It generates an Ed25519 key pair locally and signs tokens shaped like
// TideCloak's. A real realm never exposes a private key like this: its tokens
// are signed by the Tide network.
import { SignJWT, exportJWK, generateKeyPair } from "jose";

export async function createLocalRealm({
  authServerUrl = "http://localhost:8080",
  realm = "riverbend",
  client = "myclient",
} = {}) {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const kid = "local-dev-key";
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "EdDSA", use: "sig" };

  const config = {
    realm,
    "auth-server-url": authServerUrl,
    "ssl-required": "external",
    resource: client,
    "public-client": true,
    "confidential-port": 0,
    jwk: { keys: [jwk] },
  };

  /**
   * @param {{ sub: string, username?: string, roles?: string[], expiresIn?: string|number,
   *           issuer?: string, azp?: string, key?: CryptoKey }} opts
   */
  async function mint({ sub, username, roles = [], expiresIn = "1h", issuer, azp = client, key = privateKey }) {
    return new SignJWT({
      azp,
      preferred_username: username,
      realm_access: { roles: ["default-roles-" + realm, ...roles] },
    })
      .setProtectedHeader({ alg: "EdDSA", kid, typ: "JWT" })
      .setSubject(sub)
      .setIssuer(issuer ?? `${authServerUrl}/realms/${realm}`)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(key);
  }

  return { config, mint };
}
