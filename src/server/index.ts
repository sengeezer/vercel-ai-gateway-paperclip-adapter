import type { ServerAdapterModule } from "@paperclipai/adapter-utils";

import { agentConfigurationDoc, models, type } from "../index.js";
import { execute } from "./execute.js";
import { getConfigSchema } from "./config.js";
import { listAvailableModels } from "./models.js";
import { sessionCodec } from "./session.js";
import { testEnvironment } from "./test.js";

export function createServerAdapter(): ServerAdapterModule {
  return {
    type,
    execute,
    testEnvironment,
    sessionCodec,
    getConfigSchema,
    listModels: () => listAvailableModels(),
    refreshModels: () => listAvailableModels({ forceRefresh: true }),
    models,
    agentConfigurationDoc,
    supportsInstructionsBundle: false,
    supportsLocalAgentJwt: false,
    requiresMaterializedRuntimeSkills: false
  };
}