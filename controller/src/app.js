import express from "express";
import { CommandBook, ValidationError } from "./commands.js";
import { bearerToken } from "./operators.js";

/**
 * @param {object} deps
 * @param {(token: string|null) => Promise<{ok: boolean, operator?: object, status?: number, reason?: string}>} deps.verifyOperator
 * @param {import("./plant.js").Plant} deps.plant
 * @param {import("./audit.js").AuditLog} deps.audit
 * @param {string[]} [deps.allowedOrigins] browser origins allowed to call the controller
 * @param {boolean} [deps.demoControls] expose the scenario endpoint used to stage the demo
 */
export function createApp({ verifyOperator, plant, audit, allowedOrigins = [], demoControls = true, requiredApprovals, now }) {
  const book = new CommandBook({ plant, audit, requiredApprovals, now });
  const app = express();
  app.disable("x-powered-by");
  app.locals.book = book;

  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && allowedOrigins.includes(origin)) {
      res.set({
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, DPoP, X-Actor",
        Vary: "Origin",
      });
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "32kb" }));

  const claimedActor = (req) => req.get("x-actor") ?? req.body?.proposedBy ?? "unknown";

  async function requireOperator(req, res, commandId, purpose) {
    const result = await verifyOperator(bearerToken(req));
    if (result.ok) return result.operator;
    audit.append(`${purpose}.refused`, {
      commandId,
      actor: result.sub ? { kind: "signed-in", sub: result.sub } : { kind: "unverified", claimed: claimedActor(req) },
      reason: result.reason,
    });
    res.status(result.status).json({ error: result.reason });
    return null;
  }

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.get("/plant/state", (req, res) => res.json(plant.state()));

  if (demoControls) {
    app.post("/plant/scenario", (req, res) => {
      const { kind, line } = req.body ?? {};
      if (kind === "pressure-spike" && plant.hasLine(line)) plant.startSpike(line);
      else if (kind === "reset") plant.reset();
      else return res.status(400).json({ error: "Use {kind: 'pressure-spike', line} or {kind: 'reset'}" });
      audit.append("plant.scenario", { kind, line, actor: { kind: "unverified", claimed: claimedActor(req) } });
      res.json(plant.state());
    });
  }

  app.get("/commands", (req, res) => res.json(book.list()));

  app.post("/commands", (req, res) => {
    try {
      const { created, command } = book.propose({ ...req.body, proposedBy: claimedActor(req) });
      res.status(created ? 201 : 200).json(command);
    } catch (err) {
      if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
      throw err;
    }
  });

  app.get("/commands/:id", (req, res) => {
    const command = book.get(req.params.id);
    if (!command) return res.status(404).json({ error: "No such command" });
    res.json(command);
  });

  app.post("/commands/:id/approve", async (req, res) => {
    if (!book.get(req.params.id)) return res.status(404).json({ error: "No such command" });
    const operator = await requireOperator(req, res, req.params.id, "approval");
    if (!operator) return;
    const { status, error, command } = book.approve(req.params.id, operator);
    res.status(status).json(error ? { error, command } : command);
  });

  app.post("/commands/:id/reject", async (req, res) => {
    if (!book.get(req.params.id)) return res.status(404).json({ error: "No such command" });
    const operator = await requireOperator(req, res, req.params.id, "rejection");
    if (!operator) return;
    const { status, error, command } = book.reject(req.params.id, operator, req.body?.note);
    res.status(status).json(error ? { error, command } : command);
  });

  app.post("/commands/:id/execute", (req, res) => {
    const { status, error, command } = book.refuseDirectExecute(req.params.id, claimedActor(req));
    res.status(status).json({ error, command });
  });

  app.get("/audit", (req, res) => res.json({ chain: audit.verify(), entries: audit.list() }));

  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}
