"use client";

import { FormEvent, useEffect, useRef, useState, startTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createConversation, getStore, renameConversation, StoredConversation, StoredMessage } from "../lib/client-db";
import { ChatMessage, fetchModels, streamChatCompletion } from "../lib/openai-client";

type UiMessage = StoredMessage;

const DEFAULT_MODEL = "gpt-5.5";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [dbLabel, setDbLabel] = useState("Starting local SQLite...");
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [models, setModels] = useState<string[]>([DEFAULT_MODEL]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const store = await getStore();
        if (cancelled) return;
        setDbLabel(store.driverLabel);
        const loaded = await store.listConversations();
        if (cancelled) return;
        if (loaded.length === 0) {
          const first = createConversation(model);
          await store.saveConversation(first, []);
          setConversations([first]);
          setActiveId(first.id);
        } else {
          setConversations(loaded);
          setActiveId(loaded[0].id);
          setModel(loaded[0].model || DEFAULT_MODEL);
        }
        setReady(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not initialize local storage.");
      }
    }
    boot();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetchModels().then((items) => {
      if (items.length > 0) {
        setModels(items);
        setModel((current) => items.includes(current) ? current : items[0]);
      }
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Could not load models from the wrapper.");
    });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    getStore().then(async (store) => {
      const nextMessages = await store.getMessages(activeId);
      if (!cancelled) setMessages(nextMessages);
    });
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  async function persist(nextConversation: StoredConversation, nextMessages: UiMessage[]) {
    const store = await getStore();
    await store.saveConversation(nextConversation, nextMessages);
    const nextConversations = await store.listConversations();
    setConversations(nextConversations);
  }

  async function handleNewChat() {
    const conversation = createConversation(model);
    await persist(conversation, []);
    setActiveId(conversation.id);
    setMessages([]);
    setInput("");
    setError(null);
  }

  async function handleDeleteConversation(id: string) {
    const store = await getStore();
    await store.deleteConversation(id);
    const remaining = await store.listConversations();
    if (remaining.length === 0) {
      const conversation = createConversation(model);
      await store.saveConversation(conversation, []);
      setConversations([conversation]);
      setActiveId(conversation.id);
      setMessages([]);
      return;
    }
    setConversations(remaining);
    if (activeId === id) setActiveId(remaining[0].id);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || isSending || !activeId) return;

    setInput("");
    setIsSending(true);
    setError(null);

    const now = Date.now();
    const userMessage: UiMessage = { id: crypto.randomUUID(), conversationId: activeId, role: "user", content: prompt, createdAt: now, seq: messages.length };
    const assistantMessage: UiMessage = { id: crypto.randomUUID(), conversationId: activeId, role: "assistant", content: "", createdAt: now + 1, seq: messages.length + 1 };
    const optimistic = [...messages, userMessage, assistantMessage];
    setMessages(optimistic);

    const currentConversation = conversations.find((item) => item.id === activeId) ?? createConversation(model, activeId);
    const titled = currentConversation.title === "New conversation" ? renameConversation(currentConversation, titleFrom(prompt)) : currentConversation;
    const updatedConversation = { ...titled, model, updatedAt: Date.now() };
    await persist(updatedConversation, optimistic);

    let assistantText = "";
    try {
      const chatMessages: ChatMessage[] = optimistic
        .filter((message) => message.role !== "assistant" || message.content.trim())
        .map((message) => ({ role: message.role, content: message.content }));

      await streamChatCompletion({ model, messages: chatMessages }, (delta) => {
        assistantText += delta;
        startTransition(() => {
          setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, content: assistantText } : message));
        });
      });

      const finalMessages = optimistic.map((message) => message.id === assistantMessage.id ? { ...message, content: assistantText || "No response." } : message);
      setMessages(finalMessages);
      await persist({ ...updatedConversation, updatedAt: Date.now() }, finalMessages);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The wrapper request failed.";
      setError(message);
      const finalMessages = optimistic.map((item) => item.id === assistantMessage.id ? { ...item, content: `Request failed: ${message}` } : item);
      setMessages(finalMessages);
      await persist({ ...updatedConversation, updatedAt: Date.now() }, finalMessages);
    } finally {
      setIsSending(false);
    }
  }

  const activeConversation = conversations.find((conversation) => conversation.id === activeId);

  return (
    <main className="min-h-screen px-3 py-3 text-neutral-950 sm:px-5 sm:py-5">
      <div className="mx-auto grid h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-black/10 bg-white/45 shadow-[0_30px_90px_rgba(0,0,0,0.10)] backdrop-blur-2xl sm:h-[calc(100vh-2.5rem)] lg:grid-cols-[19rem_1fr]">
        <aside className="hidden border-r border-black/10 bg-white/55 p-4 lg:flex lg:flex-col">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Local</p>
              <h1 className="text-2xl font-semibold tracking-tight">Codex Chat</h1>
            </div>
            <button onClick={handleNewChat} className="rounded-full bg-neutral-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800">New</button>
          </div>
          <div className="mb-4 rounded-2xl border border-black/10 bg-white/60 p-3">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Model</label>
            <select value={model} onChange={(event) => setModel(event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500">
              {models.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {conversations.map((conversation) => (
              <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`group w-full rounded-2xl border p-3 text-left transition ${conversation.id === activeId ? "border-black/10 bg-neutral-950 text-white shadow-lg" : "border-transparent bg-white/45 hover:border-black/10 hover:bg-white"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{conversation.title}</p>
                    <p className={`mt-1 truncate text-xs ${conversation.id === activeId ? "text-white/60" : "text-neutral-500"}`}>{conversation.model}</p>
                  </div>
                  <span onClick={(event) => { event.stopPropagation(); handleDeleteConversation(conversation.id); }} className={`rounded-full px-2 text-xs opacity-0 transition group-hover:opacity-100 ${conversation.id === activeId ? "text-white/60 hover:text-white" : "text-neutral-400 hover:text-neutral-900"}`}>x</span>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-neutral-500">{dbLabel}. No login, no server-side chat history.</p>
        </aside>

        <section className="flex min-h-0 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-black/10 bg-white/50 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-500">{activeConversation?.model ?? model}</p>
              <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{activeConversation?.title ?? "New conversation"}</h2>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <select value={model} onChange={(event) => setModel(event.target.value)} className="max-w-36 rounded-full border border-black/10 bg-white px-3 py-2 text-sm outline-none">
                {models.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button onClick={handleNewChat} className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white">New</button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {!ready && <CenteredNote title="Preparing your local chat" detail="Loading the browser SQLite database." />}
            {ready && messages.length === 0 && <CenteredNote title="What should we build today?" detail="Choose a model, ask anything, and your conversations stay on this machine." />}
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
              {isSending && messages.at(-1)?.role !== "assistant" && <div className="text-sm text-neutral-500">Thinking...</div>}
              <div ref={bottomRef} />
            </div>
          </div>

          <footer className="border-t border-black/10 bg-white/55 p-3 backdrop-blur-xl sm:p-5">
            {error && <div className="mx-auto mb-3 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-[1.7rem] border border-black/10 bg-white p-2 shadow-sm">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Message Codex Chat" rows={1} className="max-h-40 min-h-11 flex-1 resize-none rounded-[1.25rem] bg-transparent px-3 py-3 text-[15px] leading-6 outline-none placeholder:text-neutral-400" />
              <button disabled={!input.trim() || isSending || !ready} className="mb-0.5 rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300">{isSending ? "Sending" : "Send"}</button>
            </form>
          </footer>
        </section>
      </div>
    </main>
  );
}

function CenteredNote({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
      <div className="mb-5 h-14 w-14 rounded-3xl bg-gradient-to-br from-white to-neutral-200 shadow-inner" />
      <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-500">{detail}</p>
    </div>
  );
}

function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <article className={`max-w-[88%] rounded-[1.55rem] px-4 py-3 text-[15px] leading-7 shadow-sm sm:max-w-[78%] ${isUser ? "whitespace-pre-wrap bg-neutral-950 text-white" : "border border-black/10 bg-white/75 text-neutral-950"}`}>
        {message.content ? (
          isUser ? message.content : <MarkdownMessage content={message.content} />
        ) : <span className="text-neutral-400">Thinking...</span>}
      </article>
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="pl-1">{children}</li>,
        a: ({ children, href }) => <a className="font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2" href={href} target="_blank" rel="noreferrer">{children}</a>,
        code: ({ children, className }) => className ? <code className={className}>{children}</code> : <code className="rounded-md bg-black/5 px-1.5 py-0.5 font-mono text-[0.92em]">{children}</code>,
        pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded-2xl bg-neutral-950 p-4 text-sm leading-6 text-white last:mb-0">{children}</pre>,
        blockquote: ({ children }) => <blockquote className="mb-3 border-l-2 border-black/20 pl-4 text-neutral-600 last:mb-0">{children}</blockquote>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function titleFrom(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 48) || "New conversation";
}
