import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const REFRESH_TOKEN_URL = "https://auth.openai.com/oauth/token";
const REFRESH_SKEW_SECONDS = 5 * 60;

type CodexAuthFile = {
  auth_mode?: string;
  OPENAI_API_KEY?: string | null;
  tokens?: {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    account_id?: string;
  };
  last_refresh?: string;
};

export type CodexAuthHeaders = {
  authorization: string;
  accountId?: string;
};

export async function getCodexAuthHeaders(): Promise<CodexAuthHeaders> {
  const authPath = process.env.CODEX_AUTH_FILE ?? join(homedir(), ".codex", "auth.json");
  const auth = JSON.parse(await readFile(authPath, "utf8")) as CodexAuthFile;

  if (auth.OPENAI_API_KEY && auth.auth_mode === "api_key") {
    return { authorization: `Bearer ${auth.OPENAI_API_KEY}` };
  }

  const tokens = auth.tokens;
  if (!tokens?.access_token) {
    throw new Error(`No Codex ChatGPT access token found in ${authPath}. Run codex login first.`);
  }

  if (shouldRefresh(tokens.access_token) && tokens.refresh_token) {
    const refreshed = await refreshCodexTokens(tokens.refresh_token);
    if (refreshed.access_token) tokens.access_token = refreshed.access_token;
    if (refreshed.id_token) tokens.id_token = refreshed.id_token;
    if (refreshed.refresh_token) tokens.refresh_token = refreshed.refresh_token;
    auth.last_refresh = new Date().toISOString();
    await writeFile(authPath, JSON.stringify(auth, null, 2));
  }

  return {
    authorization: `Bearer ${tokens.access_token}`,
    accountId: tokens.account_id,
  };
}

function shouldRefresh(jwt: string) {
  const exp = jwtExp(jwt);
  if (!exp) return false;
  return exp - Math.floor(Date.now() / 1000) <= REFRESH_SKEW_SECONDS;
}

function jwtExp(jwt: string): number | null {
  const [, payload] = jwt.split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

async function refreshCodexTokens(refreshToken: string): Promise<{
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
}> {
  const response = await fetch(process.env.CODEX_REFRESH_TOKEN_URL ?? REFRESH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Codex token refresh failed (${response.status}): ${body || response.statusText}`);
  }

  return response.json();
}
