# Codex OpenAI API Wrapper

OpenAI-compatible local API server backed by your existing Codex ChatGPT login, with an optional local Next.js chat frontend.

This lets any OpenAI-compatible client talk to a local `/v1/chat/completions` or `/v1/responses` endpoint while the wrapper calls Codex internally through your local `~/.codex/auth.json` credentials.

## What It Does

- Reads your existing Codex auth from `~/.codex/auth.json`.
- Refreshes ChatGPT OAuth tokens when they are close to expiry.
- Calls the Codex backend at `https://chatgpt.com/backend-api/codex`.
- Exposes OpenAI-style local endpoints.
- Supports model selection per request.
- Exposes configurable model discovery through `GET /v1/models`.
- Supports non-streaming chat completions.
- Supports streaming chat completions using OpenAI-style SSE chunks.
- Forces `store: false` on forwarded requests.
- Sends full request context each call; the wrapper does not keep server-side conversation state.
- Includes a minimalist Next.js 16 + Tailwind v4 chat UI.
- Stores frontend chat history locally in browser SQLite on your machine.

## Requirements

- Bun installed.
- Codex CLI installed.
- You are already logged into Codex with ChatGPT auth.

Check Codex auth:

```bash
codex --version
test -f ~/.codex/auth.json && echo "Codex auth exists"
```

If needed, log in first:

```bash
codex login
```

## Install

```bash
bun install
```

## Run

```bash
bun run codex:wrapper
```

Default server:

```txt
http://localhost:4010
```

## Local Chat Frontend

Run the wrapper and frontend together:

```bash
bun run dev
```

Then open:

```txt
http://localhost:3000
```

The frontend talks directly to the wrapper over the OpenAI-compatible API:

- `GET /v1/models` for model selection.
- `POST /v1/chat/completions` with `stream: true` for chat.

No login is required in the frontend. Codex auth stays in the local wrapper process through `~/.codex/auth.json`.

### Frontend History

Chat history is stored client-side in browser SQLite using `sql.js` and IndexedDB persistence. The SQLite WASM asset is served locally from:

```txt
public/sql-wasm-browser.wasm
```

If browser SQLite cannot start, the UI falls back to `localStorage` so local chats still work.

Configure a non-default wrapper URL if needed:

```bash
NEXT_PUBLIC_CODEX_WRAPPER_URL="http://localhost:4010" bun run frontend:dev
```

## Test

In another terminal:

```bash
bun run codex:test
```

Expected output looks like:

```txt
models [ "gpt-5.5", "GPT-5.3-Codex-Spark" ]
non_streaming 200 pong
streaming 200 stream-pong
```

## Endpoints

### `GET /health`

Returns wrapper status and defaults.

```bash
curl http://localhost:4010/health
```

### `GET /v1/models`

Returns an OpenAI-compatible model list.

```bash
curl http://localhost:4010/v1/models
```

The Codex backend may not expose a stable public model-list endpoint for this auth path, so the wrapper exposes the configured local model list from `CODEX_MODELS`.

### `POST /v1/chat/completions`

OpenAI-compatible chat completions endpoint.

Supported:

- `model`
- `messages`
- `stream`
- `temperature`
- `reasoning_effort`
- basic `response_format`
- passthrough `tools` / `tool_choice`

The wrapper transforms chat-completions messages into a Codex Responses API request.

Token cap fields such as `max_tokens` and `max_completion_tokens` are accepted from OpenAI-compatible clients but intentionally ignored. The Codex upstream rejects the translated `max_output_tokens` field, so the wrapper does not forward token caps.

### `POST /v1/responses`

Responses-compatible passthrough endpoint.

The wrapper forwards your body to Codex with:

```json
{ "store": false }
```

## Non-Streaming Example

```bash
curl http://localhost:4010/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-5.5",
    "stream": false,
    "messages": [
      { "role": "system", "content": "You are concise." },
      { "role": "user", "content": "Say pong." }
    ]
  }'
```

Response shape:

```json
{
  "id": "chatcmpl_...",
  "object": "chat.completion",
  "created": 1770000000,
  "model": "gpt-5.5",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "pong" },
      "finish_reason": "stop"
    }
  ],
  "usage": null
}
```

## Streaming Example

```bash
curl -N http://localhost:4010/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-5.5",
    "stream": true,
    "messages": [
      { "role": "user", "content": "Count to three." }
    ]
  }'
```

The wrapper emits OpenAI-style SSE:

```txt
data: {"id":"chatcmpl_...","object":"chat.completion.chunk",...}

data: [DONE]
```

## Model Selection

Choose the model per request:

```json
{
  "model": "gpt-5.5",
  "messages": [{ "role": "user", "content": "Hello" }]
}
```

Configure the exposed model list:

```bash
CODEX_MODELS="gpt-5.5,GPT-5.3-Codex-Spark" bun run codex:wrapper
```

Configure the default model:

```bash
CODEX_DEFAULT_MODEL="gpt-5.5" bun run codex:wrapper
```

Known working model from manual smoke test:

- `gpt-5.5`
- `GPT-5.3-Codex-Spark`

Some Codex-branded models can be rejected by ChatGPT-account auth depending on account entitlements. If a model is rejected, the wrapper returns the upstream Codex error.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `CODEX_WRAPPER_PORT` | `4010` | Local wrapper port. |
| `CODEX_BASE_URL` | `https://chatgpt.com/backend-api/codex` | Codex backend base URL. |
| `CODEX_DEFAULT_MODEL` | `gpt-5.5` | Default model when request omits `model`. |
| `CODEX_MODELS` | `gpt-5.5,GPT-5.3-Codex-Spark` | Comma-separated list exposed by `/v1/models`. |
| `CODEX_AUTH_FILE` | `~/.codex/auth.json` | Codex auth file path. |
| `CODEX_REFRESH_TOKEN_URL` | `https://auth.openai.com/oauth/token` | OAuth refresh endpoint override. |
| `CODEX_TEST_MODEL` | `gpt-5.5` | Model used by `bun run codex:test`. |
| `CODEX_WRAPPER_URL` | `http://localhost:4010` | Test script target URL. |
| `CODEX_AUDIT_DB` | `data/codex-wrapper.sqlite` | SQLite DB file for request/response audit logs. |
| `CODEX_AUDIT_DISABLED` | unset | Set to `1` or `true` to disable audit logging. |

## Audit Logging

The wrapper stores each API call in SQLite by default. It logs request metadata, original request JSON, transformed upstream request JSON, response JSON/text, status, timing, and upstream errors.

Default DB path:

```txt
data/codex-wrapper.sqlite
```

Configure a fixed production path:

```bash
CODEX_AUDIT_DB="/home/heyday/codex2openai-api/data/codex-wrapper.sqlite" bun run codex:wrapper
```

Query recent calls:

```bash
sqlite3 data/codex-wrapper.sqlite \
  "select created_at, path, request_model, upstream_model, stream, status, duration_ms from api_calls order by created_at desc limit 20;"
```

Print recent prompts and responses in a readable format:

```bash
bun run codex:audit
```

Options:

```bash
bun run codex:audit --limit 20
bun run codex:audit --full
bun run codex:audit --db /home/heyday/codex2openai-api/data/codex-wrapper.sqlite
```

Inspect one full call:

```bash
sqlite3 data/codex-wrapper.sqlite \
  "select request_json, upstream_request_json, response_text, error_json from api_calls order by created_at desc limit 1;"
```

The audit DB can contain full prompts, responses, tool payloads, and pasted secrets. Treat it like sensitive data.

## Auth Behavior

The wrapper supports the standard Codex ChatGPT auth file shape:

```json
{
  "auth_mode": "chatgpt",
  "tokens": {
    "access_token": "...",
    "refresh_token": "...",
    "account_id": "..."
  }
}
```

It sends upstream Codex requests with:

- `Authorization: Bearer <access_token>`
- `ChatGPT-Account-ID: <account_id>` when present
- `version: 0.125.0`

The wrapper never prints tokens. Treat `~/.codex/auth.json` like a password.

## Statelessness

The wrapper does not store conversation state.

Clients should send the full conversation history on every request. This matches the behavior expected by normal OpenAI-compatible stateless clients.

Forwarded Codex requests always include:

```json
{ "store": false }
```

## Scripts

```bash
bun run dev              # start wrapper and frontend
bun run codex:wrapper    # start wrapper only
bun run frontend:dev     # start frontend only
bun run frontend:build   # build frontend
bun run codex:test       # smoke-test models, non-streaming, and streaming
bun run typecheck        # TypeScript check
```

## Limitations

- `/v1/models` returns the configured model list if upstream model discovery is unavailable.
- `max_tokens` and `max_completion_tokens` are ignored instead of forwarded because Codex upstream rejects `max_output_tokens`.
- `usage` is currently returned as `null` for chat completions.
- Advanced OpenAI SDK edge cases may need additional response-shape normalization.
- Tool calls are passed through to Responses format, but exhaustive OpenAI tool-call compatibility should be tested with your target client.

## Project Layout

```txt
server/codex-auth.ts             Codex auth loading and token refresh
server/codex-openai-wrapper.ts   OpenAI-compatible HTTP server
scripts/test-codex-wrapper.ts    Manual smoke test
app/page.tsx                     Local chat frontend
lib/openai-client.ts             Browser OpenAI-compatible streaming client
lib/client-db.ts                 Client-side SQLite chat history
```
