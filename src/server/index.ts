import type { AdapterModelProfileDefinition, ServerAdapterModule } from "@paperclipai/adapter-utils";

import { agentConfigurationDoc, models, type } from "../index.js";
import { execute } from "./execute.js";
import { getConfigSchema } from "./config.js";
import { listAvailableModels, selectCheapModel } from "./models.js";
import { sessionCodec } from "./session.js";
import { testEnvironment } from "./test.js";

async function listModelProfiles(): Promise<AdapterModelProfileDefinition[]> {
  const availableModels = await listAvailableModels();
  const cheapModel = selectCheapModel(availableModels);

  if (!cheapModel) {
    return [];
  }

  return [
    {
      key: "cheap",
      label: "Cheap",
      description: "Lower-cost model used for cheap-profile runs such as summaries or background work.",
      adapterConfig: { model: cheapModel },
      source: "adapter_default"
    }
  ];
}

export function createServerAdapter(): ServerAdapterModule {
  return {
    type,
    execute,
    testEnvironment,
    sessionCodec,
    getConfigSchema,
    listModels: () => listAvailableModels(),
    refreshModels: () => listAvailableModels({ forceRefresh: true }),
    listModelProfiles,
    models,
    agentConfigurationDoc,
    supportsInstructionsBundle: false,
    supportsLocalAgentJwt: false,
    requiresMaterializedRuntimeSkills: false
  };
}