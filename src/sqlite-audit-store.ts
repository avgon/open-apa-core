import { DatabaseSync } from "node:sqlite";
import type { AuditStore } from "./audit-store.js";

export type StoredAuditEvent = {
  readonly id: string;
  readonly at: string;
};

/**
 * Durable local audit store for Node.js 22+. Events are inserted once and
 * returned in insertion order. Production deployments should encrypt disks,
 * apply backup retention, and add tenant-specific access controls.
 */
export class SqliteAuditStore<TEvent extends StoredAuditEvent> implements AuditStore<TEvent> {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS open_apa_audit_events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        at TEXT NOT NULL,
        payload TEXT NOT NULL
      ) STRICT;
    `);
  }

  append(event: TEvent): void {
    this.database
      .prepare("INSERT INTO open_apa_audit_events (id, at, payload) VALUES (?, ?, ?)")
      .run(event.id, event.at, JSON.stringify(event));
  }

  list(): readonly TEvent[] {
    const rows = this.database
      .prepare("SELECT payload FROM open_apa_audit_events ORDER BY sequence ASC")
      .all() as { payload: string }[];
    return rows.map((row) => JSON.parse(row.payload) as TEvent);
  }

  close(): void {
    this.database.close();
  }
}
