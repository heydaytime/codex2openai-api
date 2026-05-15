export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const WRAPPER_URL = (process.env.NEXT_PUBLIC_CODEX_WRAPPER_URL ?? "http://localhost:4010").replace(/\/$/, "");

export async function fetchModels(): Promise<string[]> {
  const response = await fetch(`${WRAPPER_URL}/v1/models`);
  if (!response.ok) throw new Error(`Could not load models: ${response.status}`);
  const payload = await response.json() as { data?: Array<{ id?: string }> };
  return payload.data?.map((model) => model.id).filter((id): id is string => Boolean(id)) ?? [];
}

export async function streamChatCompletion(body: { model: string; messages: ChatMessage[] }, onDelta: (delta: string) => void) {
  const response = await fetch(`${WRAPPER_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Wrapper returned ${response.status}`);
  }
  if (!response.body) throw new Error("Wrapper did not return a stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n").trim();
      if (!data || data === "[DONE]") continue;
      const parsed = safeJson(data) as { choices?: Array<{ delta?: { content?: string } }> } | null;
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (delta) onDelta(delta);
    }
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
