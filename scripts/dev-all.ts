const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:e2b";

type ChildProcess = ReturnType<typeof Bun.spawn>;

const children: ChildProcess[] = [];

async function main() {
  console.log("Starting linkqt.me prototype...");

  await ensureOllamaRunning();
  await ensureModelInstalled();

  startProcess("backend", ["bun", "run", "backend"], {
    PORT: process.env.PORT ?? "4000",
    OLLAMA_URL,
    OLLAMA_MODEL
  });

  startProcess("frontend", ["bun", "run", "dev"]);

  console.log("\nReady:");
  console.log("- Frontend: http://localhost:3000");
  console.log("- Backend:  http://localhost:4000/health");
  console.log(`- Ollama:   ${OLLAMA_URL} (${OLLAMA_MODEL})`);
  console.log("\nPress Ctrl-C to stop everything.\n");
}

async function ensureOllamaRunning() {
  if (await ollamaResponds()) {
    console.log("Ollama is already running.");
    return;
  }

  console.log("Starting Ollama...");
  startProcess("ollama", ["ollama", "serve"]);

  const started = await waitFor(async () => ollamaResponds(), 20_000);
  if (!started) {
    throw new Error("Ollama did not become ready. Try running `ollama serve` manually.");
  }
}

async function ensureModelInstalled() {
  const response = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!response.ok) {
    throw new Error(`Could not read Ollama models. HTTP ${response.status}`);
  }

  const data = (await response.json()) as { models?: Array<{ name?: string }> };
  const hasModel = data.models?.some((model) => model.name === OLLAMA_MODEL);

  if (hasModel) {
    console.log(`Ollama model found: ${OLLAMA_MODEL}`);
    return;
  }

  console.log(`Pulling missing Ollama model: ${OLLAMA_MODEL}`);
  const pull = Bun.spawn(["ollama", "pull", OLLAMA_MODEL], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit"
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
      ...env
    }
  });

  children.push(child);

  child.exited.then((exitCode) => {
    if (exitCode !== 0 && !shuttingDown) {
      console.error(`${name} exited with code ${exitCode}. Stopping remaining processes...`);
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
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
});
