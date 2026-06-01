import type { AdapterModel } from "@paperclipai/adapter-utils";
import { createGateway } from "ai";

export const defaultModels: AdapterModel[] = [
  { id: "openai/gpt-5.4", label: "OpenAI GPT-5.4" },
  { id: "amazon/nova-micro", label: "Amazon Nova Micro" },
  { id: "anthropic/claude-sonnet-4.6", label: "Anthropic Claude Sonnet 4.6" }
];

const CHEAP_MODEL_CANDIDATES = [
  "amazon/nova-micro",
  "openai/gpt-5.1-mini",
  "openai/gpt-5.4-mini",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "anthropic/claude-haiku-4.5"
];

type GatewayModelMetadata = {
  id: string;
  name: string;
  specification?: {
    provider?: string;
    modelId?: string;
  };
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedModels: AdapterModel[] | null = null;
let cachedAt = 0;

function hasGatewayAuth(): boolean {
  return Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
}

function titleCaseSegment(value: string): string {
  return value
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildLabel(id: string, name: string): string {
  const trimmedName = name.trim();
  if (trimmedName.length > 0) return trimmedName;

  const [provider, modelId] = id.split("/", 2);
  if (!provider || !modelId) return id;
  return `${titleCaseSegment(provider)} ${modelId}`;
}

export function normalizeGatewayModels(models: GatewayModelMetadata[]): AdapterModel[] {
  const deduped = new Map<string, AdapterModel>();

  for (const model of models) {
    const preferredId = model.id.trim();
    const specificationId =
      model.specification?.provider && model.specification?.modelId
        ? `${model.specification.provider}/${model.specification.modelId}`
        : "";
    const id = preferredId || specificationId;

    if (!id || deduped.has(id)) continue;

    deduped.set(id, {
      id,
      label: buildLabel(id, model.name)
    });
  }

  return Array.from(deduped.values()).sort((left, right) => left.label.localeCompare(right.label));
}

export async function listAvailableModels(options?: { forceRefresh?: boolean }): Promise<AdapterModel[]> {
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();

  if (!forceRefresh && cachedModels && now - cachedAt < CACHE_TTL_MS) {
    return cachedModels;
  }

  if (!hasGatewayAuth()) {
    cachedModels = defaultModels;
    cachedAt = now;
    return defaultModels;
  }

  try {
    const gateway = createGateway();
    const metadata = await gateway.getAvailableModels();
    const discovered = normalizeGatewayModels(metadata.models as GatewayModelMetadata[]);
    cachedModels = discovered.length > 0 ? discovered : defaultModels;
    cachedAt = now;
    return cachedModels;
  } catch {
    cachedModels = defaultModels;
    cachedAt = now;
    return defaultModels;
  }
}

export function selectCheapModel(models: AdapterModel[]): string {
  for (const candidate of CHEAP_MODEL_CANDIDATES) {
    if (models.some((model) => model.id === candidate)) {
      return candidate;
    }
  }

  const heuristicMatch = models.find((model) => /\b(micro|mini|nano|flash|haiku|lite)\b/i.test(model.id));
  if (heuristicMatch) {
    return heuristicMatch.id;
  }

  return models[0]?.id ?? defaultModels[0].id;
}

export function resetModelCache(): void {
  cachedModels = null;
  cachedAt = 0;
}