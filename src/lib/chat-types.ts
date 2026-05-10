import type { AiEditResponse, AppliedToolCall, PageConfig } from "./page-config";

export type AiActivityEvent = {
  type: "status" | "decision" | "tool" | "retry" | "done" | "error";
  label: string;
  detail?: string;
  data?: unknown;
  ts?: number;
};

export type ChatMessageUser = {
  role: "user";
  id: string;
  content: string;
  timestamp: number;
};

export type ChatMessageAssistant = {
  role: "assistant";
  id: string;
  content: string;
  timestamp: number;
  toolCalls: AiEditResponse["tool_calls"];
  flow: AppliedToolCall[];
  activity?: AiActivityEvent[];
  aiRequests: number;
  maxAiRequests: number;
  totalRetries: number;
  configSnapshot: PageConfig;
};

export type ChatMessageSystem = {
  role: "system";
  id: string;
  content: string;
  timestamp: number;
};

export type ChatMessage = ChatMessageUser | ChatMessageAssistant | ChatMessageSystem;

export type ChatHistory = ChatMessage[];

let nextId = 0;
export function makeChatId() {
  nextId += 1;
  return `msg-${Date.now()}-${nextId}`;
}
