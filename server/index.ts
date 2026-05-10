import { z } from "zod";
import { applyToolCalls, dedupeToolCalls } from "../src/lib/apply-operations";
import {
  AiEditResponseSchema,
  FuzzFindResponseSchema,
  PageConfigSchema,
  accentPresets,
  alignmentPresets,
  animationPresets,
  avatarStyles,
  backgroundPresets,
  featuredStyles,
  fontPresets,
  layoutPresets,
  linkFills,
  linkShapes,
  moods,
  shadowPresets,
  sizePresets,
  spacingPresets,
  sceneEasings,
  sceneElementKinds,
  surfacePresets,
  textPresets,
  widthPresets,
  type PageConfig
} from "../src/lib/page-config";
import { presetTools, type PresetSearchResult } from "../src/lib/preset-tools";
import { searchPresetEmbeddings } from "./preset-embedding-db";

const PORT = Number(process.env.PORT ?? 4000);
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:e2b";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const MAX_AI_REQUESTS = 2;
const MAX_EXECUTION_ATTEMPTS = integerEnv("MAX_EXECUTION_ATTEMPTS", 6, 1, 12);
const MAX_FUZZ_QUERIES = 12;

const ChatHistoryEntry = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const EditRequestSchema = z
  .object({
    prompt: z.string().min(1).max(1000),
    config: PageConfigSchema,
    chatHistory: z.array(ChatHistoryEntry).max(50).optional(),
  })
  .strict();

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (url.pathname === "/health") {
      return json({
        ok: true,
        model: OLLAMA_MODEL,
        embedModel: OLLAMA_EMBED_MODEL,
        maxExecutionAttempts: MAX_EXECUTION_ATTEMPTS
      });
    }
    if (url.pathname === "/api/edit" && request.method === "POST") return handleEdit(request);
    return json({ ok: false, error: "Not found" }, 404);
  }
});

console.log(`Bun validation server running at http://localhost:${server.port}`);
console.log(`Forwarding AI edits to ${OLLAMA_URL} with model ${OLLAMA_MODEL}`);
console.log(`Searching preset embeddings with model ${OLLAMA_EMBED_MODEL}`);

async function handleEdit(request: Request) {
  try {
    const body = await request.json();
    const { prompt, config, chatHistory } = EditRequestSchema.parse(body);

    const aiResult = await runAiToolLoop(prompt, config, chatHistory ?? []);
    const toolCalls = dedupeToolCalls(aiResult.toolCalls);

    return json({
      ok: true,
      ai: { message: aiResult.message, tool_calls: toolCalls },
      config: aiResult.config,
      flow: aiResult.flow,
      aiRequests: aiResult.aiRequests,
      maxAiRequests: MAX_AI_REQUESTS,
      totalRetries: aiResult.totalRetries
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ ok: false, error: message }, 400);
  }
}

async function runAiToolLoop(
  prompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[]
) {
  const fuzzResponse = await getValidatedFuzzFind(prompt, config, chatHistory);
  const queries = fuzzResponse.tool_calls.flatMap((call) => call.args.queries);
  const requestedLimit = Math.max(...fuzzResponse.tool_calls.map((call) => call.args.limit ?? 10));
  const presetResults = await searchPresetEmbeddings({
    ollamaUrl: OLLAMA_URL,
    model: OLLAMA_EMBED_MODEL,
    queries,
    limit: requestedLimit
  });

  const execution = await getValidatedAiEditWithRetry(prompt, config, chatHistory, presetResults);
  const response = execution.response;
  const applied = applyToolCalls(config, response.tool_calls, { source: "ai", pass: 2 });

  return {
    message: response.message,
    toolCalls: dedupeToolCalls([...fuzzResponse.tool_calls, ...response.tool_calls]),
    config: applied.config,
    flow: applied.trace,
    aiRequests: MAX_AI_REQUESTS,
    totalRetries: execution.retries
  };
}

async function getValidatedFuzzFind(
  prompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[]
): Promise<z.infer<typeof FuzzFindResponseSchema>> {
  const rawResponse = await callOllama(prompt, config, chatHistory, "search", []);

  try {
    return FuzzFindResponseSchema.parse(normalizeFuzzFindResponse(parseAiJson(rawResponse)));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const correctionResponse = await callOllamaWithCorrection(
      prompt,
      config,
      chatHistory,
      "search",
      [],
      rawResponse,
      errorMessage
    );
    return FuzzFindResponseSchema.parse(normalizeFuzzFindResponse(parseAiJson(correctionResponse)));
  }
}

async function getValidatedAiEditWithRetry(
  prompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[],
  presetResults: PresetSearchResult[]
): Promise<{ response: z.infer<typeof AiEditResponseSchema>; retries: number }> {
  let rawResponse = await callOllama(prompt, config, chatHistory, "execute", presetResults);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_EXECUTION_ATTEMPTS; attempt += 1) {
    try {
      return { response: AiEditResponseSchema.parse(parseAiJson(rawResponse)), retries: attempt - 1 };
    } catch (error) {
      lastError = error;
      if (attempt === MAX_EXECUTION_ATTEMPTS) break;

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[execute attempt ${attempt}] Validation failed, retrying with error feedback: ${errorMessage}`);
      rawResponse = await callOllamaWithCorrection(
        prompt,
        config,
        chatHistory,
        "execute",
        presetResults,
        rawResponse,
        errorMessage
      );
    }
  }

  throw lastError;
}

async function callOllama(
  userPrompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[],
  mode: "search" | "execute",
  presetResults: PresetSearchResult[]
) {
  const ollamaMessages: { role: string; content: string }[] = [
    { role: "system", content: mode === "search" ? buildSearchPrompt() : buildExecutionPrompt(presetResults) },
  ];

  const recentHistory = chatHistory.slice(-10);
  for (const entry of recentHistory) {
    ollamaMessages.push({
      role: entry.role === "assistant" ? "assistant" : "user",
      content: entry.content,
    });
  }

  ollamaMessages.push({
    role: "user",
    content: JSON.stringify(
      {
        pass: mode === "search" ? 1 : 2,
        maxAiRequests: MAX_AI_REQUESTS,
        userRequest: userPrompt,
        context: buildContext(config),
        presetSearchResults: presetResults
      },
      null,
      2
    ),
  });

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      options: { temperature: 0.15 },
      messages: ollamaMessages,
    })
  });

  if (!response.ok)
    throw new Error(`Ollama request failed with HTTP ${response.status}. Is Ollama running?`);
  const payload = (await response.json()) as { message?: { content?: string } };
  if (!payload.message?.content) throw new Error("Ollama returned an empty response.");
  return payload.message.content;
}

async function callOllamaWithCorrection(
  userPrompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[],
  mode: "search" | "execute",
  presetResults: PresetSearchResult[],
  failedResponse: string,
  validationError: string
) {
  const ollamaMessages: { role: string; content: string }[] = [
    { role: "system", content: mode === "search" ? buildSearchPrompt() : buildExecutionPrompt(presetResults) },
  ];

  const recentHistory = chatHistory.slice(-10);
  for (const entry of recentHistory) {
    ollamaMessages.push({
      role: entry.role === "assistant" ? "assistant" : "user",
      content: entry.content,
    });
  }

  ollamaMessages.push({
    role: "user",
    content: JSON.stringify(
      {
        pass: mode === "search" ? 1 : 2,
        maxAiRequests: MAX_AI_REQUESTS,
        userRequest: userPrompt,
        context: buildContext(config),
        presetSearchResults: presetResults
      },
      null,
      2
    ),
  });

  ollamaMessages.push({
    role: "assistant",
    content: failedResponse,
  });

  ollamaMessages.push({
    role: "user",
    content: JSON.stringify({
      correction: true,
      error: validationError,
      instruction: "Your previous response failed validation. Fix the JSON to satisfy the schema. Return only corrected JSON, same format: {\"message\":\"...\",\"tool_calls\":[...]}. Pay close attention to the error — fix the exact fields that failed."
    }),
  });

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      options: { temperature: 0.1 },
      messages: ollamaMessages,
    })
  });

  if (!response.ok)
    throw new Error(`Ollama correction request failed with HTTP ${response.status}.`);
  const payload = (await response.json()) as { message?: { content?: string } };
  if (!payload.message?.content) throw new Error("Ollama returned an empty correction response.");
  return payload.message.content;
}

function buildSearchPrompt() {
  return `You are the preset-search planner for linkqt.me.

Return JSON only:
{"message":"short summary","tool_calls":[{"tool":"fuzz_find","args":{"queries":["search phrase"],"limit":10}}]}

This is pass 1 of 2. You do not have visual editing tools yet. Your only job is to write excellent embedding search queries so the local preset database can find relevant preset operations.

Rules:
- Use only fuzz_find.
- Do not call change_background, change_theme, apply_preset, or any other tool in this pass.
- Return exactly one tool call.
- queries must be an array of 2 to 4 detailed natural-language search strings. Absolute maximum accepted by the server is ${MAX_FUZZ_QUERIES}; do not approach it.
- Each query should be a full phrase, not a list of single words. Put synonyms in the same query string.
- Include visual style words, mood words, object words, user intent, and likely synonyms inside those few query strings.
- For "neon cyberpunk music page and feature Spotify", use queries like "neon cyberpunk spotify music artist dj producer glowing links" and "rave techno musician page cyan fuchsia dark cyber grid".
- For vague prompts like "make it colorful" or "roll a dice", use queries like "colorful rgb random surprise bold pop neon rainbow".
- limit should usually be 10.

There are ${presetTools.length} local preset operations in the embedding database. The base tools are not part of this search. The search returns only specific preset operations.`;
}

function buildExecutionPrompt(presetResults: PresetSearchResult[]) {
  return `You are a strict JSON tool-call planner for linkqt.me.

Return JSON only:
{"message":"short summary","tool_calls":[{"tool":"tool_name","args":{}}]}

This is pass 2 of 2. You can now apply real visual changes. You may use base tools and any apply_preset id from the preset results below.

Never write HTML, CSS, Tailwind, JavaScript, markdown, URLs, or comments.
Never create, remove, rename, reorder, or edit links. You may read links and feature an existing link by id.
Never change displayName/name/slug. You may change only bio/avatar/profile size and visual design.
Use JSON numbers for numeric fields, not strings. Correct: "left": 10. Wrong: "left": "10%".
Use 1 to 12 tool calls.
Prefer apply_preset when a preset result matches the user request. You can combine 1 to 3 presets with small base-tool refinements.
If your response fails validation, you will receive the error and can fix it. Execution gets ${MAX_EXECUTION_ATTEMPTS} total attempts.

Preset tools available now:
${presetResults.map((preset) => `- apply_preset id=${preset.id}: ${preset.title}. ${preset.description} Tags: ${preset.tags.join(", ")}. Score: ${preset.score}`).join("\n")}

Base tools and values:
- apply_preset id=one of the preset ids listed above only
- change_background preset=${JSON.stringify(backgroundPresets.filter((preset) => preset !== "custom"))} OR css={backgroundColor?,backgroundImage?,backgroundSize?,backgroundPosition?,backgroundRepeat?}. CSS is scoped to background only. backgroundImage must be a CSS gradient or none. No URLs.
- change_theme optional mood=${JSON.stringify(moods)}, accent=${JSON.stringify(accentPresets)}, surface=${JSON.stringify(surfacePresets)}, text=${JSON.stringify(textPresets)}
- change_typography optional font=${JSON.stringify(fontPresets)}, text=${JSON.stringify(textPresets)}, textColor=hex/rgb/rgba/hsl/hsla color. This only changes text/font styling.
- change_layout optional preset=${JSON.stringify(layoutPresets)}, spacing=${JSON.stringify(spacingPresets)}, alignment=${JSON.stringify(alignmentPresets)}, width=${JSON.stringify(widthPresets)}
- change_profile optional bio=string under 240 chars, avatarStyle=${JSON.stringify(avatarStyles)}, profileSize=${JSON.stringify(sizePresets)}
- change_link_appearance optional shape=${JSON.stringify(linkShapes)}, fill=${JSON.stringify(linkFills)}, size=${JSON.stringify(sizePresets)}, shadow=${JSON.stringify(shadowPresets)}, animation=${JSON.stringify(animationPresets)}
- change_creative_layer enabled=boolean, elements=array max 18. Each element has: id lowercase-dashed, kind=${JSON.stringify(sceneElementKinds)}, content optional text/emoji max 40, color/backgroundColor hex/rgb/hsl, left/top percent -30..130, width/height percent 1..80, opacity 0..1, blur 0..24, zIndex 0..20, optional animation={durationMs 250..30000, delayMs 0..10000, easing=${JSON.stringify(sceneEasings)}, loop boolean, alternate boolean, from/to transforms}. Transform fields: x/y -200..200, scale 0..5, rotate -1080..1080, opacity 0..1.
- feature_link id=existing link id, style=${JSON.stringify(featuredStyles)}
- validate_result checklist=[strings]

Example:
{"message":"I made it colorful and high-energy.","tool_calls":[{"tool":"apply_preset","args":{"id":"dice-roll-rgb-chaos"}},{"tool":"validate_result","args":{"checklist":["Applied a matching preset","Kept link data unchanged"]}}]}`;
}

function buildContext(config: PageConfig) {
  return {
    links: config.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      kind: link.kind,
      featured: link.featured
    })),
    visual_state: {
      theme: config.theme,
      layout: config.layout,
      linkStyle: config.linkStyle,
      emphasis: config.emphasis,
      creativeLayer: config.creativeLayer
    },
    profile: config.profile
  };
}

function parseAiJson(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI did not return JSON.");
    return JSON.parse(match[0]);
  }
}

function normalizeFuzzFindResponse(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const response = structuredClone(value) as {
    tool_calls?: Array<{ tool?: unknown; args?: { queries?: unknown; limit?: unknown } }>;
  };

  if (!Array.isArray(response.tool_calls)) return value;

  response.tool_calls = response.tool_calls
    .filter((call) => call?.tool === "fuzz_find")
    .slice(0, 1)
    .map((call) => {
      const rawQueries = Array.isArray(call.args?.queries) ? call.args.queries : [];
      const queries = rawQueries
        .filter((query): query is string => typeof query === "string" && query.trim().length > 0)
        .map((query) => query.trim().slice(0, 160))
        .slice(0, MAX_FUZZ_QUERIES);
      return {
        tool: "fuzz_find",
        args: {
          queries,
          limit: typeof call.args?.limit === "number" ? Math.min(Math.max(Math.trunc(call.args.limit), 1), 10) : 10
        }
      };
    });

  return response;
}

function json(payload: unknown, status = 200) {
  return cors(
    new Response(JSON.stringify(payload, null, 2), {
      status,
      headers: { "Content-Type": "application/json" }
    })
  );
}

function cors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "http://localhost:3000");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function integerEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
