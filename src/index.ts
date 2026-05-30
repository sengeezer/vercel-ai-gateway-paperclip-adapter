import { defaultModels } from "./server/models.js";

export const type = "vercel_ai_gateway";
export const label = "Vercel AI Gateway";

export const models = defaultModels;

export const agentConfigurationDoc = `# vercel_ai_gateway configuration

Use when:
- You want Paperclip to call models through Vercel AI Gateway.
- You want provider routing, fallbacks, and usage attribution without binding to one provider SDK.

Don't use when:
- You need a local coding-agent runtime with filesystem-native skill discovery.
- You need a built-in Paperclip adapter instead of a standalone external package.
`;

export { createServerAdapter } from "./server/index.js";