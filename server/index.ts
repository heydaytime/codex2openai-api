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
  bioTreatments,
  backgroundPresets,
  featuredStyles,
  fontPresets,
  layoutPresets,
  linkFills,
  linkShapes,
  moods,
  paddingPresets,
  shadowPresets,
  sizePresets,
  spacingPresets,
  sceneEasings,
  sceneElementKinds,
  surfacePresets,
  textPresets,
  titleTreatments,
  widthPresets,
  type AiEditResponse,
  type AiToolCall,
  type PageConfig
} from "../src/lib/page-config";
import { presetTools, type PresetSearchResult } from "../src/lib/preset-tools";
import { searchPresetEmbeddings } from "./preset-embedding-db";
import { log, createRequestId } from "./logger";
import { checkRateLimit } from "./rate-limit";
import { getDb } from "./db";

const PORT = Number(process.env.PORT ?? 4000);
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:e2b";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 30_000);
const MAX_AI_REQUESTS = 2;
const MAX_EXECUTION_ATTEMPTS = integerEnv("MAX_EXECUTION_ATTEMPTS", 1, 1, 4);
const MAX_FUZZ_ATTEMPTS = integerEnv("MAX_FUZZ_ATTEMPTS", 1, 1, 3);
const OLLAMA_MAX_RETRIES = integerEnv("OLLAMA_MAX_RETRIES", 1, 1, 3);
const OLLAMA_NUM_PREDICT = integerEnv("OLLAMA_NUM_PREDICT", 1024, 256, 4096);
const SERVER_IDLE_TIMEOUT_SECONDS = integerEnv(
  "SERVER_IDLE_TIMEOUT_SECONDS",
  Math.ceil(OLLAMA_TIMEOUT_MS / 1000) + 20,
  10,
  255
);
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
    stream: z.boolean().optional(),
  })
  .strict();

type StreamEvent = {
  type: "status" | "decision" | "tool" | "retry" | "done" | "error";
  label: string;
  detail?: string;
  data?: unknown;
};

type EmitStreamEvent = (event: StreamEvent) => void;

getDb()
  .then(() => log("info", "SQLite database initialized"))
  .catch((err) => log("warn", "SQLite init skipped (non-fatal)", { error: String(err) }));

const server = Bun.serve({
  port: PORT,
  idleTimeout: SERVER_IDLE_TIMEOUT_SECONDS,
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

    if (url.pathname === "/api/edit" && request.method === "POST") {
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
      const limit = checkRateLimit(clientIp);
      if (!limit.allowed) {
        log("warn", "Rate limit exceeded", { ip: clientIp });
        return json({ ok: false, error: "Rate limit exceeded. Try again shortly." }, 429);
      }
      return handleEdit(request);
    }

    return json({ ok: false, error: "Not found" }, 404);
  }
});

log("info", "Server started", {
  port: server.port,
  model: OLLAMA_MODEL,
  embedModel: OLLAMA_EMBED_MODEL,
  corsOrigin: CORS_ORIGIN,
  idleTimeoutSeconds: SERVER_IDLE_TIMEOUT_SECONDS
});

async function handleEdit(request: Request) {
  const reqId = createRequestId();
  const startMs = Date.now();

  try {
    const body = await request.json();
    const { prompt, config, chatHistory, stream } = EditRequestSchema.parse(body);

    log("info", "Edit request received", { reqId, promptLength: prompt.length });

    if (stream) {
      return streamEdit(reqId, startMs, prompt, config, chatHistory ?? []);
    }

    const aiResult = await runAiToolLoop(reqId, prompt, config, chatHistory ?? []);
    const toolCalls = dedupeToolCalls(aiResult.toolCalls);

    log("info", "Edit request complete", {
      reqId,
      durationMs: Date.now() - startMs,
      toolCallCount: toolCalls.length,
      retries: aiResult.totalRetries,
      skippedPresetSearch: aiResult.skippedPresetSearch
    });

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
    log("error", "Edit request failed", { reqId, error: message, durationMs: Date.now() - startMs });
    return json({ ok: false, error: message }, 400);
  }
}

function streamEdit(
  reqId: string,
  startMs: number,
  prompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[]
) {
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit: EmitStreamEvent = (event) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`${JSON.stringify({ ...event, ts: Date.now() })}\n`));
      };
      const heartbeat = setInterval(() => {
        emit({ type: "status", label: "Still working", detail: "Waiting for the local model to finish." });
      }, 5_000);

      try {
        emit({ type: "status", label: "Received request", detail: "Preparing current page context." });
        const aiResult = await runAiToolLoop(reqId, prompt, config, chatHistory, emit);
        const toolCalls = dedupeToolCalls(aiResult.toolCalls);
        const payload = {
          ok: true,
          ai: { message: aiResult.message, tool_calls: toolCalls },
          config: aiResult.config,
          flow: aiResult.flow,
          aiRequests: aiResult.aiRequests,
          maxAiRequests: MAX_AI_REQUESTS,
          totalRetries: aiResult.totalRetries
        };

        log("info", "Streaming edit request complete", {
          reqId,
          durationMs: Date.now() - startMs,
          toolCallCount: toolCalls.length,
          retries: aiResult.totalRetries,
          skippedPresetSearch: aiResult.skippedPresetSearch
        });

        emit({ type: "done", label: "Applied changes", detail: `${toolCalls.length} tool calls applied.`, data: payload });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        log("error", "Streaming edit request failed", { reqId, error: message, durationMs: Date.now() - startMs });
        emit({ type: "error", label: "Edit failed", detail: message });
      } finally {
        closed = true;
        clearInterval(heartbeat);
        controller.close();
      }
    }
  });

  return cors(new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no"
    }
  }));
}

function shouldSkipPresetSearch(prompt: string): boolean {
  const lower = prompt.toLowerCase().trim();
  if (/^(reset|undo|start\s*over|go\s*back|clear)\b/.test(lower)) return true;
  if (/^(change|set|update|edit|rewrite)\s+(my\s+|the\s+)?bio\b/.test(lower)) return true;
  if (/^(change|set)\s+(the\s+)?(spacing|alignment|width)\s+to\b/.test(lower)) return true;
  return false;
}

function buildFastEdit(prompt: string, config: PageConfig): AiEditResponse | null {
  const lower = prompt.toLowerCase();
  const wantsWarm = /\b(warm|warmer|cozy|sunset|gold|orange|cream)\b/.test(lower);
  const wantsPop = /\b(pop|stand\s*out|highlight|feature|featured|glow|bigger|larger|promote)\b/.test(lower);
  const targetLink = findMentionedLink(lower, config);

  if (!wantsWarm && !(wantsPop && targetLink)) return null;

  const tool_calls: AiEditResponse["tool_calls"] = [];

  if (wantsWarm) {
    tool_calls.push(
      { tool: "change_background", args: { preset: "warm-gradient" } },
      { tool: "change_theme", args: { mood: "warm", accent: "orange", surface: "paper", text: "dark" } },
      { tool: "change_typography", args: { font: "rounded", text: "dark" } }
    );
  }

  if (wantsPop || wantsWarm) {
    tool_calls.push({
      tool: "change_link_appearance",
      args: { shape: "pill", fill: "soft", size: wantsPop ? "lg" : "md", shadow: "glow", animation: "pulse-featured" }
    });
  }

  if (targetLink && wantsPop) {
    tool_calls.push({ tool: "feature_link", args: { id: targetLink.id, style: "glow" } });
    tool_calls.push({ tool: "change_individual_link_style", args: { id: targetLink.id, size: "lg", shadow: "glow", animation: "pulse-featured", font: "bold" } });
    tool_calls.push({ tool: "reorder_links", args: { order: [targetLink.id] } });
  }

  tool_calls.push({
    tool: "validate_result",
    args: { checklist: ["Applied deterministic visual changes", "Kept link data unchanged"] }
  });

  return {
    message: targetLink
      ? `Made ${targetLink.label} pop and shifted the page warmer.`
      : "Shifted the page to a warmer, more inviting style.",
    tool_calls
  };
}

function findMentionedLink(prompt: string, config: PageConfig) {
  return config.links.find((link) => {
    const label = link.label.toLowerCase();
    return prompt.includes(link.id.toLowerCase()) || prompt.includes(label) || (link.kind === "shop" && /\b(merch|shop|store|product|drop)\b/.test(prompt));
  });
}

function describePlannedTool(toolCall: AiEditResponse["tool_calls"][number]) {
  switch (toolCall.tool) {
    case "fuzz_find":
      return `Search presets: ${toolCall.args.queries.join("; ")}`;
    case "apply_preset":
      return `Apply preset ${toolCall.args.id}.`;
    case "change_background":
      return toolCall.args.preset ? `Set background to ${toolCall.args.preset}.` : "Set a custom gradient background.";
    case "change_theme":
      return `Change theme: ${Object.entries(toolCall.args).map(([key, value]) => `${key}=${value}`).join(", ")}.`;
    case "change_typography":
      return `Change typography: ${Object.entries(toolCall.args).map(([key, value]) => `${key}=${value}`).join(", ")}.`;
    case "change_layout":
      return `Change layout: ${Object.entries(toolCall.args).map(([key, value]) => `${key}=${value}`).join(", ")}.`;
    case "change_profile":
      return `Update profile: ${Object.entries(toolCall.args).map(([key, value]) => `${key}=${value}`).join(", ")}.`;
    case "change_link_appearance":
      return `Change link style: ${Object.entries(toolCall.args).map(([key, value]) => `${key}=${value}`).join(", ")}.`;
    case "change_individual_link_style":
      return `Change one link style: ${Object.entries(toolCall.args).map(([key, value]) => `${key}=${value}`).join(", ")}.`;
    case "change_creative_layer":
      return `${toolCall.args.enabled ? "Enable" : "Disable"} creative layer with ${toolCall.args.elements.length} elements.`;
    case "feature_link":
      return `Feature link ${toolCall.args.id}${toolCall.args.style ? ` with ${toolCall.args.style}` : ""}.`;
    case "reorder_links":
      return `Reorder links: ${toolCall.args.order.join(", ")}.`;
    case "reset_page":
      return "Reset visual settings to defaults.";
    case "validate_result":
      return `Validate: ${toolCall.args.checklist.join("; ")}`;
  }
}

function buildPresetFallbackEdit(prompt: string, config: PageConfig, presetResults: PresetSearchResult[]): AiEditResponse {
  const lower = prompt.toLowerCase();
  const toolCalls: AiToolCall[] = [];

  for (const preset of presetResults.slice(0, 2)) {
    toolCalls.push({ tool: "apply_preset", args: { id: preset.id } });
  }

  const targetLink = findMentionedLink(lower, config);
  const wantsPop = /\b(pop|stand\s*out|highlight|feature|featured|glow|bigger|larger|promote|push|sell|buy|book|ticket|subscribe|join)\b/.test(lower);
  if (targetLink && wantsPop) {
    toolCalls.push(
      { tool: "feature_link", args: { id: targetLink.id, style: "glow" } },
      { tool: "change_individual_link_style", args: { id: targetLink.id, size: "lg", shadow: "glow", animation: "pulse-featured", font: "bold" } },
      { tool: "reorder_links", args: { order: [targetLink.id] } }
    );
  }

  if (/\b(title|heading|name)\b.*\b(stylish|stretch|wide|poster|banner|bold|dramatic)\b|\b(stylish|stretch|wide|poster|banner|bold|dramatic)\b.*\b(title|heading|name)\b/.test(lower)) {
    toolCalls.push({ tool: "change_profile", args: { titleFont: "display", titleTreatment: "wide" } });
  }

  if (/\b(description|bio)\b.*\b(card|box|highlight|stylish|serif|editorial)\b/.test(lower)) {
    toolCalls.push({ tool: "change_profile", args: { bioFont: "serif", bioTreatment: "card" } });
  }

  if (/\b(compact|tighter|less padding|fit more|smaller)\b/.test(lower)) {
    toolCalls.push({ tool: "change_layout", args: { spacing: "tight", padding: "compact" } });
  } else if (/\b(spacious|more padding|roomy|breathing room|airy)\b/.test(lower)) {
    toolCalls.push({ tool: "change_layout", args: { spacing: "airy", padding: "roomy" } });
  }

  if (/\b(left align|align left|left-aligned)\b/.test(lower)) {
    toolCalls.push({ tool: "change_layout", args: { alignment: "left" } });
  } else if (/\b(center|centered|align center)\b/.test(lower)) {
    toolCalls.push({ tool: "change_layout", args: { alignment: "center" } });
  }

  if (toolCalls.length === 0) {
    toolCalls.push({ tool: "change_theme", args: { mood: "clean", accent: "blue", surface: "paper", text: "dark" } });
  }

  toolCalls.push({
    tool: "validate_result",
    args: { checklist: ["Used deterministic fallback after model failure", "Applied best fuzzy preset matches", "Kept user links and URLs intact"] }
  });

  return {
    message: "The model failed to return valid JSON, so I applied the best fuzzy preset matches directly.",
    tool_calls: dedupeToolCalls(toolCalls)
  };
}

function isModelGenerationFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /empty response|timed out|token budget|thinking phase|repetition loop/i.test(message);
}

async function runAiToolLoop(
  reqId: string,
  prompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[],
  emit?: EmitStreamEvent
) {
  emit?.({ type: "status", label: "Routing request", detail: "Using fast local rules to decide whether this needs the model." });
  const fastEdit = buildFastEdit(prompt, config);
  if (fastEdit) {
    log("info", "Used deterministic fast edit", { reqId, toolCallCount: fastEdit.tool_calls.length });
    emit?.({ type: "decision", label: "Using fast path", detail: "This request matches a deterministic style/link edit, so no model call is needed." });
    for (const toolCall of fastEdit.tool_calls) {
      emit?.({ type: "tool", label: toolCall.tool, detail: describePlannedTool(toolCall), data: toolCall });
    }
    const applied = applyToolCalls(config, fastEdit.tool_calls, { source: "ai", pass: 0 });

    return {
      message: fastEdit.message,
      toolCalls: fastEdit.tool_calls,
      config: applied.config,
      flow: applied.trace,
      aiRequests: 0,
      totalRetries: 0,
      skippedPresetSearch: true
    };
  }

  const skipSearch = shouldSkipPresetSearch(prompt);
  let fuzzToolCalls: z.infer<typeof FuzzFindResponseSchema>["tool_calls"] = [];
  let presetResults: PresetSearchResult[] = [];

  if (!skipSearch) {
    log("info", "Running preset search (pass 1)", { reqId });
    emit?.({ type: "status", label: "Planning preset search", detail: "Asking the model for compact search queries." });
    const fuzzResponse = await getValidatedFuzzFind(prompt, config, chatHistory, emit);
    fuzzToolCalls = fuzzResponse.tool_calls;
    const queries = fuzzResponse.tool_calls.flatMap((call) => call.args.queries);
    const requestedLimit = Math.max(...fuzzResponse.tool_calls.map((call) => call.args.limit ?? 10));
    emit?.({ type: "tool", label: "fuzz_find", detail: `Searching ${queries.length} preset query ${queries.length === 1 ? "phrase" : "phrases"}.`, data: fuzzResponse.tool_calls[0] });
    presetResults = await searchPresetEmbeddings({
      ollamaUrl: OLLAMA_URL,
      model: OLLAMA_EMBED_MODEL,
      queries,
      limit: requestedLimit
    });
    log("info", "Preset search returned results", { reqId, resultCount: presetResults.length });
    emit?.({ type: "status", label: "Preset search complete", detail: `Found ${presetResults.length} matching preset operations.` });
  } else {
    log("info", "Skipped preset search (direct request)", { reqId });
    emit?.({ type: "decision", label: "Skipping preset search", detail: "The request is direct enough to run the edit planner immediately." });
  }

  log("info", "Running execution (pass 2)", { reqId });
  emit?.({ type: "status", label: "Planning tool calls", detail: "Asking the model for safe page-edit operations." });
  const execution = await getValidatedAiEditWithRetry(prompt, config, chatHistory, presetResults, emit).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    log("warn", "Model execution failed; using deterministic preset fallback", { reqId, error: message });
    emit?.({
      type: "decision",
      label: "Using preset fallback",
      detail: "The local model failed to return valid tool JSON, so the server is applying the best fuzzy presets directly."
    });
    return { response: buildPresetFallbackEdit(prompt, config, presetResults), retries: MAX_EXECUTION_ATTEMPTS };
  });
  const response = execution.response;
  for (const toolCall of response.tool_calls) {
    emit?.({ type: "tool", label: toolCall.tool, detail: describePlannedTool(toolCall), data: toolCall });
  }
  emit?.({ type: "status", label: "Applying tools", detail: "Validating and applying the planned operations to the page config." });
  const applied = applyToolCalls(config, response.tool_calls, { source: "ai", pass: 2 });

  return {
    message: response.message,
    toolCalls: dedupeToolCalls([...fuzzToolCalls, ...response.tool_calls]),
    config: applied.config,
    flow: applied.trace,
    aiRequests: skipSearch ? 1 : MAX_AI_REQUESTS,
    totalRetries: execution.retries,
    skippedPresetSearch: skipSearch
  };
}

async function getValidatedFuzzFind(
  prompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[],
  emit?: EmitStreamEvent
): Promise<z.infer<typeof FuzzFindResponseSchema>> {
  let rawResponse: string | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_FUZZ_ATTEMPTS; attempt += 1) {
    try {
      if (rawResponse === undefined) {
        rawResponse = await callOllama(prompt, config, chatHistory, "search", [], emit);
      }
      return FuzzFindResponseSchema.parse(normalizeFuzzFindResponse(parseAiJson(rawResponse)));
    } catch (error) {
      lastError = error;
      if (attempt === MAX_FUZZ_ATTEMPTS) break;

      const errorMessage = error instanceof Error ? error.message : String(error);
      log("warn", `Fuzz-find attempt ${attempt}/${MAX_FUZZ_ATTEMPTS} failed, retrying`, { error: errorMessage });
      emit?.({ type: "retry", label: "Preset search retry", detail: errorMessage });

      if (isModelGenerationFailure(error)) {
        rawResponse = undefined;
        continue;
      }

      try {
        rawResponse = await callOllamaWithCorrection(
          prompt, config, chatHistory, "search", [], rawResponse ?? "", errorMessage, emit
        );
      } catch {
        rawResponse = undefined;
      }
    }
  }

  throw lastError;
}

async function getValidatedAiEditWithRetry(
  prompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[],
  presetResults: PresetSearchResult[],
  emit?: EmitStreamEvent
): Promise<{ response: z.infer<typeof AiEditResponseSchema>; retries: number }> {
  let lastError: unknown;
  let rawResponse: string | undefined;

  for (let attempt = 1; attempt <= MAX_EXECUTION_ATTEMPTS; attempt += 1) {
    try {
      if (rawResponse === undefined) {
        rawResponse = await callOllama(prompt, config, chatHistory, "execute", presetResults, emit);
      }
      return { response: AiEditResponseSchema.parse(parseAiJson(rawResponse)), retries: attempt - 1 };
    } catch (error) {
      lastError = error;
      if (attempt === MAX_EXECUTION_ATTEMPTS) break;

      const errorMessage = error instanceof Error ? error.message : String(error);
      log("warn", `Execution attempt ${attempt}/${MAX_EXECUTION_ATTEMPTS} failed, retrying`, { error: errorMessage });
      emit?.({ type: "retry", label: "Tool planning retry", detail: errorMessage });

      if (isModelGenerationFailure(error)) {
        rawResponse = undefined;
        continue;
      }

      try {
        rawResponse = await callOllamaWithCorrection(
          prompt, config, chatHistory, "execute", presetResults, rawResponse ?? "", errorMessage, emit
        );
      } catch (correctionError) {
        log("warn", `Correction call also failed on attempt ${attempt}`, {
          error: correctionError instanceof Error ? correctionError.message : String(correctionError)
        });
        rawResponse = undefined;
      }
    }
  }

  throw lastError;
}

async function callOllama(
  userPrompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[],
  mode: "search" | "execute",
  presetResults: PresetSearchResult[],
  emit?: EmitStreamEvent
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
    content: JSON.stringify({
      pass: mode === "search" ? 1 : 2,
      maxAiRequests: MAX_AI_REQUESTS,
      userRequest: userPrompt,
      context: buildContext(config),
      presetSearchResults: presetResults
    }, null, 2),
  });

  return fetchOllama(ollamaMessages, mode === "search" ? 0.15 : 0.15, mode, emit);
}

async function callOllamaWithCorrection(
  userPrompt: string,
  config: PageConfig,
  chatHistory: { role: string; content: string }[],
  mode: "search" | "execute",
  presetResults: PresetSearchResult[],
  failedResponse: string,
  validationError: string,
  emit?: EmitStreamEvent
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
    content: JSON.stringify({
      pass: mode === "search" ? 1 : 2,
      maxAiRequests: MAX_AI_REQUESTS,
      userRequest: userPrompt,
      context: buildContext(config),
      presetSearchResults: presetResults
    }, null, 2),
  });

  ollamaMessages.push({ role: "assistant", content: failedResponse });

  ollamaMessages.push({
    role: "user",
    content: JSON.stringify({
      correction: true,
      error: validationError,
      instruction: "Your previous response failed validation. Fix the JSON to satisfy the schema. Return only corrected JSON, same format: {\"message\":\"...\",\"tool_calls\":[...]}. Pay close attention to the error — fix the exact fields that failed."
    }),
  });

  return fetchOllama(ollamaMessages, 0.1, `${mode}-correction`, emit);
}

async function fetchOllama(
  messages: { role: string; content: string }[],
  temperature: number,
  phase: string,
  emit?: EmitStreamEvent
): Promise<string> {
  const maxRetries = OLLAMA_MAX_RETRIES;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    try {
      emit?.({ type: "status", label: "Calling model", detail: `${phase}, attempt ${attempt}/${maxRetries}` });
      const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          format: "json",
          options: {
            temperature,
            num_predict: OLLAMA_NUM_PREDICT,
            repeat_penalty: 1.3,
            repeat_last_n: 128,
          },
          messages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed (HTTP ${response.status}). Is Ollama running?`);
      }

      const payload = (await response.json()) as {
        message?: { role?: string; content?: string; thinking?: string };
        done_reason?: string;
        eval_count?: number;
      };

      if (payload.message?.content && payload.message.content.trim().length > 0) return payload.message.content;

      const thinkingJson = extractJsonFromThinking(payload.message?.thinking);
      if (thinkingJson) {
        log("warn", "Recovered JSON from thinking field (content was empty)", {
          attempt,
          doneReason: payload.done_reason,
          evalCount: payload.eval_count,
        });
        emit?.({ type: "status", label: "Recovered model output", detail: "The model put JSON in its thinking field; using the recovered safe JSON." });
        return thinkingJson;
      }

      log("warn", "Ollama returned empty content (thinking degeneration)", {
        attempt,
        maxRetries,
        willRetry: attempt < maxRetries,
        doneReason: payload.done_reason,
        evalCount: payload.eval_count,
        thinkingLength: payload.message?.thinking?.length ?? 0,
      });

      if (attempt < maxRetries) continue;

      throw new Error(
        payload.done_reason === "length"
          ? "Ollama exhausted its token budget (done_reason=length). The thinking phase may have consumed all available tokens."
          : "Ollama returned an empty response. The model's thinking phase likely degenerated into a repetition loop."
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`Ollama request timed out after ${OLLAMA_TIMEOUT_MS / 1000}s. The model may be overloaded.`);
      }
      if (attempt < maxRetries && (error as Error).message?.includes("empty response")) continue;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Ollama returned an empty response after retries.");
}

function extractJsonFromThinking(thinking: string | undefined): string | null {
  if (!thinking) return null;
  const match = thinking.match(/\{[\s\S]*"(?:message|tool_calls)"[\s\S]*\}/);
  if (!match) return null;
  try {
    JSON.parse(match[0]);
    return match[0];
  } catch {
    return null;
  }
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
  const presetSection = presetResults.length > 0
    ? `Preset tools available now:\n${presetResults.map((p) => `- apply_preset id=${p.id}: ${p.title}. ${p.description} Tags: ${p.tags.join(", ")}. Score: ${p.score}`).join("\n")}`
    : "No preset results matched. Use base tools only.";

  return `You are a strict JSON tool-call planner for linkqt.me.

Return JSON only:
{"message":"short summary","tool_calls":[{"tool":"tool_name","args":{}}]}

This is pass 2 of 2. You can now apply real visual changes.${presetResults.length > 0 ? " You may use base tools and any apply_preset id from the preset results below." : ""}

Never write HTML, CSS, Tailwind, JavaScript, markdown, URLs, or comments.
Never create, remove, rename, reorder, or edit links. You may read links and feature an existing link by id.
Never change displayName/name/slug. You may change only bio/avatar/profile size and visual design.
Use JSON numbers for numeric fields, not strings. Correct: "left": 10. Wrong: "left": "10%".
Use 1 to 16 tool calls.
Prefer apply_preset when a preset result matches the user request. You can combine 1 to 3 presets with small base-tool refinements.
If your response fails validation, you will receive the error and can fix it. Execution gets ${MAX_EXECUTION_ATTEMPTS} total attempts.

${presetSection}

Base tools and values:
${presetResults.length > 0 ? "- apply_preset id=one of the preset ids listed above only" : ""}
- change_background preset=${JSON.stringify(backgroundPresets.filter((p) => p !== "custom"))} OR css={backgroundColor?,backgroundImage?,backgroundSize?,backgroundPosition?,backgroundRepeat?}. CSS is scoped to background only. backgroundImage must be a CSS gradient or none. No URLs.
- change_theme optional mood=${JSON.stringify(moods)}, accent=${JSON.stringify(accentPresets)}, surface=${JSON.stringify(surfacePresets)}, text=${JSON.stringify(textPresets)}
- change_typography optional font=${JSON.stringify(fontPresets)}, text=${JSON.stringify(textPresets)}, textColor=hex/rgb/rgba/hsl/hsla color. This only changes text/font styling.
- change_layout optional preset=${JSON.stringify(layoutPresets)}, spacing=${JSON.stringify(spacingPresets)}, padding=${JSON.stringify(paddingPresets)}, alignment=${JSON.stringify(alignmentPresets)}, width=${JSON.stringify(widthPresets)}
- change_profile optional bio=string under 240 chars, avatarStyle=${JSON.stringify(avatarStyles)}, profileSize=${JSON.stringify(sizePresets)}, titleFont=${JSON.stringify(fontPresets)}, bioFont=${JSON.stringify(fontPresets)}, titleTreatment=${JSON.stringify(titleTreatments)}, bioTreatment=${JSON.stringify(bioTreatments)}
- change_link_appearance optional shape=${JSON.stringify(linkShapes)}, fill=${JSON.stringify(linkFills)}, size=${JSON.stringify(sizePresets)}, shadow=${JSON.stringify(shadowPresets)}, animation=${JSON.stringify(animationPresets)}
- change_individual_link_style id=existing link id, optional shape=${JSON.stringify(linkShapes)}, fill=${JSON.stringify(linkFills)}, size=${JSON.stringify(sizePresets)}, shadow=${JSON.stringify(shadowPresets)}, animation=${JSON.stringify(animationPresets)}, font=${JSON.stringify(fontPresets)}
- change_creative_layer enabled=boolean, elements=array max 18. Each element has: id lowercase-dashed, kind=${JSON.stringify(sceneElementKinds)}, content optional text/emoji max 40, color/backgroundColor hex/rgb/hsl, left/top percent -30..130, width/height percent 1..80, opacity 0..1, blur 0..24, zIndex 0..20, optional animation={durationMs 250..30000, delayMs 0..10000, easing=${JSON.stringify(sceneEasings)}, loop boolean, alternate boolean, from/to transforms}. Transform fields: x/y -200..200, scale 0..5, rotate -1080..1080, opacity 0..1.
- feature_link id=existing link id, style=${JSON.stringify(featuredStyles)}. Does NOT unfeature other links — multiple links can be featured.
- reorder_links order=array of existing link ids. Put important links first; omitted links remain after the ordered IDs.
- reset_page no args. Resets all visual properties (theme, layout, links style, creative layer, emphasis) to clean defaults. Preserves user data.
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
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" }
    })
  );
}

function cors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", CORS_ORIGIN);
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
