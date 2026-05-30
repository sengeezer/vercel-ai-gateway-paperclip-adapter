import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createGatewayMock } = vi.hoisted(() => ({
  createGatewayMock: vi.fn()
}));

vi.mock("ai", () => ({
  createGateway: createGatewayMock
}));

import { defaultModels, listAvailableModels, normalizeGatewayModels, resetModelCache } from "../src/server/models.js";

describe("model discovery", () => {
  const originalApiKey = process.env.AI_GATEWAY_API_KEY;
  const originalOidc = process.env.VERCEL_OIDC_TOKEN;

  beforeEach(() => {
    createGatewayMock.mockReset();
    resetModelCache();
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
  });

  afterEach(() => {
    resetModelCache();
    if (originalApiKey) process.env.AI_GATEWAY_API_KEY = originalApiKey;
    else delete process.env.AI_GATEWAY_API_KEY;
    if (originalOidc) process.env.VERCEL_OIDC_TOKEN = originalOidc;
    else delete process.env.VERCEL_OIDC_TOKEN;
  });

  it("falls back to packaged defaults without gateway auth", async () => {
    await expect(listAvailableModels()).resolves.toEqual(defaultModels);
    expect(createGatewayMock).not.toHaveBeenCalled();
  });

  it("normalizes discovered gateway models", () => {
    expect(
      normalizeGatewayModels([
        {
          id: "openai/gpt-5.4",
          name: "GPT-5.4",
          specification: { provider: "openai", modelId: "gpt-5.4" }
        },
        {
          id: "anthropic/claude-sonnet-4.6",
          name: "",
          specification: { provider: "anthropic", modelId: "claude-sonnet-4.6" }
        },
        {
          id: "openai/gpt-5.4",
          name: "duplicate",
          specification: { provider: "openai", modelId: "gpt-5.4" }
        }
      ])
    ).toEqual([
      { id: "anthropic/claude-sonnet-4.6", label: "Anthropic claude-sonnet-4.6" },
      { id: "openai/gpt-5.4", label: "GPT-5.4" }
    ]);
  });

  it("uses live gateway metadata when auth is available", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const getAvailableModels = vi.fn(async () => ({
      models: [
        {
          id: "openai/gpt-5.4",
          name: "GPT-5.4",
          specification: { provider: "openai", modelId: "gpt-5.4" }
        }
      ]
    }));
    createGatewayMock.mockReturnValue({ getAvailableModels });

    await expect(listAvailableModels()).resolves.toEqual([
      { id: "openai/gpt-5.4", label: "GPT-5.4" }
    ]);
    expect(createGatewayMock).toHaveBeenCalledTimes(1);
  });
});