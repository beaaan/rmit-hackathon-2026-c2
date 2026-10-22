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

// `vite build --mode artifact` makes the shareable preview: the controller and Sentinel run inside the
// page (src/sim/sim-controller.js) and every asset path is relative.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => mode === "artifact" ? {
  base: "./",
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^\.\/controller\.js$/, replacement: fileURLToPath(new URL("./src/sim/sim-controller.js", import.meta.url)) },
      { find: "node:crypto", replacement: fileURLToPath(new URL("./src/sim/node-crypto.js", import.meta.url)) },
    ],
  },
  define: { __AUTH_MODE__: JSON.stringify("rehearsal"), __CONTROLLER_URL__: JSON.stringify(""), __TIDECLOAK_URL__: JSON.stringify(""), __PREVIEW__: "true" },
  server: { fs: { allow: [repoRoot] } },
} : {
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
    __PREVIEW__: "false",
  },
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
});
