import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn()
}));

vi.mock("ai", () => ({
  generateText: generateTextMock
}));

import { execute } from "../src/server/execute.js";

describe("execute", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it("calls generateText and returns structured metadata", async () => {
    generateTextMock.mockResolvedValue({
      text: "Finished the assigned task.",
      reasoningText: "Checked the latest context first.",
      finishReason: "stop",
      warnings: [],
      totalUsage: {
        inputTokens: 25,
        outputTokens: 12,
        cachedInputTokens: 4,
        totalTokens: 37
      },
      response: {
        id: "resp-1",
        modelId: "openai/gpt-5.4",
        messages: []
      }
    });

    const onLog = vi.fn(async () => undefined);
    const result = await execute({
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Gateway Agent",
        adapterType: "vercel_ai_gateway",
        adapterConfig: {}
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null
      },
      config: {},
      context: {},
      onLog
    });

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(onLog).toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.model).toBe("openai/gpt-5.4");
    expect(result.sessionDisplayId).toBe("resp-1");
    expect(result.usage).toEqual({ inputTokens: 25, outputTokens: 12, cachedInputTokens: 4 });
  });
});