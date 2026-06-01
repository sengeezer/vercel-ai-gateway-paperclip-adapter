import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";
import { z } from "zod";

import { listAvailableModels } from "./models.js";

type GatewaySort = "cost" | "ttft" | "tps";
type GatewayCaching = "auto";

const MODEL_PATTERN = /^[^/\s]+\/[^/\s].+$/;
const DEFAULT_MODEL = "openai/gpt-5.4";
const DEFAULT_PROMPT_TEMPLATE = "Continue the assigned work.";
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_RESUME_MODE = "best_effort" as const;

const rawConfigSchema = z.object({
  model: z
    .string()
    .trim()
    .min(1)
    .refine((value) => MODEL_PATTERN.test(value), "Model must use provider/model format.")
    .default(DEFAULT_MODEL),
  promptTemplate: z.string().trim().min(1).default(DEFAULT_PROMPT_TEMPLATE),
  systemPrompt: z.string().trim().optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxOutputTokens: z.coerce.number().int().positive().optional(),
  reasoningEffort: z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]).optional(),
  timeoutMs: z.coerce.number().int().positive().default(DEFAULT_TIMEOUT_MS),
  resumeMode: z.enum(["off", "best_effort"]).default(DEFAULT_RESUME_MODE),
  gatewayOrder: z.union([z.string(), z.array(z.string())]).optional(),
  gatewayOnly: z.union([z.string(), z.array(z.string())]).optional(),
  gatewaySort: z.enum(["cost", "ttft", "tps"]).optional(),
  fallbackModels: z.union([z.string(), z.array(z.string())]).optional(),
  gatewayTags: z.union([z.string(), z.array(z.string())]).optional(),
  gatewayUser: z.string().trim().optional(),
  gatewayCaching: z.enum(["auto"]).optional(),
  providerOptionsJson: z.string().trim().optional(),
  byokJson: z.string().trim().optional(),
  metadataJson: z.string().trim().optional(),
  enableLiveModelList: z.union([z.boolean(), z.string()]).optional().default(false),
  staticModelsJson: z.string().trim().optional()
});

export type GatewayStaticModel = {
  id: string;
  label: string;
};

export type GatewayAdapterConfig = {
  model: string;
  promptTemplate: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  timeoutMs: number;
  resumeMode: "off" | "best_effort";
  gatewayOrder: string[];
  gatewayOnly: string[];
  gatewaySort?: GatewaySort;
  fallbackModels: string[];
  gatewayTags: string[];
  gatewayUser?: string;
  gatewayCaching?: GatewayCaching;
  providerOptions: Record<string, unknown>;
  byok?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  enableLiveModelList: boolean;
  staticModels: GatewayStaticModel[];
};

function parseStringArray(input: string | string[] | undefined): string[] {
  if (!input) return [];
  const values = Array.isArray(input) ? input : input.split(/[\n,]/g);
  return values.map((value) => value.trim()).filter(Boolean);
}

function parseBoolean(input: boolean | string): boolean {
  if (typeof input === "boolean") return input;
  return input.trim().toLowerCase() === "true";
}

function parseJsonRecord(fieldName: string, input: string | undefined): Record<string, unknown> {
  if (!input) return {};
  const parsed = JSON.parse(input);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must parse to a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function parseOptionalJsonRecord(
  fieldName: string,
  input: string | undefined
): Record<string, unknown> | undefined {
  const parsed = parseJsonRecord(fieldName, input);
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

function parseStaticModels(input: string | undefined): GatewayStaticModel[] {
  if (!input) return [];
  const parsed = JSON.parse(input);
  if (!Array.isArray(parsed)) {
    throw new Error("staticModelsJson must parse to an array.");
  }

  return parsed
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id.trim() : "",
      label: typeof entry.label === "string" ? entry.label.trim() : ""
    }))
    .filter((entry) => entry.id.length > 0 && entry.label.length > 0);
}

export function parseConfig(input: unknown): GatewayAdapterConfig {
  const raw = rawConfigSchema.parse(input ?? {});

  return {
    model: raw.model,
    promptTemplate: raw.promptTemplate,
    systemPrompt: raw.systemPrompt,
    temperature: raw.temperature,
    maxOutputTokens: raw.maxOutputTokens,
    reasoningEffort: raw.reasoningEffort,
    timeoutMs: raw.timeoutMs,
    resumeMode: raw.resumeMode,
    gatewayOrder: parseStringArray(raw.gatewayOrder),
    gatewayOnly: parseStringArray(raw.gatewayOnly),
    gatewaySort: raw.gatewaySort,
    fallbackModels: parseStringArray(raw.fallbackModels),
    gatewayTags: parseStringArray(raw.gatewayTags),
    gatewayUser: raw.gatewayUser,
    gatewayCaching: raw.gatewayCaching,
    providerOptions: parseJsonRecord("providerOptionsJson", raw.providerOptionsJson),
    byok: parseOptionalJsonRecord("byokJson", raw.byokJson),
    metadata: parseJsonRecord("metadataJson", raw.metadataJson),
    enableLiveModelList: parseBoolean(raw.enableLiveModelList),
    staticModels: parseStaticModels(raw.staticModelsJson)
  };
}

export async function getConfigSchema(): Promise<AdapterConfigSchema> {
  const availableModels = await listAvailableModels();

  return {
    fields: [
      {
        key: "model",
        label: "Model",
        type: "combobox",
        default: DEFAULT_MODEL,
        required: true,
        group: "Model",
        hint: "Provider/model id routed through Vercel AI Gateway.",
        options: availableModels.map((model) => ({
          label: model.label,
          value: model.id,
          group: model.id.split("/", 1)[0]
        }))
      },
      {
        key: "promptTemplate",
        label: "Prompt Template",
        type: "textarea",
        default: DEFAULT_PROMPT_TEMPLATE,
        required: true,
        group: "Model"
      },
      { key: "systemPrompt", label: "System Prompt", type: "textarea", group: "Generation" },
      { key: "temperature", label: "Temperature", type: "number", group: "Generation" },
      { key: "maxOutputTokens", label: "Max Output Tokens", type: "number", group: "Generation" },
      {
        key: "reasoningEffort",
        label: "Reasoning Effort",
        type: "select",
        group: "Generation",
        options: [
          { label: "none", value: "none" },
          { label: "minimal", value: "minimal" },
          { label: "low", value: "low" },
          { label: "medium", value: "medium" },
          { label: "high", value: "high" },
          { label: "xhigh", value: "xhigh" }
        ]
      },
      { key: "gatewayOrder", label: "Gateway Order", type: "text", group: "Gateway Routing", hint: "Comma-separated providers." },
      { key: "gatewayOnly", label: "Gateway Only", type: "text", group: "Gateway Routing", hint: "Comma-separated providers." },
      {
        key: "gatewaySort",
        label: "Gateway Sort",
        type: "select",
        group: "Gateway Routing",
        options: [
          { label: "cost", value: "cost" },
          { label: "ttft", value: "ttft" },
          { label: "tps", value: "tps" }
        ]
      },
      {
        key: "fallbackModels",
        label: "Fallback Models",
        type: "text",
        group: "Gateway Routing",
        hint: "Comma-separated provider/model ids."
      },
      { key: "gatewayTags", label: "Gateway Tags", type: "text", group: "Gateway Routing", hint: "Comma-separated tags." },
      { key: "gatewayUser", label: "Gateway User", type: "text", group: "Gateway Routing" },
      {
        key: "gatewayCaching",
        label: "Gateway Caching",
        type: "select",
        group: "Gateway Routing",
        options: [{ label: "auto", value: "auto" }]
      },
      {
        key: "resumeMode",
        label: "Resume Mode",
        type: "select",
        group: "Resume",
        default: DEFAULT_RESUME_MODE,
        options: [
          { label: "off", value: "off" },
          { label: "best_effort", value: "best_effort" }
        ]
      },
      { key: "timeoutMs", label: "Timeout (ms)", type: "number", group: "Generation", default: DEFAULT_TIMEOUT_MS },
      { key: "providerOptionsJson", label: "Provider Options JSON", type: "textarea", group: "Advanced JSON" },
      { key: "byokJson", label: "BYOK JSON", type: "textarea", group: "Advanced JSON" },
      { key: "metadataJson", label: "Metadata JSON", type: "textarea", group: "Advanced JSON" }
    ]
  };
}