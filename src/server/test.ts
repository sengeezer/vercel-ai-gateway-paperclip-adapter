import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult
} from "@paperclipai/adapter-utils";

import { parseConfig } from "./config.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  let config;

  try {
    config = parseConfig(ctx.config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      code: "invalid_config",
      level: "error",
      message
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString()
    };
  }

  checks.push({
    code: "model_ok",
    level: "info",
    message: `Configured model: ${config.model}`
  });

  if (config.gatewayOrder.length > 0) {
    checks.push({
      code: "gateway_order_configured",
      level: "info",
      message: `Gateway order configured for ${config.gatewayOrder.length} provider(s).`
    });
  }

  if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) {
    checks.push({
      code: "missing_auth",
      level: "error",
      message: "Set VERCEL_OIDC_TOKEN or AI_GATEWAY_API_KEY before using this adapter."
    });
  } else if (!process.env.VERCEL_OIDC_TOKEN && process.env.AI_GATEWAY_API_KEY) {
    checks.push({
      code: "api_key_fallback",
      level: "warn",
      message: "Using AI_GATEWAY_API_KEY fallback instead of OIDC."
    });
  } else {
    checks.push({
      code: "oidc_available",
      level: "info",
      message: "VERCEL_OIDC_TOKEN is available."
    });
  }

  if (process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY) {
    checks.push({
      code: "model_discovery_auth_available",
      level: "info",
      message: "Gateway auth is available for live model discovery."
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString()
  };
}