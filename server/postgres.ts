import postgres from "postgres";
import type { PageConfig } from "../src/lib/page-config";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://linkqt:linkqt@localhost:5432/linkqt";

export const sql = postgres(DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {},
});

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE,
      display_name TEXT,
      provider TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS pages (
      slug TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      config JSONB NOT NULL,
      is_published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      data BYTEA NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'image/jpeg',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      page_slug TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls JSONB,
      flow JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_usage (
      user_id TEXT NOT NULL,
      date DATE NOT NULL,
      prompt_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, date)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chat_sessions_page_slug ON chat_sessions(page_slug)`;
}

// ── User CRUD ──

export interface DbUser {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  provider: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function upsertUser(
  id: string,
  email: string,
  displayName: string | null,
  provider: string | null
): Promise<DbUser> {
  const [user] = await sql<DbUser[]>`
    INSERT INTO users (id, email, display_name, provider)
    VALUES (${id}, ${email}, ${displayName}, ${provider})
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = COALESCE(EXCLUDED.display_name, users.display_name),
      provider = COALESCE(EXCLUDED.provider, users.provider),
      updated_at = NOW()
    RETURNING *
  `;
  return user;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const [user] = await sql<DbUser[]>`SELECT * FROM users WHERE id = ${id}`;
  return user ?? null;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const [row] = await sql`SELECT 1 FROM users WHERE username = ${username}`;
  return !!row;
}

const RESERVED_USERNAMES = new Set([
  "login", "signup", "onboarding", "dashboard", "admin", "api",
  "settings", "profile", "about", "help", "support", "terms",
  "privacy", "health", "ws", "static", "public", "assets",
]);

export async function claimUsername(
  userId: string,
  username: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const clean = username.toLowerCase().trim();

  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(clean)) {
    return { ok: false, reason: "Username must be 3-30 characters, lowercase letters, numbers, and hyphens only." };
  }
  if (RESERVED_USERNAMES.has(clean)) {
    return { ok: false, reason: "That username is reserved." };
  }

  const user = await getUserById(userId);
  if (!user) return { ok: false, reason: "User not found." };
  if (user.username) return { ok: false, reason: "You already have a username." };

  if (await isUsernameTaken(clean)) {
    return { ok: false, reason: "That username is already taken." };
  }

  await sql`UPDATE users SET username = ${clean}, updated_at = NOW() WHERE id = ${userId}`;
  return { ok: true };
}

// ── Page CRUD ──

export interface DbPage {
  slug: string;
  user_id: string;
  config: PageConfig;
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function createPage(
  slug: string,
  userId: string,
  config: PageConfig
): Promise<void> {
  await sql`
    INSERT INTO pages (slug, user_id, config)
    VALUES (${slug}, ${userId}, ${sql.json(config)})
  `;
}

export async function publishPage(
  slug: string,
  userId: string,
  config: PageConfig
): Promise<boolean> {
  const rows = await sql<{ slug: string }[]>`
    INSERT INTO pages (slug, user_id, config, is_published)
    VALUES (${slug}, ${userId}, ${sql.json(config)}, TRUE)
    ON CONFLICT (slug) DO UPDATE
    SET config = EXCLUDED.config, is_published = TRUE, updated_at = NOW()
    WHERE pages.user_id = ${userId}
    RETURNING slug
  `;
  return rows.length > 0;
}

export async function getPublishedPage(slug: string): Promise<PageConfig | null> {
  const [row] = await sql<{ config: PageConfig }[]>`
    SELECT config FROM pages WHERE slug = ${slug} AND is_published = TRUE
  `;
  return row?.config ?? null;
}

export async function getPageBySlug(slug: string): Promise<DbPage | null> {
  const [row] = await sql<DbPage[]>`SELECT * FROM pages WHERE slug = ${slug}`;
  return row ?? null;
}

// ── Image CRUD ──

export async function saveImage(
  id: string,
  userId: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  await sql`
    INSERT INTO images (id, user_id, data, content_type)
    VALUES (${id}, ${userId}, ${data}, ${contentType})
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, content_type = EXCLUDED.content_type
  `;
}

export async function getImage(
  id: string
): Promise<{ data: Buffer; content_type: string } | null> {
  const [row] = await sql<{ data: Buffer; content_type: string }[]>`
    SELECT data, content_type FROM images WHERE id = ${id}
  `;
  return row ?? null;
}

// ── Chat Sessions ──

export async function saveChatMessage(params: {
  id: string;
  pageSlug: string;
  role: string;
  content: string;
  toolCalls?: Record<string, unknown>[];
  flow?: Record<string, unknown>[];
}): Promise<void> {
  await sql`
    INSERT INTO chat_sessions (id, page_slug, role, content, tool_calls, flow)
    VALUES (
      ${params.id}, ${params.pageSlug}, ${params.role}, ${params.content},
      ${params.toolCalls ? sql.json(params.toolCalls as never) : null},
      ${params.flow ? sql.json(params.flow as never) : null}
    )
  `;
}

export async function getChatHistory(pageSlug: string, limit = 50) {
  return sql`
    SELECT * FROM chat_sessions
    WHERE page_slug = ${pageSlug}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

// ── AI Usage ──

export async function incrementAiUsage(userId: string): Promise<void> {
  await sql`
    INSERT INTO ai_usage (user_id, date, prompt_count)
    VALUES (${userId}, CURRENT_DATE, 1)
    ON CONFLICT (user_id, date) DO UPDATE SET prompt_count = ai_usage.prompt_count + 1
  `;
}

export async function getAiUsage(userId: string): Promise<number> {
  const [row] = await sql<{ prompt_count: number }[]>`
    SELECT prompt_count FROM ai_usage WHERE user_id = ${userId} AND date = CURRENT_DATE
  `;
  return row?.prompt_count ?? 0;
}
