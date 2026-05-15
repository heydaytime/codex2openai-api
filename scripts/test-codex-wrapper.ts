const baseUrl = process.env.CODEX_WRAPPER_URL ?? "http://localhost:4010";
const model = process.env.CODEX_TEST_MODEL ?? "gpt-5.5";

async function main() {
  const models = await fetch(`${baseUrl}/v1/models`).then((r) => r.json());
  console.log("models", Array.isArray(models.data) ? models.data.map((m: { id: string }) => m.id).slice(0, 8) : models);

  const nonStreaming = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: "You are a test responder. Reply with exactly: pong" },
        { role: "user", content: "ping" },
      ],
    }),
  });
  const nonStreamingJson = await nonStreaming.json();
  console.log("non_streaming", nonStreaming.status, nonStreamingJson.choices?.[0]?.message?.content ?? nonStreamingJson);
  if (!nonStreaming.ok) throw new Error(`Non-streaming request failed with ${nonStreaming.status}`);

  const streaming = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: "You are a test responder. Reply with exactly: stream-pong" },
        { role: "user", content: "stream ping" },
      ],
    }),
  });

  let text = "";
  if (streaming.body) {
    const decoder = new TextDecoder();
    for await (const chunk of streaming.body) {
      const value = decoder.decode(chunk);
      for (const block of value.split("\n\n")) {
        const line = block.split(/\r?\n/).find((l) => l.startsWith("data:"));
        const data = line?.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const parsed = JSON.parse(data);
        text += parsed.choices?.[0]?.delta?.content ?? "";
      }
    }
  }
  console.log("streaming", streaming.status, text);
  if (!streaming.ok) throw new Error(`Streaming request failed with ${streaming.status}`);
  if (!text.trim()) throw new Error("Streaming request returned no text.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
