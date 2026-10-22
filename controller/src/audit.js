import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const GENESIS = "0".repeat(64);

function hashEntry(entry) {
  const { hash, ...rest } = entry;
  return createHash("sha256").update(JSON.stringify(rest)).digest("hex");
}

/**
 * Append-only audit log. Each entry carries the hash of the previous one, so
 * editing or deleting a past line breaks the chain and `verify()` reports it.
 * Entries are kept in memory and, when `filePath` is set, appended as JSON lines.
 */
export class AuditLog {
  constructor({ filePath, now = () => new Date() } = {}) {
    this.filePath = filePath;
    this.now = now;
    this.entries = [];
    if (filePath && existsSync(filePath)) {
      const lines = readFileSync(filePath, "utf8").split("\n").filter(Boolean);
      this.entries = lines.map((line) => JSON.parse(line));
    }
    if (filePath) mkdirSync(dirname(filePath), { recursive: true });
  }

  append(type, details = {}) {
    const prev = this.entries.at(-1);
    const entry = {
      seq: prev ? prev.seq + 1 : 1,
      at: this.now().toISOString(),
      type,
      ...details,
      prevHash: prev ? prev.hash : GENESIS,
    };
    entry.hash = hashEntry(entry);
    this.entries.push(entry);
    if (this.filePath) appendFileSync(this.filePath, JSON.stringify(entry) + "\n");
    return entry;
  }

  list() {
    return [...this.entries];
  }

  /** @returns {{ ok: boolean, brokenAt?: number }} */
  verify() {
    let prevHash = GENESIS;
    for (const entry of this.entries) {
      if (entry.prevHash !== prevHash || hashEntry(entry) !== entry.hash) {
        return { ok: false, brokenAt: entry.seq };
      }
      prevHash = entry.hash;
    }
    return { ok: true };
  }
}
