import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { presetTools, type PresetSearchResult } from "../src/lib/preset-tools";
import { log } from "./logger";

type EmbeddingRecord = {
  id: string;
  text: string;
  embedding: number[];
};

type EmbeddingDb = {
  version: 2;
  model: string;
  signature: string;
  records: EmbeddingRecord[];
};

const DB_PATH = join(process.cwd(), ".cache", "preset-embeddings.json");
const SCORE_THRESHOLD = 0.3;
const QUERY_CACHE_MAX = 200;
const OLLAMA_TIMEOUT_MS = 30_000;

let cachedDbPromise: Promise<EmbeddingDb> | undefined;
const queryEmbeddingCache = new Map<string, number[]>();

export async function searchPresetEmbeddings({
  ollamaUrl,
  model,
  queries,
  limit
}: {
  ollamaUrl: string;
  model: string;
  queries: string[];
  limit: number;
}): Promise<PresetSearchResult[]> {
  const db = await loadEmbeddingDb(ollamaUrl, model);

  const queryEmbeddings = await Promise.all(
    queries.map((q) => embedTextCached(ollamaUrl, model, q))
  );

  const scored = db.records.map((record) => {
    const maxScore = Math.max(
      ...queryEmbeddings.map((qe) => cosine(qe, record.embedding))
    );
    return { record, score: maxScore };
  });

  const deduped = deduplicateByOperations(scored);

  const results = deduped
    .filter(({ score }) => score >= SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(limit, 10));

  log("info", "Preset embedding search complete", {
    queryCount: queries.length,
    candidateCount: db.records.length,
    afterDedup: deduped.length,
    aboveThreshold: results.length
  });

  return results.map(({ record, score }) => {
    const preset = presetTools.find((tool) => tool.id === record.id);
    if (!preset) throw new Error(`Preset disappeared from registry: ${record.id}`);
    return {
      id: preset.id,
      title: preset.title,
      description: preset.description,
      tags: preset.tags,
      score: Number(score.toFixed(4))
    };
  });
}

function deduplicateByOperations(scored: { record: EmbeddingRecord; score: number }[]) {
  const best = new Map<string, { record: EmbeddingRecord; score: number }>();

  for (const entry of scored) {
    const preset = presetTools.find((p) => p.id === entry.record.id);
    if (!preset) continue;

    const opsKey = JSON.stringify(preset.operations);
    const existing = best.get(opsKey);
    if (!existing || entry.score > existing.score) {
      best.set(opsKey, entry);
    }
  }

  return Array.from(best.values());
}

async function embedTextCached(ollamaUrl: string, model: string, text: string): Promise<number[]> {
  const cacheKey = `${model}:${text}`;
  const cached = queryEmbeddingCache.get(cacheKey);
  if (cached) return cached;

  const embedding = await embedText(ollamaUrl, model, text);

  if (queryEmbeddingCache.size >= QUERY_CACHE_MAX) {
    const firstKey = queryEmbeddingCache.keys().next().value;
    if (firstKey) queryEmbeddingCache.delete(firstKey);
  }
  queryEmbeddingCache.set(cacheKey, embedding);

  return embedding;
}

async function loadEmbeddingDb(ollamaUrl: string, model: string) {
  cachedDbPromise ??= loadOrBuildEmbeddingDb(ollamaUrl, model);
  return cachedDbPromise;
}

async function loadOrBuildEmbeddingDb(ollamaUrl: string, model: string): Promise<EmbeddingDb> {
  const signature = buildSignature();

  try {
    const existing = JSON.parse(await readFile(DB_PATH, "utf8")) as EmbeddingDb;
    if (existing.version === 2 && existing.model === model && existing.signature === signature) {
      log("info", `Loaded ${existing.records.length} preset embeddings from cache`);
      return existing;
    }
    log("info", "Preset embedding cache stale, rebuilding");
  } catch {
    log("info", "No preset embedding cache found, building from scratch");
  }

  log("info", `Building preset embedding DB (${presetTools.length} presets, model: ${model})`);
  const records: EmbeddingRecord[] = [];

  for (const preset of presetTools) {
    const text = searchableText(preset);
    records.push({
      id: preset.id,
      text,
      embedding: await embedText(ollamaUrl, model, text)
    });
  }

  const db: EmbeddingDb = { version: 2, model, signature, records };
  await mkdir(dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db));
  log("info", `Wrote ${records.length} preset embeddings to cache`);
  return db;
}

async function embedText(ollamaUrl: string, model: string, text: string): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(`${ollamaUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: text }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `Ollama embedding request failed (HTTP ${response.status}). Run: ollama pull ${model}`
      );
    }

    const payload = (await response.json()) as { embeddings?: number[][]; embedding?: number[] };
    const embedding = payload.embeddings?.[0] ?? payload.embedding;
    if (!embedding?.length) throw new Error("Ollama returned an empty embedding.");
    return normalize(embedding);
  } finally {
    clearTimeout(timeout);
  }
}

function searchableText(preset: (typeof presetTools)[number]) {
  const ops = preset.operations
    .map((op) => {
      const argParts = Object.entries(op.args)
        .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join(", ");
      return `${op.tool}(${argParts})`;
    })
    .join(". ");
  return `${preset.title}. ${preset.description} Operations: ${ops}. Tags: ${preset.tags.join(", ")}`;
}

function buildSignature() {
  return String(hash(presetTools.map(searchableText).join("\n---\n")));
}

function normalize(vector: number[]) {
  const length = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / length);
}

function cosine(a: number[], b: number[]) {
  return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
