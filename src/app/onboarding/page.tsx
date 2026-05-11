"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";

export default function OnboardingPage() {
  const { user, token, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user?.username) router.replace("/dashboard");
  }, [user, loading, router]);

  const checkAvailability = useCallback(
    async (value: string) => {
      if (!token) return;
      const clean = value.toLowerCase().trim();
      if (clean.length < 3) {
        setAvailability("invalid");
        return;
      }
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(clean) && clean.length >= 3) {
        setAvailability("invalid");
        return;
      }

      setAvailability("checking");
      try {
        const data = await apiGet(`/api/user/check-username?username=${encodeURIComponent(clean)}`, token);
        setAvailability(data.available ? "available" : "taken");
      } catch {
        setAvailability("idle");
      }
    },
    [token]
  );

  function handleChange(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
    setUsername(cleaned);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (cleaned.length < 3) {
      setAvailability(cleaned.length > 0 ? "invalid" : "idle");
      return;
    }

    debounceRef.current = setTimeout(() => checkAvailability(cleaned), 400);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || availability !== "available") return;

    setSubmitting(true);
    setError(null);

    try {
      const data = await apiPost("/api/user/claim-username", { username }, token);
      if (data.ok) {
        await refreshUser();
        router.replace("/dashboard");
      } else {
        setError(data.error || "Could not claim username.");
        setAvailability("taken");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060608]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060608] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-fuchsia-400">linkqt</span>
            <span className="text-zinc-500">.me</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Choose your username</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0f] p-6">
          <h2 className="mb-2 text-lg font-bold text-white">Pick your URL</h2>
          <p className="mb-6 text-sm text-zinc-500">
            This will be your permanent link page address. Choose wisely &mdash; it can&apos;t be changed later.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-2 flex items-center rounded-xl border border-white/10 bg-black/40 px-4 py-3 ring-fuchsia-400/40 focus-within:ring-2">
              <span className="shrink-0 text-sm font-semibold text-zinc-500">linkqt.me/</span>
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600"
                maxLength={30}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="yourname"
                value={username}
              />
            </div>

            <div className="mb-5 h-5">
              {availability === "checking" && (
                <p className="text-xs text-zinc-500">Checking availability...</p>
              )}
              {availability === "available" && (
                <p className="text-xs font-semibold text-emerald-400">
                  linkqt.me/{username} is available!
                </p>
              )}
              {availability === "taken" && (
                <p className="text-xs font-semibold text-red-400">That username is taken.</p>
              )}
              {availability === "invalid" && username.length > 0 && (
                <p className="text-xs text-amber-400">
                  3-30 chars, lowercase letters, numbers, and hyphens. Must start and end with a letter or number.
                </p>
              )}
            </div>

            {error && (
              <p className="mb-4 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              className="w-full rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-black text-white transition hover:bg-fuchsia-400 disabled:opacity-40 disabled:hover:bg-fuchsia-500"
              disabled={availability !== "available" || submitting}
              type="submit"
            >
              {submitting ? "Claiming..." : "Claim this username"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
