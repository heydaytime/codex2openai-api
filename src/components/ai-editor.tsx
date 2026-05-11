"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PagePreview, type PreviewSelection } from "@/components/page-preview";
import { ChatWindow } from "@/components/chat-window";
import {
  accentPresets,
  animationPresets,
  backgroundMotionPresets,
  backgroundPresets,
  bioTreatments,
  featuredStyles,
  fontPresets,
  layoutPresets,
  linkKinds,
  linkFills,
  linkShapes,
  moods,
  motionIntensityPresets,
  motionSpeedPresets,
  paddingPresets,
  shadowPresets,
  sizePresets,
  spacingPresets,
  surfacePresets,
  textPresets,
  titleTreatments,
  widthPresets,
  alignmentPresets,
  type AiEditResponse,
  type AiToolCall,
  type AppliedToolCall,
  type PageConfig,
} from "@/lib/page-config";
import { type AiActivityEvent, type ChatMessage, type ChatHistory, makeChatId } from "@/lib/chat-types";
import { apiPost, wsUrl, backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface AiEditorProps {
  initialConfig: PageConfig;
  token: string;
  username: string;
}

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

type ApplyToolsResponse =
  | { ok: true; config: PageConfig; flow: AppliedToolCall[] }
  | { ok: false; error: string };

const suggestions = [
  "Make this look like a clean founder page and rewrite the bio for investors.",
  "Make it feel like a neon cyberpunk music page and feature Spotify.",
  "Make my merch link pop more and switch to a warmer style.",
  "Make the page more minimal and professional for recruiters.",
  "Make the background a starry sky and make everything glow softly.",
  "Make the buttons smaller, tighter, and more compact.",
];

export function AiEditor({ initialConfig, token, username }: AiEditorProps) {
  const { signOut } = useAuth();
  const normalizedInitialConfig = withPublicSlug(initialConfig, username);
  const [config, setConfig] = useState<PageConfig>(normalizedInitialConfig);
  const [chatMessages, setChatMessages] = useState<ChatHistory>([]);
  const chatMessagesRef = useRef<ChatHistory>([]);
  const configRef = useRef<PageConfig>(normalizedInitialConfig);
  const liveActivityRef = useRef<AiActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [liveActivity, setLiveActivity] = useState<AiActivityEvent[]>([]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<"idle" | "success" | "error">("idle");

  const [configHistory, setConfigHistory] = useState<PageConfig[]>([normalizedInitialConfig]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkKind, setNewLinkKind] =
    useState<PageConfig["links"][number]["kind"]>("website");

  const [showPreview, setShowPreview] = useState(true);
  const [selectedElement, setSelectedElement] = useState<PreviewSelection>("page");

  const wsRef = useRef<WebSocket | null>(null);
  const wsResolverRef = useRef<{
    resolve: (result: ApiResponse) => void;
    reject: (error: Error) => void;
    onEvent: (event: AiActivityEvent) => void;
  } | null>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < configHistory.length - 1;

  // ── WebSocket lifecycle ──

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(wsUrl(token));

      ws.onopen = () => {
        wsRef.current = ws;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as AiActivityEvent;

          if (data.type === "done" && data.data) {
            wsResolverRef.current?.onEvent(data);
            wsResolverRef.current?.resolve(data.data as ApiResponse);
            wsResolverRef.current = null;
            return;
          }

          if (data.type === "error") {
            wsResolverRef.current?.onEvent(data);
            wsResolverRef.current?.reject(new Error(data.detail ?? data.label));
            wsResolverRef.current = null;
            return;
          }

          wsResolverRef.current?.onEvent(data);
        } catch { /* malformed message */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (wsResolverRef.current) {
          wsResolverRef.current.reject(new Error("WebSocket connection lost."));
          wsResolverRef.current = null;
        }
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [token]);

  // ── Config Management ──

  function pushConfig(next: PageConfig) {
    next = withPublicSlug(next, username);
    const newHistory = configHistory.slice(0, historyIndex + 1);
    newHistory.push(next);
    if (newHistory.length > 30) newHistory.shift();
    setConfigHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setConfig(next);
    configRef.current = next;
    setHasUnsavedChanges(true);
    setPublishStatus("idle");
  }

  function undo() {
    if (!canUndo) return;
    const prev = historyIndex - 1;
    setHistoryIndex(prev);
    setConfig(configHistory[prev]);
    configRef.current = configHistory[prev];
    setHasUnsavedChanges(true);

    syncDraftToBackend(configHistory[prev]);
  }

  function redo() {
    if (!canRedo) return;
    const next = historyIndex + 1;
    setHistoryIndex(next);
    setConfig(configHistory[next]);
    configRef.current = configHistory[next];
    setHasUnsavedChanges(true);

    syncDraftToBackend(configHistory[next]);
  }

  const syncDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  function syncDraftToBackend(cfg: PageConfig) {
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(() => {
      apiPost("/api/page/draft", { config: withPublicSlug(cfg, username) }, token).catch(() => {});
    }, 1000);
  }

  // ── Publish ──

  async function handlePublish() {
    setIsPublishing(true);
    setPublishStatus("idle");
    try {
      const result = await apiPost("/api/page/publish", { config: withPublicSlug(configRef.current, username) }, token);
      if (result.ok) {
        setPublishStatus("success");
        setHasUnsavedChanges(false);
        setTimeout(() => setPublishStatus("idle"), 3000);
      } else {
        setPublishStatus("error");
      }
    } catch {
      setPublishStatus("error");
    } finally {
      setIsPublishing(false);
    }
  }

  // ── Link Management ──

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
    syncDraftToBackend(next);
    setNewLinkLabel("");
    setNewLinkUrl("");
  }

  function removeUserLink(id: string) {
    const next = { ...config, links: config.links.filter((l) => l.id !== id) };
    pushConfig(next);
    syncDraftToBackend(next);
  }

  function featureUserLink(id: string) {
    void applyManualToolCalls([{ tool: "feature_link", args: { id, style: "glow" } }]);
  }

  function moveUserLink(id: string, direction: "up" | "down") {
    const current = configRef.current;
    const index = current.links.findIndex((link) => link.id === id);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.links.length) return;

    const ordered = [...current.links];
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    const next = { ...current, links: ordered };
    pushConfig(next);
    syncDraftToBackend(next);
  }

  // ── Manual Tool Calls ──

  async function applyManualToolCalls(toolCalls: AiToolCall[]) {
    try {
      const result = (await apiPost(
        "/api/apply-tools",
        { config: configRef.current, toolCalls },
        token
      )) as ApplyToolsResponse;
      if (!result.ok) throw new Error(result.error);
      pushConfig(result.config);
    } catch (error) {
      addChatMessage({
        role: "system",
        id: makeChatId(),
        content: `Manual edit failed: ${error instanceof Error ? error.message : "Something went wrong."}`,
        timestamp: Date.now(),
      });
    }
  }

  // ── Image Upload ──

  async function uploadImage(dataUrl: string): Promise<string | null> {
    try {
      const result = await apiPost("/api/image/upload", { dataUrl }, token);
      if (result.ok) {
        return backendUrl(result.url);
      }
      return null;
    } catch {
      return null;
    }
  }

  // ── Chat ──

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
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          throw new Error("Not connected to server. Retrying...");
        }

        const history = chatMessagesRef.current
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const result = await new Promise<ApiResponse>((resolve, reject) => {
          wsResolverRef.current = {
            resolve,
            reject,
            onEvent: (event) => {
              liveActivityRef.current = [...liveActivityRef.current, event];
              setLiveActivity([...liveActivityRef.current]);
            },
          };

          ws.send(
            JSON.stringify({
              type: "edit",
              prompt: message,
              config: configRef.current,
              chatHistory: history,
            })
          );
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
          retryPrompt: message,
        };
        addChatMessage(errMsg);
        liveActivityRef.current = [];
        setLiveActivity([]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, token]
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
            EDITOR
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
          <a
            className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 transition hover:bg-emerald-400/20"
            href={`/${username}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            linkqt.me/{username}
          </a>
          <div className="ml-1 h-3 w-px bg-white/10" />

          {hasUnsavedChanges && (
            <span className="text-[10px] text-amber-400">Unsaved</span>
          )}

          <button
            className={[
              "rounded-lg px-3 py-1.5 text-[11px] font-black transition",
              publishStatus === "success"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-fuchsia-500 text-white hover:bg-fuchsia-400 disabled:opacity-50",
            ].join(" ")}
            disabled={isPublishing || publishStatus === "success"}
            onClick={handlePublish}
            type="button"
          >
            {isPublishing ? "Publishing..." : publishStatus === "success" ? "Published!" : "Publish"}
          </button>

          <button
            className="rounded-lg px-2 py-1 text-[10px] text-zinc-600 transition hover:text-zinc-300"
            onClick={signOut}
            type="button"
          >
            Sign out
          </button>
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
              onRetry={handleSend}
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
              {hasUnsavedChanges && (
                <span className="ml-3 text-[10px] text-amber-400/70">Draft &mdash; not yet published</span>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
                <div className="h-full max-h-full w-full max-w-lg">
                  <PagePreview
                    config={config}
                    fit
                    onSelectElement={setSelectedElement}
                    publicSlug={username}
                    selectedElement={selectedElement}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <ManualControlDock
          addUserLink={addUserLink}
          applyManualToolCalls={applyManualToolCalls}
          config={config}
          featureUserLink={featureUserLink}
          moveUserLink={moveUserLink}
          newLinkKind={newLinkKind}
          newLinkLabel={newLinkLabel}
          newLinkUrl={newLinkUrl}
          removeUserLink={removeUserLink}
          selectedElement={selectedElement}
          setSelectedElement={setSelectedElement}
          setNewLinkKind={setNewLinkKind}
          setNewLinkLabel={setNewLinkLabel}
          setNewLinkUrl={setNewLinkUrl}
          uploadImage={uploadImage}
        />
      </div>
    </main>
  );
}

function withPublicSlug(config: PageConfig, username: string): PageConfig {
  return config.slug === username ? config : { ...config, slug: username };
}

// ── Manual Control Dock ──

function ManualControlDock({
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
  moveUserLink,
  applyManualToolCalls,
  selectedElement,
  setSelectedElement,
  uploadImage,
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
  moveUserLink: (id: string, direction: "up" | "down") => void;
  applyManualToolCalls: (toolCalls: AiToolCall[]) => Promise<void>;
  selectedElement: PreviewSelection;
  setSelectedElement: (element: PreviewSelection) => void;
  uploadImage: (dataUrl: string) => Promise<string | null>;
}) {
  const [controlMode, setControlMode] = useState<"quick" | "manual">("quick");
  const [titleDraft, setTitleDraft] = useState(config.profile.displayName);
  const [bioDraft, setBioDraft] = useState(config.profile.bio);
  const [manualValues, setManualValues] = useState({
    background: "white",
    mood: "clean",
    accent: "blue",
    surface: "paper",
    text: "dark",
    font: "modern",
    backgroundMotion: "none",
    motionIntensity: "medium",
    motionSpeed: "normal",
    titleFont: "display",
    titleTreatment: "wide",
    bioFont: "serif",
    bioTreatment: "card",
    layoutPreset: "centered-stack",
    spacing: "normal",
    padding: "normal",
    alignment: "center",
    width: "medium",
    linkShape: "pill",
    linkFill: "glass",
    linkSize: "md",
    linkShadow: "glow",
    linkAnimation: "lift",
    linkFont: "bold",
    featuredStyle: "glow",
  });
  const selectedLinkId = selectedElement.startsWith("link:") ? selectedElement.slice(5) : "";
  const targetLink = config.links.find((link) => link.id === selectedLinkId);

  useEffect(() => {
    setTitleDraft(config.profile.displayName);
    setBioDraft(config.profile.bio);
  }, [config.profile.displayName, config.profile.bio]);

  function withTarget(build: (id: string) => AiToolCall[]) {
    if (!targetLink) return;
    void applyManualToolCalls(build(targetLink.id));
  }

  function setManualValue(key: string, value: string) {
    setManualValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-white/[0.06] bg-[#08080d]">
      <div className="shrink-0 border-b border-white/[0.06] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-300">Manual Controls</p>
            <p className="mt-1 text-[10px] text-zinc-500">Pick a page element, then edit only that element.</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Selectable Elements</p>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <button className={elementButtonClass(selectedElement === "page")} onClick={() => setSelectedElement("page")} type="button">Page</button>
            <button className={elementButtonClass(selectedElement === "title")} onClick={() => setSelectedElement("title")} type="button">Title</button>
            <button className={elementButtonClass(selectedElement === "bio")} onClick={() => setSelectedElement("bio")} type="button">Description</button>
            <button className={elementButtonClass(selectedElement === "layout")} onClick={() => setSelectedElement("layout")} type="button">Layout</button>
            <button className={elementButtonClass(selectedElement === "all-links")} onClick={() => setSelectedElement("all-links")} type="button">All links</button>
          </div>
          <div className="space-y-1.5">
            {config.links.map((link, index) => (
              <div className={["flex items-center gap-2 rounded-lg border px-2 py-1.5", selectedElement === `link:${link.id}` ? "border-fuchsia-400/30 bg-fuchsia-400/10" : "border-white/[0.06] bg-black/20"].join(" ")} key={link.id}>
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setSelectedElement(`link:${link.id}`)}
                  type="button"
                >
                  <span className="block truncate text-xs font-semibold text-white">{link.label}</span>
                  <span className="block truncate text-[9px] uppercase tracking-[0.12em] text-zinc-600">{link.kind} · {link.id}</span>
                </button>
                <button className="control-btn" disabled={index === 0} onClick={() => moveUserLink(link.id, "up")} type="button">Up</button>
                <button className="control-btn" disabled={index === config.links.length - 1} onClick={() => moveUserLink(link.id, "down")} type="button">Down</button>
                <button className="control-btn" onClick={() => featureUserLink(link.id)} type="button">Feature</button>
                <button className="rounded-md border border-red-400/20 px-2 py-1 text-[10px] text-red-300/70 hover:bg-red-400/10" onClick={() => removeUserLink(link.id)} type="button">Remove</button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Element Actions</p>
          <p className="mb-3 text-xs font-semibold text-zinc-200">{selectedElementLabel(selectedElement, targetLink?.label)}</p>
          <div className="mb-3 grid grid-cols-2 rounded-xl border border-white/10 bg-black/30 p-1">
            <button className={modeButtonClass(controlMode === "quick")} onClick={() => setControlMode("quick")} type="button">Quick actions</button>
            <button className={modeButtonClass(controlMode === "manual")} onClick={() => setControlMode("manual")} type="button">Manual</button>
          </div>
          {controlMode === "quick" && selectedElement === "page" && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_background", args: { preset: "warm-gradient" } }, { tool: "change_theme", args: { mood: "warm", accent: "orange", surface: "paper", text: "dark" } }])} type="button">Warm</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_background", args: { preset: "cyber-grid" } }, { tool: "change_theme", args: { mood: "cyberpunk", accent: "cyan", surface: "glow-card", text: "light" } }])} type="button">Cyber</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_background", args: { preset: "white" } }, { tool: "change_theme", args: { mood: "minimal", accent: "blue", surface: "paper", text: "dark" } }, { tool: "change_background_motion", args: { preset: "none" } }, { tool: "change_creative_layer", args: { enabled: false, elements: [] } }])} type="button">Clean</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_background", args: { preset: "black" } }, { tool: "change_theme", args: { mood: "luxury", accent: "gold", surface: "glass", text: "light" } }])} type="button">Luxury</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_background_motion", args: { preset: "aurora-drift", intensity: "medium", speed: "slow" } }])} type="button">Dynamic aurora</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_background_motion", args: { preset: "none" } }])} type="button">Stop motion</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "reset_element", args: { target: "page" } }])} type="button">Reset page style</button>
              <button className="danger-action-btn" onClick={() => applyManualToolCalls([{ tool: "reset_page", args: {} }])} type="button">Reset everything</button>
            </div>
          )}
          {controlMode === "quick" && selectedElement === "title" && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_profile", args: { titleFont: "display", titleTreatment: "wide" } }])} type="button">Wide display</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_profile", args: { titleFont: "elegant", titleTreatment: "tight" } }])} type="button">Elegant</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_profile", args: { titleFont: "tech", titleTreatment: "normal" } }])} type="button">Tech</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_profile", args: { titleFont: "display", titleTreatment: "gradient" } }])} type="button">Gradient</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_profile", args: { titleFont: "display", titleTreatment: "outline" } }])} type="button">Outline</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "reset_element", args: { target: "title" } }])} type="button">Reset title</button>
            </div>
          )}
          {controlMode === "quick" && selectedElement === "bio" && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_profile", args: { bioFont: "serif", bioTreatment: "card" } }])} type="button">Editorial card</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_profile", args: { bioFont: "modern", bioTreatment: "muted" } }])} type="button">Muted</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_profile", args: { bioFont: "rounded", bioTreatment: "normal" } }])} type="button">Friendly</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_profile", args: { bioFont: "mono", bioTreatment: "caps" } }])} type="button">Caps label</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "reset_element", args: { target: "bio" } }])} type="button">Reset description</button>
            </div>
          )}
          {controlMode === "quick" && selectedElement === "layout" && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_layout", args: { preset: "compact", spacing: "tight", padding: "compact", width: "narrow" } }])} type="button">Compact</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_layout", args: { spacing: "airy", padding: "roomy", width: "wide" } }])} type="button">Roomy</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_layout", args: { preset: "split-hero", width: "wide", padding: "roomy" } }])} type="button">Split hero</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_layout", args: { alignment: "left" } }])} type="button">Align left</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_layout", args: { alignment: "center" } }])} type="button">Center</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "reset_element", args: { target: "layout" } }])} type="button">Reset layout</button>
            </div>
          )}
          {controlMode === "quick" && selectedElement === "all-links" && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_link_appearance", args: { shape: "pill", fill: "solid", size: "lg", shadow: "glow", animation: "pulse-featured" } }])} type="button">Make all pop</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "reorder_links", args: { order: config.links.map((link) => link.id) } }])} type="button">Keep current order</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_link_appearance", args: { shape: "pill", fill: "solid", size: "lg", shadow: "strong", animation: "pulse-featured" } }])} type="button">CTA buttons</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_link_appearance", args: { shape: "rounded", fill: "outline", size: "sm", shadow: "none", animation: "none" } }])} type="button">Tone down all</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "change_link_appearance", args: { shape: "pill", fill: "glass", size: "md", shadow: "glow", animation: "lift" } }])} type="button">Neon glass all</button>
              <button className="action-btn" onClick={() => applyManualToolCalls([{ tool: "reset_element", args: { target: "links" } }])} type="button">Reset all links</button>
            </div>
          )}
          {controlMode === "quick" && targetLink && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <button className="action-btn" onClick={() => withTarget((id) => [{ tool: "feature_link", args: { id, style: "glow" } }, { tool: "change_individual_link_style", args: { id, size: "lg", shadow: "glow", animation: "pulse-featured", font: "bold" } }])} type="button">Make it pop</button>
              <button className="action-btn" onClick={() => withTarget((id) => [{ tool: "reorder_links", args: { order: [id] } }])} type="button">Move first</button>
              <button className="action-btn" onClick={() => withTarget((id) => [{ tool: "change_individual_link_style", args: { id, fill: "solid", size: "lg", shadow: "strong", font: "bold" } }])} type="button">CTA button</button>
              <button className="action-btn" onClick={() => withTarget((id) => [{ tool: "change_individual_link_style", args: { id, fill: "outline", size: "sm", shadow: "none", animation: "none", font: "mono" } }])} type="button">Tone down</button>
              <button className="action-btn" onClick={() => withTarget((id) => [{ tool: "change_individual_link_style", args: { id, fill: "glass", shape: "pill", shadow: "glow", font: "tech" } }])} type="button">Neon glass</button>
              <button className="action-btn" onClick={() => withTarget((id) => [{ tool: "reset_element", args: { target: "link", id } }])} type="button">Reset link</button>
            </div>
          )}
          {controlMode === "manual" && (
            <ManualElementEditor
              applyManualToolCalls={applyManualToolCalls}
              manualValues={manualValues}
              selectedElement={selectedElement}
              setManualValue={setManualValue}
              targetLink={targetLink}
            />
          )}
        </div>

        <ProfileImageControl config={config} applyManualToolCalls={applyManualToolCalls} uploadImage={uploadImage} />

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Edit Text</p>
          <div className="grid gap-2">
            <label className="grid gap-1 text-[11px] text-zinc-500">
              Title
              <input
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none ring-fuchsia-400/40 placeholder:text-zinc-600 focus:ring-2"
                maxLength={80}
                onChange={(e) => setTitleDraft(e.target.value)}
                value={titleDraft}
              />
            </label>
            <button
              className="action-btn"
              disabled={!titleDraft.trim() || titleDraft === config.profile.displayName}
              onClick={() => void applyManualToolCalls([{ tool: "change_profile", args: { displayName: titleDraft.trim() } }])}
              type="button"
            >
              Save title
            </button>
            <label className="grid gap-1 text-[11px] text-zinc-500">
              Description
              <textarea
                className="min-h-20 resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none ring-fuchsia-400/40 placeholder:text-zinc-600 focus:ring-2"
                maxLength={240}
                onChange={(e) => setBioDraft(e.target.value)}
                value={bioDraft}
              />
            </label>
            <button
              className="action-btn"
              disabled={bioDraft === config.profile.bio}
              onClick={() => void applyManualToolCalls([{ tool: "change_profile", args: { bio: bioDraft } }])}
              type="button"
            >
              Save description
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Add Link</p>
          <div className="grid gap-2">
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
      </div>

      {config.links.length === 0 && (
        <p className="mt-3 text-center text-xs text-zinc-600">No links yet. Add one above.</p>
      )}
      <style jsx>{`
        .control-btn {
          border: 1px solid rgba(255,255,255,.1);
          border-radius: .375rem;
          padding: .25rem .45rem;
          font-size: 10px;
          color: rgb(161 161 170);
        }
        .control-btn:hover:not(:disabled) { background: rgba(255,255,255,.06); color: white; }
        .control-btn:disabled { opacity: .35; cursor: not-allowed; }
        .action-btn {
          border: 1px solid rgba(255,255,255,.1);
          border-radius: .65rem;
          background: rgba(255,255,255,.04);
          padding: .55rem .65rem;
          font-size: 11px;
          font-weight: 700;
          color: rgb(212 212 216);
          transition: background .15s ease, color .15s ease, border-color .15s ease;
        }
        .action-btn:hover { border-color: rgba(217,70,239,.35); background: rgba(217,70,239,.12); color: white; }
        .danger-action-btn {
          border: 1px solid rgba(248,113,113,.35);
          border-radius: .65rem;
          background: rgba(239,68,68,.12);
          padding: .55rem .65rem;
          font-size: 11px;
          font-weight: 800;
          color: rgb(252 165 165);
          transition: background .15s ease, color .15s ease, border-color .15s ease;
        }
        .danger-action-btn:hover { border-color: rgba(248,113,113,.65); background: rgba(239,68,68,.22); color: white; }
      `}</style>
    </aside>
  );
}

// ── Profile Image Control (updated for backend upload) ──

function ProfileImageControl({
  config,
  applyManualToolCalls,
  uploadImage,
}: {
  config: PageConfig;
  applyManualToolCalls: (toolCalls: AiToolCall[]) => Promise<void>;
  uploadImage: (dataUrl: string) => Promise<string | null>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function prepareImage(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 1_200_000) {
      window.alert("Please choose an image under 1.2MB.");
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setCropSource(dataUrl);
    setCropZoom(1);
    setCropX(0);
    setCropY(0);
  }

  async function applyCroppedImage() {
    if (!cropSource) return;
    setUploading(true);
    try {
      const cropped = await cropImageToSquare(cropSource, { zoom: cropZoom, x: cropX, y: cropY });
      const imageUrl = await uploadImage(cropped);
      if (imageUrl) {
        await applyManualToolCalls([{ tool: "change_profile", args: { avatarUrl: imageUrl, avatarStyle: "circle" } }]);
      }
    } finally {
      setUploading(false);
      setCropSource(null);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Profile Image</p>
      <label
        className={[
          "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 transition",
          isDragging ? "border-fuchsia-300/60 bg-fuchsia-400/10" : "border-white/15 bg-black/20 hover:bg-white/[0.04]",
        ].join(" ")}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void prepareImage(event.dataTransfer.files[0]);
        }}
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-lg font-black text-white">
          {config.profile.avatarUrl ? <img alt="Current profile" className="h-full w-full object-cover" src={config.profile.avatarUrl} /> : config.profile.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-zinc-200">Drop image here</p>
          <p className="mt-1 text-[10px] leading-4 text-zinc-500">PNG, JPG, WebP, or GIF. Max 1.2MB.</p>
        </div>
        <input
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => void prepareImage(event.target.files?.[0])}
          type="file"
        />
      </label>
      {config.profile.avatarUrl && (
        <button
          className="mt-2 w-full rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-400/20"
          onClick={() => void applyManualToolCalls([{ tool: "change_profile", args: { avatarUrl: null } }])}
          type="button"
        >
          Delete profile image
        </button>
      )}
      {cropSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0b12] p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Crop profile image</p>
                <p className="mt-1 text-xs text-zinc-500">Adjust the square crop before uploading.</p>
              </div>
              <button className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-white/5 hover:text-white" onClick={() => setCropSource(null)} type="button">Cancel</button>
            </div>
            <div className="mx-auto mb-4 h-64 w-64 overflow-hidden rounded-2xl border border-white/10 bg-black">
              <img
                alt="Crop preview"
                className="h-full w-full object-cover"
                src={cropSource}
                style={{ transform: `scale(${cropZoom}) translate(${cropX / 3}%, ${cropY / 3}%)` }}
              />
            </div>
            <div className="grid gap-3">
              <CropSlider label="Zoom" max={3} min={1} onChange={setCropZoom} step={0.01} value={cropZoom} />
              <CropSlider label="Horizontal" max={50} min={-50} onChange={setCropX} step={1} value={cropX} />
              <CropSlider label="Vertical" max={50} min={-50} onChange={setCropY} step={1} value={cropY} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5" onClick={() => setCropSource(null)} type="button">Cancel</button>
              <button
                className="rounded-xl bg-white px-3 py-2 text-xs font-black text-black hover:bg-zinc-200 disabled:opacity-50"
                disabled={uploading}
                onClick={() => void applyCroppedImage()}
                type="button"
              >
                {uploading ? "Uploading..." : "Use image"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared Components ──

function CropSlider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold text-zinc-500">
      <span>{label}</span>
      <input className="accent-fuchsia-400" max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type="range" value={value} />
    </label>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function cropImageToSquare(src: string, crop: { zoom: number; x: number; y: number }) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const outputSize = 512;
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not create crop canvas."));
        return;
      }

      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / crop.zoom;
      const maxX = Math.max(0, image.naturalWidth - sourceSize);
      const maxY = Math.max(0, image.naturalHeight - sourceSize);
      const centerX = (image.naturalWidth - sourceSize) / 2;
      const centerY = (image.naturalHeight - sourceSize) / 2;
      const sx = clamp(centerX + (crop.x / 50) * (maxX / 2), 0, maxX);
      const sy = clamp(centerY + (crop.y / 50) * (maxY / 2), 0, maxY);

      context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    image.onerror = () => reject(new Error("Could not load image for cropping."));
    image.src = src;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ManualElementEditor({
  selectedElement,
  targetLink,
  manualValues,
  setManualValue,
  applyManualToolCalls,
}: {
  selectedElement: string;
  targetLink?: PageConfig["links"][number];
  manualValues: Record<string, string>;
  setManualValue: (key: keyof typeof manualValues, value: string) => void;
  applyManualToolCalls: (toolCalls: AiToolCall[]) => Promise<void>;
}) {
  if (selectedElement === "page") {
    return (
      <div className="grid gap-2">
        <ManualSelect label="Background" onChange={(v) => setManualValue("background", v)} options={backgroundPresets.filter((p) => p !== "custom")} value={manualValues.background} />
        <ManualSelect label="Mood" onChange={(v) => setManualValue("mood", v)} options={moods} value={manualValues.mood} />
        <ManualSelect label="Accent" onChange={(v) => setManualValue("accent", v)} options={accentPresets} value={manualValues.accent} />
        <ManualSelect label="Surface" onChange={(v) => setManualValue("surface", v)} options={surfacePresets} value={manualValues.surface} />
        <ManualSelect label="Text" onChange={(v) => setManualValue("text", v)} options={textPresets} value={manualValues.text} />
        <ManualSelect label="Motion" onChange={(v) => setManualValue("backgroundMotion", v)} options={backgroundMotionPresets} value={manualValues.backgroundMotion} />
        <ManualSelect label="Intensity" onChange={(v) => setManualValue("motionIntensity", v)} options={motionIntensityPresets} value={manualValues.motionIntensity} />
        <ManualSelect label="Speed" onChange={(v) => setManualValue("motionSpeed", v)} options={motionSpeedPresets} value={manualValues.motionSpeed} />
        <button className="action-btn" onClick={() => void applyManualToolCalls([
          { tool: "change_background", args: { preset: manualValues.background } },
          { tool: "change_theme", args: { mood: manualValues.mood, accent: manualValues.accent, surface: manualValues.surface, text: manualValues.text } },
          { tool: "change_background_motion", args: { preset: manualValues.backgroundMotion, intensity: manualValues.motionIntensity, speed: manualValues.motionSpeed } },
        ] as AiToolCall[])} type="button">Apply page settings</button>
      </div>
    );
  }

  if (selectedElement === "title") {
    return (
      <div className="grid gap-2">
        <ManualSelect label="Title font" onChange={(v) => setManualValue("titleFont", v)} options={fontPresets} value={manualValues.titleFont} />
        <ManualSelect label="Treatment" onChange={(v) => setManualValue("titleTreatment", v)} options={titleTreatments} value={manualValues.titleTreatment} />
        <button className="action-btn" onClick={() => void applyManualToolCalls([{ tool: "change_profile", args: { titleFont: manualValues.titleFont, titleTreatment: manualValues.titleTreatment } }] as AiToolCall[])} type="button">Apply title settings</button>
      </div>
    );
  }

  if (selectedElement === "bio") {
    return (
      <div className="grid gap-2">
        <ManualSelect label="Description font" onChange={(v) => setManualValue("bioFont", v)} options={fontPresets} value={manualValues.bioFont} />
        <ManualSelect label="Treatment" onChange={(v) => setManualValue("bioTreatment", v)} options={bioTreatments} value={manualValues.bioTreatment} />
        <button className="action-btn" onClick={() => void applyManualToolCalls([{ tool: "change_profile", args: { bioFont: manualValues.bioFont, bioTreatment: manualValues.bioTreatment } }] as AiToolCall[])} type="button">Apply description settings</button>
      </div>
    );
  }

  if (selectedElement === "layout") {
    return (
      <div className="grid gap-2">
        <ManualSelect label="Layout" onChange={(v) => setManualValue("layoutPreset", v)} options={layoutPresets} value={manualValues.layoutPreset} />
        <ManualSelect label="Spacing" onChange={(v) => setManualValue("spacing", v)} options={spacingPresets} value={manualValues.spacing} />
        <ManualSelect label="Padding" onChange={(v) => setManualValue("padding", v)} options={paddingPresets} value={manualValues.padding} />
        <ManualSelect label="Alignment" onChange={(v) => setManualValue("alignment", v)} options={alignmentPresets} value={manualValues.alignment} />
        <ManualSelect label="Width" onChange={(v) => setManualValue("width", v)} options={widthPresets} value={manualValues.width} />
        <button className="action-btn" onClick={() => void applyManualToolCalls([{ tool: "change_layout", args: { preset: manualValues.layoutPreset, spacing: manualValues.spacing, padding: manualValues.padding, alignment: manualValues.alignment, width: manualValues.width } }] as AiToolCall[])} type="button">Apply layout settings</button>
      </div>
    );
  }

  if (selectedElement === "all-links" || targetLink) {
    const tool = targetLink ? "change_individual_link_style" : "change_link_appearance";
    const args = targetLink
      ? { id: targetLink.id, shape: manualValues.linkShape, fill: manualValues.linkFill, size: manualValues.linkSize, shadow: manualValues.linkShadow, animation: manualValues.linkAnimation, font: manualValues.linkFont }
      : { shape: manualValues.linkShape, fill: manualValues.linkFill, size: manualValues.linkSize, shadow: manualValues.linkShadow, animation: manualValues.linkAnimation };

    return (
      <div className="grid gap-2">
        <ManualSelect label="Shape" onChange={(v) => setManualValue("linkShape", v)} options={linkShapes} value={manualValues.linkShape} />
        <ManualSelect label="Fill" onChange={(v) => setManualValue("linkFill", v)} options={linkFills} value={manualValues.linkFill} />
        <ManualSelect label="Size" onChange={(v) => setManualValue("linkSize", v)} options={sizePresets} value={manualValues.linkSize} />
        <ManualSelect label="Shadow" onChange={(v) => setManualValue("linkShadow", v)} options={shadowPresets} value={manualValues.linkShadow} />
        <ManualSelect label="Animation" onChange={(v) => setManualValue("linkAnimation", v)} options={animationPresets} value={manualValues.linkAnimation} />
        {targetLink && <ManualSelect label="Link font" onChange={(v) => setManualValue("linkFont", v)} options={fontPresets} value={manualValues.linkFont} />}
        {targetLink && <ManualSelect label="Featured style" onChange={(v) => setManualValue("featuredStyle", v)} options={featuredStyles} value={manualValues.featuredStyle} />}
        <div className="grid grid-cols-2 gap-2">
          <button className="action-btn" onClick={() => void applyManualToolCalls([{ tool, args }] as AiToolCall[])} type="button">Apply link style</button>
          {targetLink && <button className="action-btn" onClick={() => void applyManualToolCalls([{ tool: "feature_link", args: { id: targetLink.id, style: manualValues.featuredStyle } }] as AiToolCall[])} type="button">Feature link</button>}
        </div>
      </div>
    );
  }

  return null;
}

function ManualSelect({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid grid-cols-[110px_1fr] items-center gap-2 text-[11px] text-zinc-500">
      <span>{label}</span>
      <select className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 outline-none" onChange={(e) => onChange(e.target.value)} value={value}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function selectedElementLabel(selectedElement: string, linkLabel?: string) {
  if (selectedElement === "page") return "Editing the whole page background and mood";
  if (selectedElement === "title") return "Editing the title";
  if (selectedElement === "bio") return "Editing the description";
  if (selectedElement === "layout") return "Editing spacing, padding, and alignment";
  if (selectedElement === "all-links") return "Editing all links";
  return `Editing link: ${linkLabel ?? "Unknown"}`;
}

function modeButtonClass(active: boolean) {
  return [
    "rounded-lg px-2 py-1.5 text-[11px] font-bold transition",
    active ? "bg-white text-black" : "text-zinc-500 hover:text-zinc-200",
  ].join(" ");
}

function elementButtonClass(active: boolean) {
  return [
    "rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition",
    active
      ? "border-fuchsia-400/40 bg-fuchsia-400/15 text-white"
      : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/[0.06] hover:text-white",
  ].join(" ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
