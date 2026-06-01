import { describe, expect, it } from "vitest";

import { getConfigSchema, parseConfig } from "../src/server/config.js";

describe("parseConfig", () => {
  it("applies defaults", () => {
    const config = parseConfig({});
    expect(config.model).toBe("openai/gpt-5.4");
    expect(config.resumeMode).toBe("best_effort");
  });

  it("parses gateway arrays and JSON fields", () => {
    const config = parseConfig({
      gatewayOrder: "openai, anthropic",
      gatewayTags: ["feature:paperclip"],
      providerOptionsJson: JSON.stringify({ openai: { reasoningEffort: "high" } }),
      metadataJson: JSON.stringify({ task: "demo" })
    });

    expect(config.gatewayOrder).toEqual(["openai", "anthropic"]);
    expect(config.gatewayTags).toEqual(["feature:paperclip"]);
    expect(config.providerOptions).toEqual({ openai: { reasoningEffort: "high" } });
    expect(config.metadata).toEqual({ task: "demo" });
  });

  it("rejects invalid providerOptionsJson", () => {
    expect(() => parseConfig({ providerOptionsJson: "[]" })).toThrow(
      "providerOptionsJson must parse to a JSON object."
    );
  });

  it("exposes explicit field defaults for create-mode UI", async () => {
    const schema = await getConfigSchema();
    const defaults = Object.fromEntries(schema.fields.map((field) => [field.key, field.default]));

    expect(defaults.model).toBe("openai/gpt-5.4");
    expect(defaults.promptTemplate).toBe("Continue the assigned work.");
    expect(defaults.resumeMode).toBe("best_effort");
    expect(defaults.timeoutMs).toBe(120000);
  });
});