# Codex OpenAPI Wrapper

OpenAI-compatible local API server backed by your existing Codex ChatGPT login.

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

## Test

In another terminal:

```bash
bun run codex:test
```

Expected output looks like:

```txt
models [ "gpt-5.5", "gpt-5.4" ]
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
- `max_tokens`
- `max_completion_tokens`
- `reasoning_effort`
- basic `response_format`
- passthrough `tools` / `tool_choice`

The wrapper transforms chat-completions messages into a Codex Responses API request.

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
CODEX_MODELS="gpt-5.5,gpt-5.4" bun run codex:wrapper
```

Configure the default model:

```bash
CODEX_DEFAULT_MODEL="gpt-5.5" bun run codex:wrapper
```

Known working model from manual smoke test:

- `gpt-5.5`

Known available fallback from manual smoke test:

- `gpt-5.4`

Some Codex-branded models can be rejected by ChatGPT-account auth depending on account entitlements. If a model is rejected, the wrapper returns the upstream Codex error.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `CODEX_WRAPPER_PORT` | `4010` | Local wrapper port. |
| `CODEX_BASE_URL` | `https://chatgpt.com/backend-api/codex` | Codex backend base URL. |
| `CODEX_DEFAULT_MODEL` | `gpt-5.5` | Default model when request omits `model`. |
| `CODEX_MODELS` | `gpt-5.5,gpt-5.4` | Comma-separated list exposed by `/v1/models`. |
| `CODEX_AUTH_FILE` | `~/.codex/auth.json` | Codex auth file path. |
| `CODEX_REFRESH_TOKEN_URL` | `https://auth.openai.com/oauth/token` | OAuth refresh endpoint override. |
| `CODEX_TEST_MODEL` | `gpt-5.5` | Model used by `bun run codex:test`. |
| `CODEX_WRAPPER_URL` | `http://localhost:4010` | Test script target URL. |

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
bun run codex:wrapper  # start server
bun run codex:test     # smoke-test models, non-streaming, and streaming
bun run typecheck      # TypeScript check
```

## Limitations

- `/v1/models` returns the configured model list if upstream model discovery is unavailable.
- `usage` is currently returned as `null` for chat completions.
- Advanced OpenAI SDK edge cases may need additional response-shape normalization.
- Tool calls are passed through to Responses format, but exhaustive OpenAI tool-call compatibility should be tested with your target client.

## Project Layout

```txt
server/codex-auth.ts             Codex auth loading and token refresh
server/codex-openai-wrapper.ts   OpenAI-compatible HTTP server
scripts/test-codex-wrapper.ts    Manual smoke test
```
