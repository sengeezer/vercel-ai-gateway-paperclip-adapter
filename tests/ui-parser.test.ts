import { describe, expect, it } from "vitest";

import { parseStdoutLine } from "../src/ui-parser.js";

describe("parseStdoutLine", () => {
  it("falls back to stdout for unknown lines", () => {
    expect(parseStdoutLine("not-json", "2026-01-01T00:00:00.000Z")).toEqual([
      { kind: "stdout", ts: "2026-01-01T00:00:00.000Z", text: "not-json" }
    ]);
  });

  it("maps result events", () => {
    const entries = parseStdoutLine(
      JSON.stringify({
        kind: "result",
        ts: "2026-01-01T00:00:00.000Z",
        payload: { finishReason: "stop", inputTokens: 10, outputTokens: 5, cachedInputTokens: 2 }
      }),
      "2026-01-01T00:00:00.000Z"
    );

    expect(entries).toEqual([
      {
        kind: "result",
        ts: "2026-01-01T00:00:00.000Z",
        text: "stop",
        inputTokens: 10,
        outputTokens: 5,
        cachedTokens: 2,
        costUsd: 0,
        subtype: "gateway",
        isError: false,
        errors: []
      }
    ]);
  });
});