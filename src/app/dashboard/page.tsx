"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";
import { AiEditor } from "@/components/ai-editor";
import type { PageConfig } from "@/lib/page-config";

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [initialConfig, setInitialConfig] = useState<PageConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (!loading && user && !user.username) {
      router.replace("/onboarding");
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.username || !token) return;

    apiGet("/api/page/draft", token)
      .then((data) => {
        if (data.ok && data.config) {
          setInitialConfig(data.config);
        } else {
          setLoadError("Could not load your page draft.");
        }
      })
      .catch(() => setLoadError("Failed to connect to the server."));
  }, [user, token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060608]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent" />
      </div>
    );
  }

  if (!user || !user.username) return null;

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#060608] text-white">
        <p className="text-sm text-red-400">{loadError}</p>
        <button
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
          onClick={() => window.location.reload()}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!initialConfig) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#060608]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent" />
        <p className="text-xs text-zinc-500">Loading your page...</p>
      </div>
    );
  }

  return (
    <AiEditor
      initialConfig={initialConfig}
      token={token!}
      username={user.username}
    />
  );
}
