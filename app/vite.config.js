import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { tideDpopPlugin } from "@tidecloak/js/vite";
import { defineConfig } from "vite";

// One tidecloak.json for the whole demo: the controller's copy. If it's there, the app
// signs people in with TideCloak. If not, the app runs in rehearsal mode against the
// controller's locally generated stand-in realm (controller/dev/, from `npm run dev:keys`).
const tidecloakPath = fileURLToPath(new URL("../controller/tidecloak.json", import.meta.url));
const devTokensPath = fileURLToPath(new URL("../controller/dev/tokens.json", import.meta.url));
const tidecloak = existsSync(tidecloakPath) ? JSON.parse(readFileSync(tidecloakPath, "utf8")) : null;
const authMode = process.env.AUTH_MODE ?? (tidecloak ? "tide" : "rehearsal");

function serveJson(route, load) {
  const middleware = (req, res, next) => {
    if (req.url?.split("?")[0] !== route) return next();
    const body = load();
    if (!body) return next();
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(body));
  };
  return {
    name: `serve-${route}`,
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    authMode === "tide"
      ? [serveJson("/tidecloak.json", () => tidecloak), tideDpopPlugin({ config: tidecloak })]
      : serveJson("/rehearsal/tokens.json", () =>
          existsSync(devTokensPath) ? JSON.parse(readFileSync(devTokensPath, "utf8")) : null,
        ),
  ],
  define: {
    __AUTH_MODE__: JSON.stringify(authMode),
    __CONTROLLER_URL__: JSON.stringify(process.env.CONTROLLER_URL ?? "http://localhost:4000"),
    __TIDECLOAK_URL__: JSON.stringify(tidecloak ? `${tidecloak["auth-server-url"].replace(/\/$/, "")}/realms/${tidecloak.realm}` : ""),
  },
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
});
