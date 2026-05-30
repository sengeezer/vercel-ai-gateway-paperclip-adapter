export type EventKind =
  | "init"
  | "assistant_delta"
  | "assistant_message"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "result"
  | "warning"
  | "error";

export type GatewayAdapterEvent = {
  kind: EventKind;
  ts: string;
  payload: Record<string, unknown>;
};

export function encodeEvent(kind: EventKind, payload: Record<string, unknown>): string {
  return JSON.stringify({ kind, ts: new Date().toISOString(), payload });
}

export async function emitStdoutEvent(
  onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>,
  kind: EventKind,
  payload: Record<string, unknown>
): Promise<void> {
  await onLog("stdout", encodeEvent(kind, payload) + "\n");
}