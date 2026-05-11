const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export function backendUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

export function wsUrl(token: string): string {
  const base = BACKEND_URL.replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}

export async function apiGet(path: string, token: string) {
  const response = await fetch(backendUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function apiPost(path: string, body: unknown, token: string) {
  const response = await fetch(backendUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return response.json();
}
