import type { AdapterExecutionContext, AdapterExecutionResult, UsageSummary } from "@paperclipai/adapter-utils";
import { renderTemplate } from "@paperclipai/adapter-utils/server-utils";
import { generateText, type ModelMessage } from "ai";

import { type } from "../index.js";
import { parseConfig } from "./config.js";
import { emitStdoutEvent } from "./events.js";
import { appendSessionTurn, buildFingerprint, hydrateSession } from "./session.js";

function buildPromptData(ctx: AdapterExecutionContext) {
  return {
    agentId: ctx.agent.id,
    agentName: ctx.agent.name,
    companyId: ctx.agent.companyId,
    runId: ctx.runId,
    sessionId: ctx.runtime.sessionId,
    sessionDisplayId: ctx.runtime.sessionDisplayId,
    taskKey: ctx.runtime.taskKey,
    context: ctx.context,
    agent: ctx.agent,
    runtime: ctx.runtime,
    run: {
      id: ctx.runId,
      taskKey: ctx.runtime.taskKey,
      context: ctx.context
    }
  };
}

function toModelMessage(message: { role: "user" | "assistant" | "system"; text: string }): ModelMessage {
  return {
    role: message.role,
    content: message.text
  };
}

function buildProviderOptions(config: ReturnType<typeof parseConfig>): Record<string, unknown> | undefined {
  const gateway: Record<string, unknown> = {};
  if (config.gatewayOrder.length > 0) gateway.order = config.gatewayOrder;
  if (config.gatewayOnly.length > 0) gateway.only = config.gatewayOnly;
  if (config.gatewaySort) gateway.sort = config.gatewaySort;
  if (config.fallbackModels.length > 0) gateway.models = config.fallbackModels;
  if (config.gatewayTags.length > 0) gateway.tags = config.gatewayTags;
  if (config.gatewayUser) gateway.user = config.gatewayUser;
  if (config.gatewayCaching) gateway.caching = config.gatewayCaching;
  if (config.byok) gateway.byok = config.byok;

  const providerOptions: Record<string, unknown> = { ...config.providerOptions };
  if (Object.keys(gateway).length > 0) {
    const existingGateway =
      providerOptions.gateway && typeof providerOptions.gateway === "object" && !Array.isArray(providerOptions.gateway)
        ? (providerOptions.gateway as Record<string, unknown>)
        : {};
    providerOptions.gateway = { ...existingGateway, ...gateway };
  }

  return Object.keys(providerOptions).length > 0 ? providerOptions : undefined;
}

function buildUsage(result: Awaited<ReturnType<typeof generateText>>): UsageSummary {
  return {
    inputTokens: result.totalUsage.inputTokens ?? 0,
    outputTokens: result.totalUsage.outputTokens ?? 0,
    cachedInputTokens: result.totalUsage.cachedInputTokens ?? undefined
  };
}

function summarizeText(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 400) : null;
}

function getWarningMessage(warning: Record<string, unknown>): string {
  if (typeof warning.message === "string" && warning.message.trim().length > 0) {
    return warning.message;
  }
  if (typeof warning.details === "string" && warning.details.trim().length > 0) {
    return warning.details;
  }
  if (typeof warning.feature === "string" && warning.feature.trim().length > 0) {
    return `Unsupported feature: ${warning.feature}`;
  }
  return "Provider warning";
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const config = parseConfig(ctx.config);
  const fingerprint = buildFingerprint({
    model: config.model,
    promptTemplate: config.promptTemplate,
    systemPrompt: config.systemPrompt,
    gatewayOrder: config.gatewayOrder,
    gatewayOnly: config.gatewayOnly,
    gatewaySort: config.gatewaySort,
    fallbackModels: config.fallbackModels
  });
  const hydrated = hydrateSession(ctx.runtime.sessionParams, fingerprint, config.resumeMode);
  const prompt = renderTemplate(config.promptTemplate, buildPromptData(ctx));
  const messages: ModelMessage[] = hydrated.canResume
    ? hydrated.session.messages.map(toModelMessage)
    : [];
  messages.push({ role: "user", content: prompt });

  await ctx.onMeta?.({
    adapterType: type,
    command: "ai.generateText",
    prompt,
    promptMetrics: {
      promptChars: prompt.length,
      historyMessages: messages.length - 1
    },
    context: {
      model: config.model,
      resumeMode: config.resumeMode,
      resumed: hydrated.canResume,
      gatewayOrder: config.gatewayOrder,
      gatewayOnly: config.gatewayOnly,
      fallbackModels: config.fallbackModels
    }
  });

  await emitStdoutEvent(ctx.onLog, "init", {
    adapterType: type,
    model: config.model,
    runId: ctx.runId,
    resumed: hydrated.canResume
  });

  try {
    const result = await generateText({
      model: config.model,
      system: config.systemPrompt,
      messages,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      providerOptions: buildProviderOptions(config) as never,
      timeout: config.timeoutMs
    });

    if (result.reasoningText) {
      await emitStdoutEvent(ctx.onLog, "thinking", { text: result.reasoningText });
    }

    if (result.text.trim().length > 0) {
      await emitStdoutEvent(ctx.onLog, "assistant_message", { text: result.text });
    }

    for (const warning of result.warnings ?? []) {
      await emitStdoutEvent(ctx.onLog, "warning", {
        type: warning.type,
        message: getWarningMessage(warning as Record<string, unknown>)
      });
    }

    await emitStdoutEvent(ctx.onLog, "result", {
      finishReason: result.finishReason,
      responseId: result.response.id,
      modelId: result.response.modelId,
      inputTokens: result.totalUsage.inputTokens ?? 0,
      outputTokens: result.totalUsage.outputTokens ?? 0,
      cachedInputTokens: result.totalUsage.cachedInputTokens ?? 0,
      totalTokens: result.totalUsage.totalTokens ?? 0
    });

    const nextSession =
      config.resumeMode === "best_effort"
        ? appendSessionTurn(hydrated.session, prompt, result.text, result.response.id)
        : null;

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      clearSession: hydrated.clearStoredSession || config.resumeMode === "off",
      usage: buildUsage(result),
      sessionParams: nextSession,
      sessionDisplayId: result.response.id,
      provider: "vercel_ai_gateway",
      model: result.response.modelId || config.model,
      resultJson: {
        finishReason: result.finishReason,
        warnings: result.warnings ?? [],
        responseId: result.response.id,
        totalTokens: result.totalUsage.totalTokens ?? 0,
        metadata: config.metadata
      },
      summary: summarizeText(result.text)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await emitStdoutEvent(ctx.onLog, "error", { message });
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      clearSession: hydrated.clearStoredSession,
      errorMessage: message,
      provider: "vercel_ai_gateway",
      model: config.model,
      resultJson: { error: message }
    };
  }
}