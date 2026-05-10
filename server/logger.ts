type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? "info"] ?? 1;

let requestCounter = 0;

export function createRequestId() {
  requestCounter += 1;
  return `req-${Date.now()}-${requestCounter}`;
}

export function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const entry = { ts: new Date().toISOString(), level, msg: message, ...data };
  const line = JSON.stringify(entry);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
