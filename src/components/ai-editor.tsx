"use client";

import { useCallback, useRef, useState } from "react";
import { PagePreview } from "@/components/page-preview";
import { ChatWindow } from "@/components/chat-window";
import { ToolCatalogPanel } from "@/components/tool-catalog-panel";
import { ConfigInspector } from "@/components/config-inspector";
import {
  linkKinds,
  samplePageConfig,
  type AiEditResponse,
  type AppliedToolCall,
  type PageConfig,
} from "@/lib/page-config";
import { type AiActivityEvent, type ChatMessage, type ChatHistory, makeChatId } from "@/lib/chat-types";

type ApiResponse =
  | {
      ok: true;
      ai: AiEditResponse;
      config: PageConfig;
      flow: AppliedToolCall[];
      aiRequests: number;
      maxAiRequests: number;
      totalRetries: number;
    }
  | {
      ok: false;
      error: string;
      details?: unknown;
    };

type RightTab = "tools" | "config" | "links";

const suggestions = [
  "Make this look like a clean founder page and rewrite the bio for investors.",
  "Make it feel like a neon cyberpunk music page and feature Spotify.",
  "Make my merch link pop more and switch to a warmer style.",
  "Make the page more minimal and professional for recruiters.",
  "Make the background a starry sky and make everything glow softly.",
  "Make the buttons smaller, tighter, and more compact.",
];

export function AiEditor() {
  const [config, setConfig] = useState<PageConfig>(samplePageConfig);
  const [chatMessages, setChatMessages] = useState<ChatHistory>([]);
  const chatMessagesRef = useRef<ChatHistory>([]);
  const configRef = useRef<PageConfig>(samplePageConfig);
  const liveActivityRef = useRef<AiActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [liveActivity, setLiveActivity] = useState<AiActivityEvent[]>([]);

  // Undo/redo
  const [configHistory, setConfigHistory] = useState<PageConfig[]>([samplePageConfig]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Link editing
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkKind, setNewLinkKind] =
    useState<PageConfig["links"][number]["kind"]>("website");

  // Panels
  const [rightTab, setRightTab] = useState<RightTab>("tools");
  const [showPreview, setShowPreview] = useState(true);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < configHistory.length - 1;

  function pushConfig(next: PageConfig) {
    const newHistory = configHistory.slice(0, historyIndex + 1);
    newHistory.push(next);
    if (newHistory.length > 30) newHistory.shift();
    setConfigHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setConfig(next);
    configRef.current = next;
  }

  function undo() {
    if (!canUndo) return;
    const prev = historyIndex - 1;
    setHistoryIndex(prev);
    setConfig(configHistory[prev]);
    configRef.current = configHistory[prev];
  }

  function redo() {
    if (!canRedo) return;
    const next = historyIndex + 1;
    setHistoryIndex(next);
    setConfig(configHistory[next]);
    configRef.current = configHistory[next];
  }

  function addUserLink() {
    const label = newLinkLabel.trim();
    const url = newLinkUrl.trim();
    if (!label || !url || config.links.length >= 20) return;

    const baseId = slugify(label) || "link";
    let id = baseId;
    let counter = 2;
    while (config.links.some((link) => link.id === id)) {
      id = `${baseId}-${counter}`;
      counter += 1;
    }

    const next: PageConfig = {
      ...config,
      links: [
        ...config.links,
        { id, label, url, kind: newLinkKind, featured: config.links.length === 0 },
      ],
    };
    pushConfig(next);
    setNewLinkLabel("");
    setNewLinkUrl("");
  }

  function removeUserLink(id: string) {
    pushConfig({ ...config, links: config.links.filter((l) => l.id !== id) });
  }

  function featureUserLink(id: string) {
    pushConfig({
      ...config,
      links: config.links.map((l) => ({ ...l, featured: l.id === id })),
    });
  }

  function addChatMessage(msg: ChatMessage) {
    setChatMessages((prev) => {
      const next = [...prev, msg];
      chatMessagesRef.current = next;
      return next;
    });
  }

  const handleSend = useCallback(
    async (message: string) => {
      if (isLoading) return;

      const userMsg: ChatMessage = {
        role: "user",
        id: makeChatId(),
        content: message,
        timestamp: Date.now(),
      };
      addChatMessage(userMsg);
      liveActivityRef.current = [];
      setLiveActivity([]);
      setIsLoading(true);

      try {
        const history = chatMessagesRef.current
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const response = await fetch("http://localhost:4000/api/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: message,
            config: configRef.current,
            chatHistory: history,
            stream: true,
          }),
        });

        if (!response.ok || !response.body) {
          const fallback = (await response.json()) as ApiResponse;
          if (!fallback.ok) throw new Error(fallback.error);
          throw new Error("Streaming response was not available.");
        }

        const result = await readActivityStream(response.body, (event) => {
          liveActivityRef.current = [...liveActivityRef.current, event];
          setLiveActivity(liveActivityRef.current);
          if (event.type === "error") {
            throw new Error(event.detail ?? event.label);
          }
        });

        if (!result.ok) {
          throw new Error(result.error);
        }

        pushConfig(result.config);

        const assistantMsg: ChatMessage = {
          role: "assistant",
          id: makeChatId(),
          content: result.ai.message,
          timestamp: Date.now(),
          toolCalls: result.ai.tool_calls,
          flow: result.flow,
          activity: liveActivityRef.current,
          aiRequests: result.aiRequests,
          maxAiRequests: result.maxAiRequests,
          totalRetries: result.totalRetries,
          configSnapshot: result.config,
        };
        addChatMessage(assistantMsg);
        liveActivityRef.current = [];
        setLiveActivity([]);
      } catch (error) {
        const errMsg: ChatMessage = {
          role: "system",
          id: makeChatId(),
          content: `Error: ${error instanceof Error ? error.message : "Something went wrong."}`,
          timestamp: Date.now(),
        };
        addChatMessage(errMsg);
        liveActivityRef.current = [];
        setLiveActivity([]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#060608] text-white">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0a0a0f] px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-black tracking-tight">
            <span className="text-fuchsia-400">linkqt</span>
            <span className="text-zinc-500">.me</span>
          </h1>
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
            AI HARNESS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-1 py-0.5">
            <button
              className="rounded px-2 py-1 text-[11px] text-zinc-400 transition hover:text-white disabled:opacity-30"
              disabled={!canUndo}
              onClick={undo}
              title="Undo"
              type="button"
            >
              Undo
            </button>
            <div className="h-3 w-px bg-white/10" />
            <button
              className="rounded px-2 py-1 text-[11px] text-zinc-400 transition hover:text-white disabled:opacity-30"
              disabled={!canRedo}
              onClick={redo}
              title="Redo"
              type="button"
            >
              Redo
            </button>
          </div>
          <span className="text-[10px] text-zinc-600">
            {historyIndex + 1}/{configHistory.length}
          </span>
          <div className="ml-2 h-3 w-px bg-white/10" />
          <button
            className={[
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
              showPreview ? "bg-fuchsia-400/15 text-fuchsia-300" : "text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
            onClick={() => setShowPreview(!showPreview)}
            type="button"
          >
            Preview
          </button>
          <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
            linkqt.me/{config.slug}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel — Chat */}
        <div className="flex w-[420px] shrink-0 flex-col border-r border-white/[0.06] bg-[#08080d]">
          <div className="flex-1 min-h-0">
            <ChatWindow
              isLoading={isLoading}
              liveActivity={liveActivity}
              messages={chatMessages}
              onSend={handleSend}
              suggestions={suggestions}
            />
          </div>
        </div>

        {/* Center — Preview */}
        {showPreview && (
          <div className="flex min-w-0 flex-1 flex-col bg-[#060608]">
            <div className="flex h-10 shrink-0 items-center border-b border-white/[0.06] px-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                Live Preview
              </span>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto p-6">
              <div className="w-full max-w-lg">
                <PagePreview config={config} />
              </div>
            </div>
          </div>
        )}

        {/* Right panel — Tools / Config / Links */}
        <div className="flex w-[340px] shrink-0 flex-col border-l border-white/[0.06] bg-[#08080d]">
          <div className="flex shrink-0 border-b border-white/[0.06]">
            {(["tools", "config", "links"] as const).map((tab) => (
              <button
                className={[
                  "flex-1 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] transition",
                  rightTab === tab
                    ? "border-b-2 border-fuchsia-400 text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                ].join(" ")}
                key={tab}
                onClick={() => setRightTab(tab)}
                type="button"
              >
                {tab === "tools" ? "Tools" : tab === "config" ? "Config" : `Links (${config.links.length})`}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {rightTab === "tools" && <ToolCatalogPanel />}
            {rightTab === "config" && (
              <div className="p-3">
                <ConfigInspector config={config} />
              </div>
            )}
            {rightTab === "links" && (
              <LinkManager
                addUserLink={addUserLink}
                config={config}
                featureUserLink={featureUserLink}
                newLinkKind={newLinkKind}
                newLinkLabel={newLinkLabel}
                newLinkUrl={newLinkUrl}
                removeUserLink={removeUserLink}
                setNewLinkKind={setNewLinkKind}
                setNewLinkLabel={setNewLinkLabel}
                setNewLinkUrl={setNewLinkUrl}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

async function readActivityStream(body: ReadableStream<Uint8Array>, onEvent: (event: AiActivityEvent) => void): Promise<ApiResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ApiResponse | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const event = JSON.parse(trimmed) as AiActivityEvent;
      onEvent(event);
      if (event.type === "done" && event.data) result = event.data as ApiResponse;
    }
  }

  const finalLine = buffer.trim();
  if (finalLine) {
    const event = JSON.parse(finalLine) as AiActivityEvent;
    onEvent(event);
    if (event.type === "done" && event.data) result = event.data as ApiResponse;
  }

  if (!result) throw new Error("AI stream ended before returning a result.");
  return result;
}

function LinkManager({
  config,
  newLinkLabel,
  newLinkUrl,
  newLinkKind,
  setNewLinkLabel,
  setNewLinkUrl,
  setNewLinkKind,
  addUserLink,
  removeUserLink,
  featureUserLink,
}: {
  config: PageConfig;
  newLinkLabel: string;
  newLinkUrl: string;
  newLinkKind: PageConfig["links"][number]["kind"];
  setNewLinkLabel: (v: string) => void;
  setNewLinkUrl: (v: string) => void;
  setNewLinkKind: (v: PageConfig["links"][number]["kind"]) => void;
  addUserLink: () => void;
  removeUserLink: (id: string) => void;
  featureUserLink: (id: string) => void;
}) {
  return (
    <div className="p-3">
      <div className="mb-4">
        <p className="text-xs font-semibold text-zinc-300">Add a link</p>
        <p className="mt-1 text-[10px] text-zinc-500">
          The AI cannot invent URLs. Add your links here, then ask the AI to style them.
        </p>
        <div className="mt-3 grid gap-2">
          <input
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-fuchsia-400/40 placeholder:text-zinc-600 focus:ring-2"
            onChange={(e) => setNewLinkLabel(e.target.value)}
            placeholder="Label, e.g. YouTube"
            value={newLinkLabel}
          />
          <input
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-fuchsia-400/40 placeholder:text-zinc-600 focus:ring-2"
            onChange={(e) => setNewLinkUrl(e.target.value)}
            placeholder="URL"
            value={newLinkUrl}
          />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <select
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none ring-fuchsia-400/40 focus:ring-2"
              onChange={(e) =>
                setNewLinkKind(e.target.value as PageConfig["links"][number]["kind"])
              }
              value={newLinkKind}
            >
              {linkKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <button
              className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-black transition hover:bg-zinc-200"
              onClick={addUserLink}
              type="button"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {config.links.map((link) => (
          <div
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
            key={link.id}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{link.label}</p>
                <p className="truncate text-[10px] text-zinc-500">{link.url}</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.15em] text-zinc-600">
                  {link.kind} &middot; {link.id}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  className={[
                    "rounded-md border px-2 py-1 text-[10px] transition",
                    link.featured
                      ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300"
                      : "border-white/10 text-zinc-400 hover:bg-white/5",
                  ].join(" ")}
                  onClick={() => featureUserLink(link.id)}
                  type="button"
                >
                  {link.featured ? "Featured" : "Feature"}
                </button>
                <button
                  className="rounded-md border border-red-400/20 px-2 py-1 text-[10px] text-red-300/70 hover:bg-red-400/10"
                  onClick={() => removeUserLink(link.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {config.links.length === 0 && (
        <p className="mt-4 text-center text-xs text-zinc-600">No links yet. Add one above.</p>
      )}
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
