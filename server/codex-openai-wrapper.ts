import { getCodexAuthHeaders } from "./codex-auth";

const PORT = Number(process.env.CODEX_WRAPPER_PORT ?? 4010);
const CODEX_BASE_URL = (process.env.CODEX_BASE_URL ?? "https://chatgpt.com/backend-api/codex").replace(/\/$/, "");
const DEFAULT_MODEL = process.env.CODEX_DEFAULT_MODEL ?? "gpt-5.5";
const SPARK_MODEL = "GPT-5.3-Codex-Spark";
const MODEL_ALIASES: Record<string, string> = { [SPARK_MODEL]: "gpt-5.3-codex" };
const DEFAULT_INSTRUCTIONS = process.env.CODEX_DEFAULT_INSTRUCTIONS ?? "You are a helpful local chat assistant. Answer the user's message directly and naturally.";
const CONFIGURED_MODELS = unique([
  DEFAULT_MODEL,
  ...(process.env.CODEX_MODELS?.split(",").map((value) => value.trim()).filter(Boolean) ?? ["gpt-5.5", SPARK_MODEL]),
]);

type ChatMessage = {
  role: "system" | "developer" | "user" | "assistant" | "tool";
  content?: string | Array<{ type?: string; text?: string; content?: string }> | null;
  name?: string;
  tool_call_id?: string;
};

type ChatCompletionRequest = {
  model?: string;
  messages?: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: unknown;
  reasoning_effort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  store?: boolean;
};

type ChatCompletionTool = {
  type?: string;
  function?: {
    name?: string;
    description?: string;
    parameters?: unknown;
    strict?: boolean;
  };
};

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));

    try {
      if (url.pathname === "/health") return json({ ok: true, defaultModel: DEFAULT_MODEL, codexBaseUrl: CODEX_BASE_URL });
      if (url.pathname === "/v1/models" && request.method === "GET") return handleModels();
      if (url.pathname === "/v1/responses" && request.method === "POST") return handleResponses(request);
      if (url.pathname === "/v1/chat/completions" && request.method === "POST") return handleChatCompletions(request);
      return json(openAiError("not_found", `Unknown endpoint: ${url.pathname}`), 404);
    } catch (error) {
      return json(openAiError("server_error", error instanceof Error ? error.message : "Unknown error"), 500);
    }
  },
});

console.log(`Codex OpenAI-compatible wrapper listening on http://localhost:${server.port}`);

async function handleModels() {
  const headers = await codexHeaders();
  const upstream = await fetch(`${CODEX_BASE_URL}/models`, { headers });
  if (upstream.ok) return withCors(new Response(upstream.body, { status: upstream.status, headers: cloneJsonHeaders(upstream.headers) }));

  // The Codex backend may not expose a public model-list endpoint. Keep the wrapper OpenAI-compatible.
  return json({
    object: "list",
    data: CONFIGURED_MODELS.map(model),
  });
}

async function handleResponses(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const payload = { ...body, model: upstreamModelName(body.model), store: false };
  const upstream = await fetchCodexResponses(payload);
  return withCors(new Response(upstream.body, { status: upstream.status, headers: cloneSseOrJsonHeaders(upstream.headers) }));
}

async function handleChatCompletions(request: Request) {
  const body = await request.json() as ChatCompletionRequest;
  const payload = chatToResponsesPayload(body);
  const responseModel = publicModelName(body.model);
  const upstream = await fetchCodexResponses(payload);

  if (!upstream.ok) {
    return withCors(new Response(upstream.body, { status: upstream.status, headers: cloneJsonHeaders(upstream.headers) }));
  }

  if (body.stream) return streamChatCompletion(upstream, responseModel);

  const responseText = await upstream.text();
  const parsedPayload = parseMaybeSse(responseText);
  const text = cleanAssistantText(extractTextFromResponsesPayload(parsedPayload), true);
  const toolCalls = extractToolCallsFromResponsesPayload(parsedPayload);
  return json({
    id: `chatcmpl_${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: responseModel,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: toolCalls.length > 0 && !text ? null : text,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
      },
    ],
    usage: null,
  });
}

async function fetchCodexResponses(payload: Record<string, unknown>) {
  const headers = await codexHeaders();
  headers.set("Content-Type", "application/json");
  headers.set("Accept", payload.stream === false ? "application/json, text/event-stream" : "text/event-stream");
  return fetch(`${CODEX_BASE_URL}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

async function codexHeaders() {
  const auth = await getCodexAuthHeaders();
  const headers = new Headers({
    Authorization: auth.authorization,
    version: "0.125.0",
  });
  if (auth.accountId) headers.set("ChatGPT-Account-ID", auth.accountId);
  return headers;
}

function chatToResponsesPayload(body: ChatCompletionRequest): Record<string, unknown> & { model: string } {
  const messages = body.messages ?? [];
  const instructions = messages
    .filter((message) => message.role === "system" || message.role === "developer")
    .map((message) => messageText(message.content))
    .filter(Boolean)
    .join("\n\n");

  const input = messages
    .filter((message) => message.role !== "system" && message.role !== "developer")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: [{ type: message.role === "assistant" ? "output_text" : "input_text", text: messageText(message.content) }],
    }));

  const payload: Record<string, unknown> & { model: string } = {
    model: upstreamModelName(body.model),
    instructions: instructions || DEFAULT_INSTRUCTIONS,
    input,
    stream: true,
    store: false,
  };

  const maxOutputTokens = body.max_completion_tokens ?? body.max_tokens;
  if (maxOutputTokens) payload.max_output_tokens = maxOutputTokens;
  if (body.temperature !== undefined) payload.temperature = body.temperature;
  if (body.tools) payload.tools = chatToolsToResponsesTools(body.tools);
  if (body.tool_choice) payload.tool_choice = chatToolChoiceToResponsesToolChoice(body.tool_choice);
  if (body.reasoning_effort) {
    payload.reasoning = { effort: body.reasoning_effort, summary: "auto" };
    payload.include = ["reasoning.encrypted_content"];
  }
  if (body.response_format && typeof body.response_format === "object") {
    payload.text = responseFormatToText(body.response_format);
  }

  return payload;
}

function publicModelName(modelName: unknown) {
  return typeof modelName === "string" && modelName ? modelName : DEFAULT_MODEL;
}

function upstreamModelName(modelName: unknown) {
  const requested = publicModelName(modelName);
  return MODEL_ALIASES[requested] ?? requested;
}

function chatToolsToResponsesTools(tools: unknown[]): unknown[] {
  return tools.map((tool, index) => {
    const value = tool as ChatCompletionTool;
    if (value?.type === "function" && value.function?.name) {
      return {
        type: "function",
        name: value.function.name,
        ...(value.function.description ? { description: value.function.description } : {}),
        parameters: value.function.parameters ?? { type: "object", properties: {} },
        ...(value.function.strict !== undefined ? { strict: value.function.strict } : {}),
      };
    }

    const raw = tool as Record<string, unknown> | null;
    if (raw?.type === "function" && typeof raw.name === "string") return raw;

    throw new Error(`Unsupported tool schema at tools[${index}]. Expected Chat Completions function tool or Responses function tool.`);
  });
}

function chatToolChoiceToResponsesToolChoice(toolChoice: unknown): unknown {
  if (typeof toolChoice === "string") return toolChoice;
  if (!toolChoice || typeof toolChoice !== "object") return toolChoice;

  const value = toolChoice as {
    type?: string;
    function?: { name?: string };
    name?: string;
  };

  if (value.type === "function" && value.function?.name) {
    return { type: "function", name: value.function.name };
  }

  if (value.type === "function" && value.name) return value;
  return toolChoice;
}

function responseFormatToText(responseFormat: unknown) {
  const value = responseFormat as { type?: string; json_schema?: unknown };
  if (value.type === "json_object") return { format: { type: "json_object" } };
  if (value.type === "json_schema" && value.json_schema) return { format: value.json_schema };
  return undefined;
}

function messageText(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? part.content ?? "").join("");
  }
  return String(content);
}

function streamChatCompletion(upstream: Response, modelName: string) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const id = `chatcmpl_${crypto.randomUUID()}`;
  let buffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chatChunk(id, modelName, { role: "assistant" }))}\n\n`));
      if (!upstream.body) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }

      for await (const chunk of upstream.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const data = sseData(part);
          if (!data || data === "[DONE]") continue;
          const parsed = safeJson(data);
          const delta = extractStreamingTextDelta(parsed);
          if (delta) {
            const cleaned = cleanAssistantText(delta, false);
            if (cleaned) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chatChunk(id, modelName, { content: cleaned }))}\n\n`));
          }
        }
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...chatChunk(id, modelName, {}), choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return withCors(new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  }));
}

function chatChunk(id: string, modelName: string, delta: Record<string, unknown>) {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: modelName,
    choices: [{ index: 0, delta, finish_reason: null }],
  };
}

function parseMaybeSse(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) return safeJson(trimmed);
  const events = trimmed
    .split("\n\n")
    .map(sseData)
    .filter((data): data is string => !!data && data !== "[DONE]")
    .map(safeJson);
  return events;
}

function sseData(block: string) {
  const lines = block.split(/\r?\n/);
  const dataLines = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart());
  return dataLines.join("\n").trim();
}

function safeJson(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

function extractTextFromResponsesPayload(payload: unknown): string {
  if (Array.isArray(payload)) return payload.map(extractTextDelta).join("");
  const direct = payload as { output_text?: unknown; output?: unknown } | null;
  if (typeof direct?.output_text === "string") return direct.output_text;
  if (Array.isArray(direct?.output)) return direct.output.map(extractOutputItemText).join("");
  return extractTextDelta(payload);
}

function extractToolCallsFromResponsesPayload(payload: unknown): Array<{
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}> {
  const calls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }> = [];

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    const item = value as Record<string, unknown>;
    const type = String(item.type ?? "");
    const name = typeof item.name === "string" ? item.name : undefined;
    if (type.includes("function_call") && name) {
      const callId = String(item.call_id ?? item.id ?? `call_${calls.length + 1}`);
      const rawArgs = item.arguments;
      const args = typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs ?? {});
      calls.push({
        id: callId,
        type: "function",
        function: { name, arguments: args },
      });
    }

    for (const nestedKey of ["response", "output", "item"]) {
      if (nestedKey in item) visit(item[nestedKey]);
    }
  };

  visit(payload);
  const seen = new Set<string>();
  return calls.filter((call) => {
    const key = `${call.id}:${call.function.name}:${call.function.arguments}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractTextDelta(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const value = event as Record<string, unknown>;
  if (typeof value.delta === "string") return value.delta;
  if (typeof value.text === "string" && String(value.type).includes("delta")) return value.text;
  if (value.type === "response.output_text.delta" && typeof value.delta === "string") return value.delta;
  if (value.type === "response.completed") return extractTextFromResponsesPayload(value.response);
  return "";
}

function extractStreamingTextDelta(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const value = event as Record<string, unknown>;
  if (value.type === "response.output_text.delta" && typeof value.delta === "string") return value.delta;
  if (typeof value.delta === "string" && String(value.type).includes("output_text")) return value.delta;
  return "";
}

function extractOutputItemText(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const value = item as { content?: unknown };
  if (!Array.isArray(value.content)) return "";
  return value.content.map((part) => {
    if (!part || typeof part !== "object") return "";
    const p = part as { text?: unknown };
    return typeof p.text === "string" ? p.text : "";
  }).join("");
}

function cleanAssistantText(text: string, trimLeading: boolean) {
  const cleaned = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "");
  return trimLeading ? cleaned.trimStart() : cleaned;
}

function model(id: string) {
  return { id, object: "model", created: 0, owned_by: "codex" };
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function openAiError(type: string, message: string) {
  return { error: { message, type, param: null, code: null } };
}

function json(payload: unknown, status = 200) {
  return withCors(new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } }));
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function cloneJsonHeaders(headers: Headers) {
  return new Headers({ "Content-Type": headers.get("Content-Type") ?? "application/json" });
}

function cloneSseOrJsonHeaders(headers: Headers) {
  const contentType = headers.get("Content-Type") ?? "application/json";
  return new Headers({
    "Content-Type": contentType,
    "Cache-Control": contentType.includes("text/event-stream") ? "no-cache, no-transform" : "no-cache",
  });
}
