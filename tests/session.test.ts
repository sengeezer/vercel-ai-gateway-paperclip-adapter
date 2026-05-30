import { describe, expect, it } from "vitest";

import {
  appendSessionTurn,
  buildFingerprint,
  createEmptySession,
  hydrateSession
} from "../src/server/session.js";

describe("session helpers", () => {
  it("builds a stable fingerprint", () => {
    const fingerprint = buildFingerprint({ model: "openai/gpt-5.4", promptTemplate: "go" });
    expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
  });

  it("creates an empty session", () => {
    expect(createEmptySession("fp")).toMatchObject({ responseId: null, fingerprint: "fp", messages: [] });
  });

  it("clears mismatched sessions", () => {
    const hydrated = hydrateSession(
      {
        responseId: "resp-1",
        fingerprint: "other",
        messages: [{ role: "user", text: "hello" }],
        updatedAt: new Date().toISOString()
      },
      "expected",
      "best_effort"
    );

    expect(hydrated.canResume).toBe(false);
    expect(hydrated.clearStoredSession).toBe(true);
  });

  it("appends a session turn", () => {
    const session = appendSessionTurn(createEmptySession("fp"), "user", "assistant", "resp-1");
    expect(session.responseId).toBe("resp-1");
    expect(session.messages).toEqual([
      { role: "user", text: "user" },
      { role: "assistant", text: "assistant" }
    ]);
  });
});