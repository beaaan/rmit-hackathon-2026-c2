// Two ways to be signed in:
//  - "tide": a real TideCloak login (IAMService from @tidecloak/js). Tokens are signed by the Tide network.
//  - "rehearsal": pick jo / kim / raj; tokens come from the controller's locally generated stand-in
//    realm. Lets you run the whole story without TideCloak. Never use it for the real demo.
import { IAMService } from "@tidecloak/js";

export const AUTH_MODE = __AUTH_MODE__;
export const OPERATOR_ROLE = "plant-operator";

function decodeJwt(token) {
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(payload));
}

function sessionFromClaims(claims) {
  const roles = claims.realm_access?.roles ?? [];
  return {
    sub: claims.sub,
    username: claims.preferred_username ?? `user-${String(claims.sub).slice(0, 8)}`,
    roles,
    isOperator: roles.includes(OPERATOR_ROLE),
  };
}

const tide = {
  mode: "tide",
  async init() {
    const config = await fetch("/tidecloak.json").then((r) => r.json());
    const loggedIn = await IAMService.initIAM(config);
    if (location.pathname.startsWith("/auth/redirect")) history.replaceState(null, "", "/");
    if (!loggedIn) return null;
    return sessionFromClaims(decodeJwt(await IAMService.getToken()));
  },
  login: () => IAMService.doLogin(),
  logout: () => IAMService.doLogout(),
  getToken: () => IAMService.getToken(),
};

// sessionStorage is per tab, so two tabs can be two different operators.
const PERSONA_KEY = "rehearsal-persona";
// Storage can be unavailable (private windows, embedded previews); the page still works without it.
const readPersona = () => {
  try {
    return sessionStorage.getItem(PERSONA_KEY);
  } catch {
    return null;
  }
};
let rehearsalTokens = null;

const rehearsal = {
  mode: "rehearsal",
  personas: ["jo", "kim", "raj"],
  async init() {
    if (globalThis.__simTokens) {
      // The shareable preview build: the stand-in realm lives in the page (sim/sim-controller.js).
      rehearsalTokens = await globalThis.__simTokens();
    } else {
      const res = await fetch("/rehearsal/tokens.json");
      if (!res.headers.get("content-type")?.includes("json")) {
        throw new Error("No rehearsal tokens. Run `npm run dev:keys` in controller/ (or `npm run demo` at the repo root).");
      }
      rehearsalTokens = await res.json();
    }
    const persona = readPersona();
    return persona && rehearsalTokens[persona] ? sessionFromClaims(decodeJwt(rehearsalTokens[persona])) : null;
  },
  login(persona) {
    sessionStorage.setItem(PERSONA_KEY, persona);
    location.reload();
  },
  logout() {
    sessionStorage.removeItem(PERSONA_KEY);
    location.reload();
  },
  // The story acts as a named person ("Kim approves"); the control room acts as the chosen persona.
  async getToken(persona) {
    return rehearsalTokens?.[persona ?? readPersona()] ?? null;
  },
};

export const auth = AUTH_MODE === "tide" ? tide : rehearsal;
