# linkqt.me

`linkqt.me` is an AI-powered Linktree-style page builder. Users add their links, edit profile content, preview the page live, and use either natural-language AI edits or manual controls to mutate a validated page configuration.

The core architecture is intentionally constrained: the AI and manual controls edit structured JSON tool calls, not application source code.

## Current Architecture

This repository contains the production-oriented app stack:

- Next.js frontend with Tailwind.
- Bun backend at `server/index.ts`.
- Firebase OAuth authentication.
- Username claiming and public pages at `/:slug`.
- PostgreSQL persistence for users, published pages, image bytes, chat history, and AI usage.
- Redis-backed draft state so edits remain private until publish.
- Local Ollama integration using `gemma4:e2b` by default.
- Local embedding search using `nomic-embed-text`.
- Live preview rendered from a validated `PageConfig`.
- AI streaming activity timeline, including status, routing decisions, retries, tool calls, and fallback events.
- Manual controls that call the same backend tool-application endpoint as the AI.
- Profile image upload with client-side square crop before saving image bytes through the backend.

The backend is the source of truth for validated drafts. Public pages read only from the published PostgreSQL config.

## Running Locally

Install dependencies:

```bash
bun install
```

Start frontend and backend together:

```bash
bun run dev:all
```

`dev:all` expects local Redis and PostgreSQL to be reachable, starts Ollama if needed, then runs the backend in `DEV_MODE` with auth bypassed.

Or run them separately:

```bash
DEV_MODE=true DATABASE_URL=postgres://$USER@localhost:5432/linkqt REDIS_URL=redis://localhost:6379 bun run backend
NEXT_PUBLIC_DEV_MODE=true NEXT_PUBLIC_BACKEND_URL=http://localhost:4000 bun run dev
```

Then open `http://localhost:3000`. In dev mode, sign in with the "Continue as Dev User" button, claim a username, then use `/dashboard`.

Make sure Redis and PostgreSQL are running locally:

```bash
redis-server
brew services start postgresql@16
createdb linkqt || true
```

Make sure Ollama is running and the required models exist locally:

```bash
ollama serve
ollama pull gemma4:e2b
ollama pull nomic-embed-text
```

Useful endpoints:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:4000/health`
- AI edit stream: `ws://localhost:4000/ws?token=<firebase-id-token>`
- Manual tool API: `POST http://localhost:4000/api/apply-tools`
- Draft API: `GET/POST http://localhost:4000/api/page/draft`
- Publish API: `POST http://localhost:4000/api/page/publish`
- Public page API: `GET http://localhost:4000/api/page/published/:slug`

## Backend Defaults

```txt
PORT=4000
DATABASE_URL=postgres://linkqt:linkqt@localhost:5432/linkqt
REDIS_URL=redis://localhost:6379
FIREBASE_PROJECT_ID=your-firebase-project-id
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e2b
OLLAMA_EMBED_MODEL=nomic-embed-text
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
OLLAMA_TIMEOUT_MS=30000
SERVER_IDLE_TIMEOUT_SECONDS=50
MAX_EXECUTION_ATTEMPTS=1
MAX_FUZZ_ATTEMPTS=1
OLLAMA_MAX_RETRIES=1
OLLAMA_NUM_PREDICT=1024
RATE_LIMIT_MAX=20
RATE_LIMIT_WINDOW_MS=60000
```

The low retry defaults are deliberate. The current local model can return empty content after spending its budget in the thinking field, so the backend avoids retry storms and falls back to deterministic preset application when needed.

## AI Flow

The AI path is designed to survive weak local model behavior.

1. The server first checks fast local rules for obvious requests such as “make merch pop” or “make it warmer.”
2. If matched, the server emits deterministic tool calls without invoking Ollama.
3. Otherwise, pass 1 asks Ollama only for `fuzz_find` queries.
4. The backend searches a local embedding database of preset operations.
5. Pass 2 asks Ollama for real edit tool calls using the fuzzy results.
6. If pass 2 fails, the server applies a deterministic fallback using the best fuzzy presets plus local heuristics.
7. Tool calls are validated with Zod, applied to the page config, and rendered by trusted React components.

The embedding cache is written to `.cache/preset-embeddings.json`. It rebuilds when the preset registry, embedding model, or embedding signature changes.

Current preset validation target:

- 216 presets.
- 216 unique operation sets.
- 0 duplicate operation groups.
- 0 invalid preset operations.

## Manual Controls

The right-side panel gives users direct control over the same tool system the AI uses.

The panel is organized as:

1. Selectable elements.
2. Element actions.
3. Profile image.
4. Edit text.
5. Add/edit links.

Selectable elements include:

- Page/background.
- Title.
- Description.
- Layout.
- All links.
- Individual links.

Element actions support two modes:

- Quick actions: curated buttons like Warm, Cyber, Clean, Make it pop, CTA button, Reset link.
- Manual: dropdown controls that map directly to backend tool calls.

Manual edits are sent to `POST /api/apply-tools`, which validates and applies the exact same tool-call schema used by AI edits.

## Profile Images

Users can upload a profile image from their computer.

Current behavior:

- Drag/drop or click upload in the Profile Image panel.
- Crop modal opens before saving.
- User can adjust zoom, horizontal position, and vertical position.
- The crop is exported as a square image, uploaded to the backend, and stored as image bytes in PostgreSQL.
- The page config stores the backend image URL, not the data URL.
- Delete profile image clears `profile.avatarUrl` through `change_profile`.

## Tool Calls

The tool system is defined in `src/lib/page-config.ts` and applied in `src/lib/apply-operations.ts`.

Current tools include:

- `fuzz_find`
- `apply_preset`
- `change_background`
- `change_theme`
- `change_typography`
- `change_layout`
- `change_profile`
- `change_link_appearance`
- `change_individual_link_style`
- `change_creative_layer`
- `feature_link`
- `reorder_links`
- `reset_element`
- `reset_page`
- `validate_result`

Important capabilities:

- Change full-page theme/background/font/surface/text.
- Change title font and title treatment.
- Change description font and treatment.
- Change layout, spacing, padding, alignment, and width.
- Change all links globally.
- Override a specific link’s shape, fill, size, shadow, animation, and font.
- Feature existing links.
- Reorder existing links.
- Reset a specific element or reset all visual state.
- Add animated creative layers through validated scene JSON.

`reset_page` resets visual state while preserving user content such as display name, bio text, link labels, URLs, IDs, and kinds.

## Creative Layer

The creative layer is a safe animated background system. The AI cannot write raw JavaScript or raw HTML. Instead, it can call `change_creative_layer` with validated scene JSON.

Safety constraints:

- Max 18 scene elements.
- Element types are limited to `emoji`, `text`, `circle`, `rectangle`, and `triangle`.
- Positions, sizes, opacity, blur, z-index, duration, and transforms are bounded.
- Content is rendered as text, not HTML.
- Animations are generated by trusted renderer code.
- No scripts, event handlers, external network resources, or raw DOM access.

## Validation

Useful checks:

```bash
bun run typecheck
bun run build
```

Preset validation can be run with a small Bun script:

```bash
bun -e '
import { presetTools } from "./src/lib/preset-tools";
import { AiToolCallSchema } from "./src/lib/page-config";
const errors = [];
const byOps = new Map();
for (const preset of presetTools) {
  for (const op of preset.operations) {
    const parsed = AiToolCallSchema.safeParse(op);
    if (!parsed.success) errors.push({ id: preset.id, error: parsed.error.issues });
  }
  const key = JSON.stringify(preset.operations);
  byOps.set(key, [...(byOps.get(key) ?? []), preset.id]);
}
const duplicateGroups = [...byOps.values()].filter((ids) => ids.length > 1);
console.log({ presets: presetTools.length, uniqueOperationSets: byOps.size, duplicateGroups: duplicateGroups.length, invalidOperationCount: errors.length });
if (errors.length || duplicateGroups.length) process.exit(1);
'
```

## Data And Persistence

`server/postgres.ts` initializes the PostgreSQL schema and owns durable app data.

`server/redis.ts` stores per-user draft configs with a TTL. Publishing copies the current validated draft into PostgreSQL.

Current tables:

- `users`
- `pages`
- `images`
- `chat_sessions`
- `ai_usage`

The public Next.js route `src/app/[slug]/page.tsx` fetches published config from `/api/page/published/:slug` with 60-second revalidation.

## Deployment

The intended production split is:

1. Frontend on Vercel.
2. Backend, PostgreSQL, Redis, and Cloudflare tunnel on the home server via `docker-compose.yml`.
3. Ollama running on the host machine outside Docker.
4. Firebase OAuth configured with the same `FIREBASE_PROJECT_ID` used by the backend verifier.

Set `NEXT_PUBLIC_BACKEND_URL` in Vercel to the Cloudflare tunnel URL and set `CORS_ORIGIN` on the backend to the Vercel origin.

## Product Direction

The recommended production model remains:

1. User creates an account.
2. User claims a username, and their public page becomes `linkqt.me/<username>`.
3. User adds links and profile content.
4. User edits through AI chat or manual controls.
5. The page remains structured validated config, not generated source code.
6. The user previews changes.
7. The user publishes when satisfied.
8. Public pages render from database config through trusted components.

## Security Notes

Important production risks to handle before launch:

- Unsafe links and redirects.
- Phishing or impersonation pages.
- Scam/adult/illegal content policy.
- XSS and CSS injection.
- User-uploaded image storage and scanning.
- Prompt injection against the AI assistant.
- Usage limits and abuse controls.

Current production gaps:

- Link URLs are not fully safety-validated yet.
- Content moderation and abuse workflows are not implemented yet.
- Production Firebase provider settings and Cloudflare tunnel config still need environment-specific setup.

## Positioning

The product should feel like:

> Describe your vibe. Get a beautiful link page.

Useful prompts include:

- Make this more professional for recruiters.
- Make this look like a rapper page.
- Prioritize my new single.
- Make this more colorful and Gen Z.
- Rewrite my bio to sound less cringe.
- Make the merch link stand out.
- Make the title feel more like a poster.

The goal is not AI-edited code. The goal is safe, fast, expressive page design through constrained configuration edits.
