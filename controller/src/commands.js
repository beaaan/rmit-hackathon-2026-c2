import { randomUUID } from "node:crypto";
import { ACTIONS } from "./plant.js";

export const REQUIRED_APPROVALS = 2;

export class ValidationError extends Error {}

/**
 * Pending plant commands and their approvals. A command runs only when it holds
 * approvals from `requiredApprovals` distinct operator subjects; there is no
 * other path to `plant.apply`.
 */
export class CommandBook {
  constructor({ plant, audit, requiredApprovals = REQUIRED_APPROVALS, now = () => new Date() }) {
    this.plant = plant;
    this.audit = audit;
    this.requiredApprovals = requiredApprovals;
    this.now = now;
    this.commands = new Map();
  }

  list() {
    return [...this.commands.values()].reverse();
  }

  get(id) {
    return this.commands.get(id);
  }

  propose({ action, line, reason, evidence, proposedBy } = {}) {
    if (!Object.hasOwn(ACTIONS, action)) throw new ValidationError(`Unknown action '${action}'`);
    if (!this.plant.hasLine(line)) throw new ValidationError(`Unknown line '${line}'`);
    if (typeof reason !== "string" || !reason.trim()) throw new ValidationError("A reason is required");
    if (reason.length > 2000) throw new ValidationError("Reason is too long");
    if (evidence !== undefined && !Array.isArray(evidence)) throw new ValidationError("Evidence must be a list");

    const duplicate = this.list().find((c) => c.status === "pending" && c.action === action && c.line === line);
    if (duplicate) return { created: false, command: duplicate };

    const command = {
      id: `cmd-${randomUUID().slice(0, 8)}`,
      action,
      actionLabel: ACTIONS[action],
      line,
      reason: reason.trim(),
      evidence: (evidence ?? []).slice(0, 30),
      proposedBy: String(proposedBy ?? "unknown").slice(0, 60),
      createdAt: this.now().toISOString(),
      status: "pending",
      requiredApprovals: this.requiredApprovals,
      approvals: [],
    };
    this.commands.set(command.id, command);
    this.audit.append("command.proposed", {
      commandId: command.id,
      action,
      line,
      actor: { kind: "unverified", claimed: command.proposedBy },
    });
    return { created: true, command };
  }

  /**
   * Records an approval from an operator whose token the caller has already verified.
   * Executes the command when the distinct-approver count reaches the threshold.
   */
  approve(id, operator) {
    const command = this.commands.get(id);
    if (!command) return { status: 404, error: "No such command" };
    if (command.status !== "pending") {
      return { status: 409, error: `Command is already ${command.status}`, command };
    }
    if (command.approvals.some((a) => a.sub === operator.sub)) {
      this.audit.append("approval.duplicate", {
        commandId: id,
        actor: { kind: "operator", ...operator },
        approvals: command.approvals.length,
      });
      return {
        status: 409,
        error: `${operator.username} already approved; ${command.approvals.length} of ${command.requiredApprovals} distinct operators`,
        command,
      };
    }

    command.approvals.push({ ...operator, at: this.now().toISOString() });
    this.audit.append("approval.recorded", {
      commandId: id,
      actor: { kind: "operator", ...operator },
      approvals: command.approvals.length,
      required: command.requiredApprovals,
    });

    if (command.approvals.length >= command.requiredApprovals) {
      this.plant.apply(command.action, command.line);
      command.status = "executed";
      command.executedAt = this.now().toISOString();
      this.audit.append("command.executed", {
        commandId: id,
        action: command.action,
        line: command.line,
        approvedBy: command.approvals.map((a) => a.username),
      });
    }
    return { status: 200, command };
  }

  reject(id, operator, note) {
    const command = this.commands.get(id);
    if (!command) return { status: 404, error: "No such command" };
    if (command.status !== "pending") {
      return { status: 409, error: `Command is already ${command.status}`, command };
    }
    command.status = "rejected";
    command.rejectedBy = { ...operator, at: this.now().toISOString(), note: note ? String(note).slice(0, 500) : undefined };
    this.audit.append("command.rejected", { commandId: id, actor: { kind: "operator", ...operator } });
    return { status: 200, command };
  }

  /**
   * The endpoint a client (or a prompt-injected agent) would call to "just run it".
   * It never executes anything: execution happens only inside `approve`.
   */
  refuseDirectExecute(id, claimedActor) {
    const command = this.commands.get(id);
    const approvals = command?.approvals.length ?? 0;
    const reason = !command
      ? "No such command"
      : command.status !== "pending"
        ? `Command is already ${command.status}`
        : `Needs ${command.requiredApprovals} distinct operator approvals, has ${approvals}. ` +
          "Commands run only when the last operator approves; no credential can skip that.";
    this.audit.append("execute.refused", {
      commandId: id,
      actor: { kind: "unverified", claimed: String(claimedActor ?? "unknown").slice(0, 60) },
      reason,
    });
    return { status: command ? 403 : 404, error: reason, command };
  }
}
