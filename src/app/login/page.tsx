"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

type OAuthProviderName = "google" | "github" | "facebook" | "twitter" | "microsoft";

const oauthProviders: { name: OAuthProviderName; label: string; bg: string; text: string }[] = [
  { name: "google", label: "Google", bg: "bg-white hover:bg-zinc-100", text: "text-zinc-900" },
  { name: "github", label: "GitHub", bg: "bg-zinc-800 hover:bg-zinc-700", text: "text-white" },
  { name: "facebook", label: "Facebook", bg: "bg-[#1877F2] hover:bg-[#166FE5]", text: "text-white" },
  { name: "twitter", label: "X / Twitter", bg: "bg-zinc-900 hover:bg-zinc-800", text: "text-white" },
  { name: "microsoft", label: "Microsoft", bg: "bg-[#2F2F2F] hover:bg-[#3B3B3B]", text: "text-white" },
];

export default function LoginPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (!user.username) {
        router.replace("/onboarding");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, loading, router]);

  async function handleSignIn(provider: OAuthProviderName) {
    setError(null);
    setSigningIn(true);
    try {
      const { signInWith } = await import("@/lib/firebase");
      await signInWith(provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed. Try again.";
      if (!message.includes("popup-closed-by-user")) {
        setError(message);
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function handleDevSignIn() {
    setSigningIn(true);
    await refreshUser();
    setSigningIn(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060608]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060608] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-fuchsia-400">linkqt</span>
            <span className="text-zinc-500">.me</span>
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            Describe your vibe. Get a beautiful link page.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0f] p-6">
          <p className="mb-5 text-center text-sm font-semibold text-zinc-300">
            Sign in to get started
          </p>

          {IS_DEV_MODE ? (
            <button
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-400 disabled:opacity-50"
              disabled={signingIn}
              onClick={handleDevSignIn}
              type="button"
            >
              {signingIn ? "Signing in..." : "Continue as Dev User"}
            </button>
          ) : (
            <div className="grid gap-3">
              {oauthProviders.map((provider) => (
                <button
                  key={provider.name}
                  className={`flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${provider.bg} ${provider.text}`}
                  disabled={signingIn}
                  onClick={() => handleSignIn(provider.name)}
                  type="button"
                >
                  Continue with {provider.label}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-red-400/10 px-3 py-2 text-center text-xs text-red-300">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-zinc-600">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
