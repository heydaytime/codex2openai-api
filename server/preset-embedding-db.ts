import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { presetTools, type PresetSearchResult } from "../src/lib/preset-tools";

type EmbeddingRecord = {
  id: string;
  text: string;
  embedding: number[];
};

type EmbeddingDb = {
  version: 1;
  model: string;
  signature: string;
  records: EmbeddingRecord[];
};

const DB_PATH = join(process.cwd(), ".cache", "preset-embeddings.json");

let cachedDbPromise: Promise<EmbeddingDb> | undefined;

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
  const queryEmbedding = await embedText(ollamaUrl, model, queries.join(" "));

  return db.records
    .map((record) => ({ record, score: cosine(queryEmbedding, record.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .map(({ record, score }) => {
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

async function loadEmbeddingDb(ollamaUrl: string, model: string) {
  cachedDbPromise ??= loadOrBuildEmbeddingDb(ollamaUrl, model);
  return cachedDbPromise;
}

async function loadOrBuildEmbeddingDb(ollamaUrl: string, model: string): Promise<EmbeddingDb> {
  const signature = buildSignature();

  try {
    const existing = JSON.parse(await readFile(DB_PATH, "utf8")) as EmbeddingDb;
    if (existing.version === 1 && existing.model === model && existing.signature === signature) {
      console.log(`Loaded ${existing.records.length} preset embeddings from ${DB_PATH}`);
      return existing;
    }
  } catch {
    // Missing or stale DB; rebuild below.
  }

  console.log(`Building local preset embedding DB with ${presetTools.length} presets using ${model}...`);
  const records: EmbeddingRecord[] = [];
  for (const preset of presetTools) {
    records.push({
      id: preset.id,
      text: searchableText(preset),
      embedding: await embedText(ollamaUrl, model, searchableText(preset))
    });
  }

  const db: EmbeddingDb = { version: 1, model, signature, records };
  await mkdir(dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db));
  console.log(`Wrote ${records.length} preset embeddings to ${DB_PATH}`);
  return db;
}

async function embedText(ollamaUrl: string, model: string, text: string): Promise<number[]> {
  const response = await fetch(`${ollamaUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text })
  });

  if (!response.ok) {
    throw new Error(
      `Ollama embedding request failed with HTTP ${response.status}. Pull an embedding model locally, e.g. \`ollama pull ${model}\`.`
    );
  }

  const payload = (await response.json()) as { embeddings?: number[][]; embedding?: number[] };
  const embedding = payload.embeddings?.[0] ?? payload.embedding;
  if (!embedding?.length) throw new Error("Ollama returned an empty embedding.");
  return normalize(embedding);
}

function searchableText(preset: (typeof presetTools)[number]) {
  return `${preset.id}\n${preset.title}\n${preset.description}\nTags: ${preset.tags.join(", ")}`;
}

function buildSignature() {
  return String(hash(presetTools.map(searchableText).join("\n---\n")));
}

function normalize(vector: number[]) {
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / length);
}

function cosine(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
