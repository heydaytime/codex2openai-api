const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:e2b";
const DATABASE_URL = process.env.DATABASE_URL ?? `postgres://${process.env.USER}@localhost:5432/linkqt`;
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const BACKEND_PORT = process.env.PORT ?? "4000";

type ChildProcess = ReturnType<typeof Bun.spawn>;

const children: ChildProcess[] = [];

async function main() {
  console.log("┌─────────────────────────────────────────┐");
  console.log("│  linkqt.me — local dev (auth bypassed)  │");
  console.log("└─────────────────────────────────────────┘\n");

  await checkRedis();
  await checkPostgres();
  await ensureOllamaRunning();
  await ensureModelInstalled();

  startProcess("backend", ["bun", "run", "server/index.ts"], {
    PORT: BACKEND_PORT,
    OLLAMA_URL,
    OLLAMA_MODEL,
    DATABASE_URL,
    REDIS_URL,
    DEV_MODE: "true",
    CORS_ORIGIN: "http://localhost:3000",
  });

  await waitFor(async () => {
    try {
      const r = await fetch(`http://localhost:${BACKEND_PORT}/health`);
      return r.ok;
    } catch { return false; }
  }, 10_000);

  startProcess("frontend", ["bun", "run", "dev"], {
    NEXT_PUBLIC_BACKEND_URL: `http://localhost:${BACKEND_PORT}`,
    NEXT_PUBLIC_DEV_MODE: "true",
  });

  console.log("\n  Ready:");
  console.log("  ├─ Frontend:  http://localhost:3000");
  console.log("  ├─ Editor:    http://localhost:3000/dashboard");
  console.log("  ├─ Dev page:  http://localhost:3000/dev");
  console.log(`  ├─ Backend:   http://localhost:${BACKEND_PORT}/health`);
  console.log(`  ├─ Ollama:    ${OLLAMA_URL} (${OLLAMA_MODEL})`);
  console.log(`  ├─ Postgres:  ${DATABASE_URL}`);
  console.log(`  └─ Redis:     ${REDIS_URL}`);
  console.log("\n  Auth is BYPASSED — dev user is auto-provisioned.");
  console.log("  Press Ctrl-C to stop everything.\n");
}

async function checkRedis() {
  try {
    const net = await import("node:net");
    const url = new URL(REDIS_URL);
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: url.hostname, port: Number(url.port || 6379) }, () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", reject);
      socket.setTimeout(2000, () => { socket.destroy(); reject(new Error("timeout")); });
    });
    console.log("✓ Redis is running");
  } catch {
    throw new Error("Redis is not running. Start it with: redis-server");
  }
}

async function checkPostgres() {
  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 5 });
    await sql`SELECT 1`;
    await sql.end();
    console.log("✓ PostgreSQL is running");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      console.log("  Creating database 'linkqt'...");
      const postgres = (await import("postgres")).default;
      const adminUrl = DATABASE_URL.replace(/\/linkqt$/, "/postgres");
      const adminSql = postgres(adminUrl, { max: 1, connect_timeout: 5 });
      await adminSql`CREATE DATABASE linkqt`;
      await adminSql.end();
      console.log("✓ PostgreSQL database created");
    } else {
      throw new Error(`PostgreSQL is not running or not reachable.\n  URL: ${DATABASE_URL}\n  Error: ${msg}\n  Start it with: brew services start postgresql@16`);
    }
  }
}

async function ensureOllamaRunning() {
  if (await ollamaResponds()) {
    console.log("✓ Ollama is running");
    return;
  }

  console.log("  Starting Ollama...");
  startProcess("ollama", ["ollama", "serve"]);

  const started = await waitFor(async () => ollamaResponds(), 20_000);
  if (!started) {
    throw new Error("Ollama did not become ready. Try running `ollama serve` manually.");
  }
  console.log("✓ Ollama started");
}

async function ensureModelInstalled() {
  const response = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!response.ok) {
    throw new Error(`Could not read Ollama models. HTTP ${response.status}`);
  }

  const data = (await response.json()) as { models?: Array<{ name?: string }> };
  const hasModel = data.models?.some((model) => model.name === OLLAMA_MODEL);

  if (hasModel) {
    console.log(`✓ Ollama model: ${OLLAMA_MODEL}`);
    return;
  }

  console.log(`  Pulling missing Ollama model: ${OLLAMA_MODEL}`);
  const pull = Bun.spawn(["ollama", "pull", OLLAMA_MODEL], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const exitCode = await pull.exited;
  if (exitCode !== 0) {
    throw new Error(`Failed to pull Ollama model: ${OLLAMA_MODEL}`);
  }
}

async function ollamaResponds() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

function startProcess(name: string, command: string[], env: Record<string, string> = {}) {
  const child = Bun.spawn(command, {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });

  children.push(child);

  child.exited.then((exitCode) => {
    if (exitCode !== 0 && !shuttingDown) {
      console.error(`[${name}] exited with code ${exitCode}. Stopping...`);
      shutdown(exitCode);
    }
  });

  return child;
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) return true;
    await Bun.sleep(500);
  }

  return false;
}

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    try {
      child.kill();
    } catch {
      // Process may already be gone.
    }
  }

  setTimeout(() => process.exit(exitCode), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error("\n✗", error instanceof Error ? error.message : error);
  shutdown(1);
});
