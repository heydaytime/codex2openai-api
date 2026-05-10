import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), "data", "linkqt.db");

let instance: Database | undefined;

export async function getDb(): Promise<Database> {
  if (instance) return instance;
  await mkdir(dirname(DB_PATH), { recursive: true });
  instance = new Database(DB_PATH);
  instance.run("PRAGMA journal_mode = WAL");
  instance.run("PRAGMA foreign_keys = ON");
  migrate(instance);
  return instance;
}

function migrate(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pages (
    slug TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    config TEXT NOT NULL,
    draft_config TEXT,
    is_published INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    page_slug TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_calls TEXT,
    flow TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ai_usage (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    prompt_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
  )`);
}

export function getPage(db: Database, slug: string) {
  return db.query("SELECT * FROM pages WHERE slug = ?").get(slug) as {
    slug: string;
    user_id: string;
    config: string;
    draft_config: string | null;
    is_published: number;
  } | null;
}

export function upsertDraft(db: Database, slug: string, userId: string, configJson: string) {
  db.run(
    `INSERT INTO pages (slug, user_id, config, draft_config, is_published, updated_at)
     VALUES (?, ?, ?, ?, 0, unixepoch())
     ON CONFLICT(slug) DO UPDATE SET draft_config = excluded.draft_config, updated_at = unixepoch()`,
    [slug, userId, configJson, configJson]
  );
}

export function publishPage(db: Database, slug: string) {
  const page = getPage(db, slug);
  if (!page) throw new Error(`Page not found: ${slug}`);
  const config = page.draft_config ?? page.config;
  db.run("UPDATE pages SET config = ?, is_published = 1, updated_at = unixepoch() WHERE slug = ?", [config, slug]);
}

export function getPublishedPage(db: Database, slug: string) {
  return db.query("SELECT config FROM pages WHERE slug = ? AND is_published = 1").get(slug) as { config: string } | null;
}

export function saveChatMessage(
  db: Database,
  params: { id: string; pageSlug: string; role: string; content: string; toolCalls?: string; flow?: string }
) {
  db.run(
    "INSERT INTO chat_sessions (id, page_slug, role, content, tool_calls, flow) VALUES (?, ?, ?, ?, ?, ?)",
    [params.id, params.pageSlug, params.role, params.content, params.toolCalls ?? null, params.flow ?? null]
  );
}

export function getChatHistory(db: Database, pageSlug: string, limit = 50) {
  return db.query("SELECT * FROM chat_sessions WHERE page_slug = ? ORDER BY created_at DESC LIMIT ?").all(pageSlug, limit) as Array<{
    id: string;
    page_slug: string;
    role: string;
    content: string;
    tool_calls: string | null;
    flow: string | null;
    created_at: number;
  }>;
}

export function incrementAiUsage(db: Database, userId: string) {
  const date = new Date().toISOString().slice(0, 10);
  db.run(
    `INSERT INTO ai_usage (user_id, date, prompt_count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, date) DO UPDATE SET prompt_count = prompt_count + 1`,
    [userId, date]
  );
}

export function getAiUsage(db: Database, userId: string): number {
  const date = new Date().toISOString().slice(0, 10);
  const row = db.query("SELECT prompt_count FROM ai_usage WHERE user_id = ? AND date = ?").get(userId, date) as { prompt_count: number } | null;
  return row?.prompt_count ?? 0;
}
