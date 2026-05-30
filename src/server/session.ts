import { createHash } from "node:crypto";

import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

const MAX_SESSION_MESSAGES = 12;
const MAX_MESSAGE_TEXT = 12000;

export type GatewaySessionMessage = {
  role: "user" | "assistant" | "system";
  text: string;
};

export type GatewaySessionState = {
  responseId: string | null;
  fingerprint: string;
  messages: GatewaySessionMessage[];
  updatedAt: string;
};

export type SessionHydration = {
  session: GatewaySessionState;
  canResume: boolean;
  clearStoredSession: boolean;
};

export function buildFingerprint(input: {
  model: string;
  promptTemplate: string;
  systemPrompt?: string;
  gatewayOrder?: string[];
  gatewayOnly?: string[];
  gatewaySort?: string;
  fallbackModels?: string[];
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        model: input.model,
        promptTemplate: input.promptTemplate,
        systemPrompt: input.systemPrompt ?? null,
        gatewayOrder: input.gatewayOrder ?? [],
        gatewayOnly: input.gatewayOnly ?? [],
        gatewaySort: input.gatewaySort ?? null,
        fallbackModels: input.fallbackModels ?? []
      })
    )
    .digest("hex")
    .slice(0, 16);
}

export function createEmptySession(fingerprint: string): GatewaySessionState {
  return {
    responseId: null,
    fingerprint,
    messages: [],
    updatedAt: new Date().toISOString()
  };
}

function normalizeMessage(raw: unknown): GatewaySessionMessage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const role =
    (raw as { role?: unknown }).role === "user" ||
    (raw as { role?: unknown }).role === "assistant" ||
    (raw as { role?: unknown }).role === "system"
      ? ((raw as { role: GatewaySessionMessage["role"] }).role)
      : null;
  const text = typeof (raw as { text?: unknown }).text === "string" ? (raw as { text: string }).text.trim() : "";
  if (!role || text.length === 0) return null;
  return { role, text: text.slice(0, MAX_MESSAGE_TEXT) };
}

export function normalizeSessionState(raw: unknown): GatewaySessionState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const fingerprint = typeof record.fingerprint === "string" ? record.fingerprint.trim() : "";
  if (fingerprint.length === 0) return null;
  const messages = Array.isArray(record.messages)
    ? record.messages.map(normalizeMessage).filter((entry): entry is GatewaySessionMessage => entry !== null)
    : [];
  const responseId = typeof record.responseId === "string" && record.responseId.trim().length > 0
    ? record.responseId.trim()
    : null;
  const updatedAt = typeof record.updatedAt === "string" && record.updatedAt.trim().length > 0
    ? record.updatedAt
    : new Date(0).toISOString();

  return {
    responseId,
    fingerprint,
    messages: messages.slice(-MAX_SESSION_MESSAGES),
    updatedAt
  };
}

export function hydrateSession(
  raw: unknown,
  fingerprint: string,
  resumeMode: "off" | "best_effort"
): SessionHydration {
  const normalized = normalizeSessionState(raw);
  if (resumeMode === "off") {
    return {
      session: createEmptySession(fingerprint),
      canResume: false,
      clearStoredSession: normalized !== null
    };
  }

  if (!raw) {
    return {
      session: createEmptySession(fingerprint),
      canResume: false,
      clearStoredSession: false
    };
  }

  if (!normalized) {
    return {
      session: createEmptySession(fingerprint),
      canResume: false,
      clearStoredSession: true
    };
  }

  if (normalized.fingerprint !== fingerprint) {
    return {
      session: createEmptySession(fingerprint),
      canResume: false,
      clearStoredSession: true
    };
  }

  return {
    session: normalized,
    canResume: normalized.messages.length > 0,
    clearStoredSession: false
  };
}

export function appendSessionTurn(
  session: GatewaySessionState,
  userText: string,
  assistantText: string,
  responseId: string | null
): GatewaySessionState {
  const nextMessages: GatewaySessionMessage[] = [
    ...session.messages,
    { role: "user" as const, text: userText.slice(0, MAX_MESSAGE_TEXT) },
    { role: "assistant" as const, text: assistantText.slice(0, MAX_MESSAGE_TEXT) }
  ].slice(-MAX_SESSION_MESSAGES);

  return {
    responseId,
    fingerprint: session.fingerprint,
    messages: nextMessages,
    updatedAt: new Date().toISOString()
  };
}

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw) {
    const normalized = normalizeSessionState(raw);
    return normalized ? (normalized as unknown as Record<string, unknown>) : null;
  },
  serialize(params) {
    const normalized = normalizeSessionState(params);
    return normalized ? (normalized as unknown as Record<string, unknown>) : null;
  },
  getDisplayId(params) {
    const normalized = normalizeSessionState(params);
    return normalized?.responseId ?? null;
  }
};