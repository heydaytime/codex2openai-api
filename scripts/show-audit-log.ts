import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

type AuditRow = {
  created_at: string;
  path: string;
  request_model: string | null;
  upstream_model: string | null;
  stream: number | null;
  status: number | null;
  duration_ms: number | null;
  request_json: string | null;
  response_text: string | null;
  response_json: string | null;
  error_json: string | null;
};

const args = new Set(process.argv.slice(2));
const limit = numberArg("--limit") ?? numberArg("-n") ?? 10;
const dbPath = resolve(stringArg("--db") ?? process.env.CODEX_AUDIT_DB ?? "data/codex-wrapper.sqlite");
const full = args.has("--full");

if (!existsSync(dbPath)) {
  console.error(`Audit DB not found: ${dbPath}`);
  console.error("Run the wrapper and make at least one API call first, or pass --db /path/to/codex-wrapper.sqlite");
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const rows = db.query<AuditRow, [number]>(`
  select created_at, path, request_model, upstream_model, stream, status, duration_ms,
         request_json, response_text, response_json, error_json
  from api_calls
  where path in ('/v1/chat/completions', '/v1/responses')
  order by created_at desc
  limit ?
`).all(limit);

if (rows.length === 0) {
  console.log(`No chat/response audit rows found in ${dbPath}`);
  process.exit(0);
}

for (const row of rows) {
  const request = parseJson(row.request_json);
  const responseJson = parseJson(row.response_json);
  const errorJson = parseJson(row.error_json);
  const prompt = truncate(extractPrompt(request), full ? Infinity : 500);
  const response = truncate(row.response_text || extractResponse(responseJson) || extractError(errorJson) || "", full ? Infinity : 1000);

  console.log(`${row.created_at} | ${row.status ?? "?"} | ${row.request_model ?? "?"}${row.stream ? " | stream" : ""} | ${row.duration_ms ?? "?"}ms`);
  console.log(`Prompt: ${prompt || "(empty)"}`);
  console.log(`Response: ${response || "(empty)"}`);
  console.log("");
}

function stringArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function numberArg(name: string) {
  const value = stringArg(name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function parseJson(text: string | null): unknown {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function extractPrompt(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const body = value as { messages?: unknown; input?: unknown; instructions?: unknown };
  if (Array.isArray(body.messages)) {
    const userMessages = body.messages.filter((message) => isRole(message, "user"));
    const lastUser = userMessages.at(-1) ?? body.messages.at(-1);
    return messageContent(lastUser);
  }

  const inputText = inputContent(body.input);
  const instructions = typeof body.instructions === "string" ? body.instructions : "";
  return [instructions, inputText].filter(Boolean).join("\n\n");
}

function extractResponse(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const body = value as { choices?: unknown; content?: unknown; output_text?: unknown; output?: unknown };
  if (typeof body.content === "string") return body.content;
  if (typeof body.output_text === "string") return body.output_text;
  if (Array.isArray(body.choices)) {
    return body.choices.map((choice) => {
      if (!choice || typeof choice !== "object") return "";
      const item = choice as { message?: { content?: unknown }; delta?: { content?: unknown } };
      return typeof item.message?.content === "string" ? item.message.content : typeof item.delta?.content === "string" ? item.delta.content : "";
    }).filter(Boolean).join("\n");
  }
  if (Array.isArray(body.output)) return body.output.map(outputItemText).filter(Boolean).join("\n");
  return "";
}

function extractError(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const body = value as { detail?: unknown; error?: { message?: unknown } };
  if (typeof body.detail === "string") return `ERROR: ${body.detail}`;
  if (typeof body.error?.message === "string") return `ERROR: ${body.error.message}`;
  return `ERROR: ${JSON.stringify(value)}`;
}

function isRole(value: unknown, role: string) {
  return !!value && typeof value === "object" && (value as { role?: unknown }).role === role;
}

function messageContent(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  return contentText((value as { content?: unknown }).content);
}

function inputContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    const record = item as { content?: unknown; role?: unknown };
    const prefix = typeof record.role === "string" ? `${record.role}: ` : "";
    return `${prefix}${contentText(record.content)}`;
  }).filter(Boolean).join("\n");
}

function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return value == null ? "" : String(value);
  return value.map((part) => {
    if (typeof part === "string") return part;
    if (!part || typeof part !== "object") return "";
    const record = part as { text?: unknown; content?: unknown };
    if (typeof record.text === "string") return record.text;
    if (typeof record.content === "string") return record.content;
    return "";
  }).join("");
}

function outputItemText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const content = (value as { content?: unknown }).content;
  return Array.isArray(content) ? content.map((part) => contentText([part])).join("") : "";
}

function truncate(value: string, max: number) {
  if (!Number.isFinite(max) || value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}
