import { Database } from "bun:sqlite";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const AUDIT_DISABLED = process.env.CODEX_AUDIT_DISABLED === "1" || process.env.CODEX_AUDIT_DISABLED === "true";
const AUDIT_DB_PATH = resolve(process.env.CODEX_AUDIT_DB ?? "data/codex-wrapper.sqlite");

type AuditRecord = {
  id: string;
  startedAt: number;
};

type AuditUpdate = Partial<{
  completed_at: string;
  duration_ms: number;
  method: string;
  path: string;
  client_ip: string | null;
  user_agent: string | null;
  request_model: string | null;
  upstream_model: string | null;
  stream: boolean | null;
  status: number | null;
  ok: boolean | null;
  request_json: unknown;
  upstream_request_json: unknown;
  response_json: unknown;
  response_text: string | null;
  error_json: unknown;
}>;

let db: Database | null = null;

function auditDb() {
  if (AUDIT_DISABLED) return null;
  if (db) return db;

  mkdirSync(dirname(AUDIT_DB_PATH), { recursive: true });
  db = new Database(AUDIT_DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    create table if not exists api_calls (
      id text primary key,
      created_at text not null,
      completed_at text,
      duration_ms integer,
      method text not null,
      path text not null,
      client_ip text,
      user_agent text,
      request_model text,
      upstream_model text,
      stream integer,
      status integer,
      ok integer,
      request_json text,
      upstream_request_json text,
      response_json text,
      response_text text,
      error_json text
    )
  `);
  db.exec("create index if not exists api_calls_created_at_idx on api_calls(created_at)");
  db.exec("create index if not exists api_calls_path_idx on api_calls(path)");
  db.exec("create index if not exists api_calls_status_idx on api_calls(status)");
  return db;
}

export function createAuditCall(input: { method: string; path: string; clientIp?: string | null; userAgent?: string | null }): AuditRecord | null {
  const database = auditDb();
  if (!database) return null;

  const record = { id: crypto.randomUUID(), startedAt: Date.now() };
  database.query(`
    insert into api_calls (id, created_at, method, path, client_ip, user_agent)
    values (?, ?, ?, ?, ?, ?)
  `).run(record.id, new Date(record.startedAt).toISOString(), input.method, input.path, input.clientIp ?? null, input.userAgent ?? null);
  return record;
}

export function updateAuditCall(record: AuditRecord | null, update: AuditUpdate) {
  const database = auditDb();
  if (!database || !record) return;

  const entries = Object.entries(update).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([key, value]) => auditValue(key, value));
  database.query(`update api_calls set ${assignments} where id = ?`).run(...values as never[], record.id);
}

export function finishAuditCall(record: AuditRecord | null, update: AuditUpdate) {
  if (!record) return;
  updateAuditCall(record, {
    ...update,
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - record.startedAt,
  });
}

export function auditDbPath() {
  return AUDIT_DISABLED ? null : AUDIT_DB_PATH;
}

function auditValue(key: string, value: unknown) {
  if (key.endsWith("_json")) return value === undefined ? null : stringify(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value ?? null;
}

function stringify(value: unknown) {
  try {
    return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested);
  } catch {
    return JSON.stringify({ unserializable: true, value: String(value) });
  }
}
