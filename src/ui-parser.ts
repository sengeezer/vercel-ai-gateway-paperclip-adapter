import type { TranscriptEntry } from "@paperclipai/adapter-utils";

type ParsedEvent = {
  kind: string;
  ts?: string;
  payload?: Record<string, unknown>;
};

function parseLine(line: string): ParsedEvent | null {
  try {
    const parsed = JSON.parse(line) as ParsedEvent;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = parseLine(line);
  if (!parsed) {
    return [{ kind: "stdout", ts, text: line }];
  }

  const eventTs = typeof parsed.ts === "string" ? parsed.ts : ts;
  const payload = parsed.payload ?? {};

  switch (parsed.kind) {
    case "init":
      return [{
        kind: "init",
        ts: eventTs,
        model: typeof payload.model === "string" ? payload.model : "unknown",
        sessionId: typeof payload.runId === "string" ? payload.runId : "unknown"
      }];
    case "assistant_delta":
      return [{
        kind: "assistant",
        ts: eventTs,
        text: typeof payload.text === "string" ? payload.text : "",
        delta: true
      }];
    case "assistant_message":
      return [{
        kind: "assistant",
        ts: eventTs,
        text: typeof payload.text === "string" ? payload.text : ""
      }];
    case "thinking":
      return [{
        kind: "thinking",
        ts: eventTs,
        text: typeof payload.text === "string" ? payload.text : ""
      }];
    case "result":
      return [{
        kind: "result",
        ts: eventTs,
        text: typeof payload.finishReason === "string" ? payload.finishReason : "completed",
        inputTokens: typeof payload.inputTokens === "number" ? payload.inputTokens : 0,
        outputTokens: typeof payload.outputTokens === "number" ? payload.outputTokens : 0,
        cachedTokens: typeof payload.cachedInputTokens === "number" ? payload.cachedInputTokens : 0,
        costUsd: typeof payload.costUsd === "number" ? payload.costUsd : 0,
        subtype: "gateway",
        isError: false,
        errors: []
      }];
    case "warning":
      return [{
        kind: "system",
        ts: eventTs,
        text: typeof payload.message === "string" ? payload.message : line
      }];
    case "error":
      return [{
        kind: "stderr",
        ts: eventTs,
        text: typeof payload.message === "string" ? payload.message : line
      }];
    default:
      return [{ kind: "stdout", ts: eventTs, text: line }];
  }
}