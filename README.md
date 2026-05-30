# Vercel AI Gateway Paperclip Adapter

Standalone external adapter package for Paperclip that routes model calls through Vercel AI Gateway.

## Status

Working standalone adapter package with:

- `ai@6` text generation through Vercel AI Gateway
- schema-driven Paperclip config UI
- dependency-free external `ui-parser`
- best-effort session resume via adapter-owned `sessionParams`
- live model discovery when Paperclip or the adapter process has Gateway auth

## Requirements

- Node.js 20+
- `pnpm`
- either `VERCEL_OIDC_TOKEN` or `AI_GATEWAY_API_KEY`

## Local Development

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

## Install Into Paperclip

Build the package first, then install it into a running Paperclip instance from its absolute local path:

```sh
curl -X POST http://127.0.0.1:3100/api/adapters/install \
	-H 'Content-Type: application/json' \
	--data '{"packageName":"/absolute/path/to/vercel-ai-gateway-paperclip-adapter","isLocalPath":true}'
```

After install, verify the adapter surfaces:

```sh
curl http://127.0.0.1:3100/api/adapters
curl http://127.0.0.1:3100/api/adapters/vercel_ai_gateway/config-schema
curl http://127.0.0.1:3100/api/adapters/vercel_ai_gateway/ui-parser.js
```

## Notes

- `openai/gpt-5.4` works when the connected AI Gateway account has access and sufficient credit.
- For stable resume behavior, keep the prompt template shape fixed between turns and vary runtime context instead.