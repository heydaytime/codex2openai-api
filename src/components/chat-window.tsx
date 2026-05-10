"use client";

import { useEffect, useRef, useState } from "react";
import type { AiActivityEvent, ChatMessage } from "@/lib/chat-types";
import type { AppliedToolCall, AiEditResponse } from "@/lib/page-config";

export function ChatWindow({
  messages,
  isLoading,
  liveActivity,
  onSend,
  onRetry,
  suggestions,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  liveActivity: AiActivityEvent[];
  onSend: (message: string) => void;
  onRetry: (message: string) => void;
  suggestions: string[];
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-3 text-4xl">&#x2728;</div>
              <p className="text-lg font-bold text-white">Design your page with AI</p>
              <p className="mt-2 max-w-sm text-sm text-zinc-400">
                Describe the vibe you want. The AI will plan tool calls, validate them, and update your page preview in
                real time.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble isLoading={isLoading} key={msg.id} message={msg} onRetry={onRetry} />
        ))}

        {isLoading && (
          <div className="mb-4 flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-fuchsia-400/20 text-sm font-black text-fuchsia-300">
              AI
            </div>
            <div className="max-w-[85%] space-y-3">
              <div className="rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="flex items-center gap-2">
                  <LoadingDots />
                  <span className="text-sm text-zinc-400">Streaming AI activity...</span>
                </div>
              </div>
              <ActivityTimeline events={liveActivity} isLive />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {showSuggestions && (
        <div className="border-t border-white/5 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Try a prompt</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                key={s}
                onClick={() => onSend(s)}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-white/10 p-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            className="min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none ring-fuchsia-400/40 placeholder:text-zinc-500 focus:ring-2"
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the vibe you want..."
            rows={1}
            value={input}
          />
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-400 text-black transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isLoading || !input.trim()}
            onClick={handleSend}
            type="button"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isLoading, onRetry }: { message: ChatMessage; isLoading: boolean; onRetry: (message: string) => void }) {
  if (message.role === "system") {
    return (
      <div className="mb-3 flex justify-center">
        <div className="max-w-[90%] rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-2 text-xs text-zinc-500">
          <span>{message.content}</span>
          {message.retryPrompt && (
            <button
              className="ml-3 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[10px] font-bold text-amber-200 transition hover:bg-amber-300/20 disabled:opacity-40"
              disabled={isLoading}
              onClick={() => onRetry(message.retryPrompt!)}
              type="button"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="mb-4 flex flex-row-reverse gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white">
          U
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-fuchsia-400/15 px-4 py-3 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-fuchsia-400/20 text-sm font-black text-fuchsia-300">
        AI
      </div>
      <div className="max-w-[85%] space-y-3">
        <div className="rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-sm text-zinc-200">{message.content}</p>
          <p className="mt-2 text-[11px] text-zinc-500">
            {message.aiRequests}/{message.maxAiRequests} AI passes used
            {message.totalRetries > 0 && (
              <span className="ml-2 text-amber-400/80">
                ({message.totalRetries} {message.totalRetries === 1 ? "retry" : "retries"} needed)
              </span>
            )}
          </p>
        </div>
        {message.activity && message.activity.length > 0 && <ActivityTimeline events={message.activity} />}
        {message.flow.length > 0 && <ToolCallFlow flow={message.flow} toolCalls={message.toolCalls} />}
      </div>
    </div>
  );
}

function ActivityTimeline({ events, isLive = false }: { events: AiActivityEvent[]; isLive?: boolean }) {
  if (events.length === 0) {
    return isLive ? (
      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-500">
        Waiting for the first server event...
      </div>
    ) : null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
          {isLive ? "Live Stream" : "AI Activity"}
        </span>
        {isLive && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">live</span>}
      </div>
      <div className="space-y-1 px-3 py-2">
        {events.map((event, index) => (
          <div className="flex items-start gap-2 py-1" key={`${event.ts ?? index}-${event.type}-${event.label}`}>
            <div className={["mt-1 h-2 w-2 shrink-0 rounded-full", activityDotClass(event.type)].join(" ")} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">{event.label}</span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">{event.type}</span>
              </div>
              {event.detail && <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">{event.detail}</p>}
              {event.type === "tool" && event.data ? (
                <pre className="mt-1 max-h-24 overflow-auto rounded-lg bg-black/40 p-2 text-[10px] text-zinc-400">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function activityDotClass(type: AiActivityEvent["type"]) {
  if (type === "tool") return "bg-fuchsia-400";
  if (type === "decision") return "bg-sky-400";
  if (type === "retry") return "bg-amber-400";
  if (type === "done") return "bg-emerald-400";
  if (type === "error") return "bg-red-400";
  return "bg-zinc-500";
}

function ToolCallFlow({ flow, toolCalls }: { flow: AppliedToolCall[]; toolCalls: AiEditResponse["tool_calls"] }) {
  const [expanded, setExpanded] = useState(false);
  const applied = flow.filter((s) => s.status === "applied").length;
  const skipped = flow.filter((s) => s.status === "skipped").length;

  return (
    <div className="rounded-xl border border-white/10 bg-black/30">
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Tool Calls</span>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            {applied} applied
          </span>
          {skipped > 0 && (
            <span className="rounded-full bg-zinc-400/10 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
              {skipped} skipped
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-500">{expanded ? "collapse" : "expand"}</span>
      </button>
      {expanded && (
        <div className="space-y-1 border-t border-white/5 px-3 py-2">
          {flow.map((step, i) => (
            <div className="flex items-start gap-2 py-1" key={step.id}>
              <div
                className={[
                  "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                  step.status === "applied" ? "bg-emerald-400" : "bg-zinc-600",
                ].join(" ")}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{step.tool_call.tool}</span>
                  <span className="text-[10px] text-zinc-500">pass {step.pass}</span>
                </div>
                <p className="text-[11px] text-zinc-500">{step.note}</p>
                <pre className="mt-1 max-h-24 overflow-auto rounded-lg bg-black/40 p-2 text-[10px] text-zinc-400">
                  {JSON.stringify(step.tool_call.args, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1">
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:0ms]" />
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:150ms]" />
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:300ms]" />
    </div>
  );
}

function SendIcon() {
  return (
    <svg fill="none" height="18" viewBox="0 0 18 18" width="18">
      <path d="M3 9h12M11 5l4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
