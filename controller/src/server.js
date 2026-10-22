import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { AuditLog } from "./audit.js";
import { createOperatorVerifier } from "./operators.js";
import { Plant } from "./plant.js";

const configPath = resolve(process.env.TIDECLOAK_CONFIG ?? "tidecloak.json");
let tidecloakConfig;
try {
  tidecloakConfig = JSON.parse(readFileSync(configPath, "utf8"));
} catch (err) {
  console.error(`Could not read ${configPath}: ${err.message}`);
  console.error("Copy tidecloak.json from TideCloak (Apps → myclient → Credentials), or run `npm run dev:keys`.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",").map((o) => o.trim());
const plant = new Plant();
const audit = new AuditLog({ filePath: resolve(process.env.AUDIT_LOG ?? "data/audit.jsonl") });

const app = createApp({
  verifyOperator: createOperatorVerifier(tidecloakConfig),
  plant,
  audit,
  allowedOrigins,
  demoControls: process.env.DEMO_CONTROLS !== "0",
});

setInterval(() => plant.tick(), 1000);

app.listen(port, () => {
  console.log(`Plant controller on http://localhost:${port}`);
  console.log(`  realm: ${tidecloakConfig.realm} (${tidecloakConfig["auth-server-url"]}), client: ${tidecloakConfig.resource}`);
  console.log(`  browser origins allowed: ${allowedOrigins.join(", ")}`);
});
