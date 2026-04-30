# TraceBack

TraceBack is an open-core autonomous maintenance engine that closes the loop between production errors and pull requests.

It ingests incidents (Sentry/GitHub), queues maintenance jobs with BullMQ, orchestrates a Maestro/Surgeon/Verifier agent loop, and emits evidence-driven verification artifacts for review.

## Current Scope

- Fastify webhook ingestion (`/webhooks/sentry`)
- BullMQ + Redis async pipeline
- Typed contracts with Zod for all critical payloads
- Surgeon path wired to `@cursor/sdk`
- Native Sentry HMAC verification (`x-sentry-hook-signature` / timestamp validation)
- Buildable TypeScript CLI (`server` and `worker` modes)
- Budget-aware model routing for Maestro/Surgeon/Verifier
- Evidence artifact generation + verification gate enforcement
- Run envelope persistence for trace/cost metadata per agent role

## Stack

- Node.js 22+
- TypeScript (strict)
- Fastify
- BullMQ + Redis
- `@cursor/sdk`
- Zod

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Fill required values in `.env`:
   - `REDIS_URL`
   - `SENTRY_WEBHOOK_SECRET`
   - `SENTRY_HOOK_MAX_AGE_SECONDS` (defaults to 300)
   - `CURSOR_API_KEY` (recommended for SDK-backed runs)
   - `CURSOR_RUNTIME` (`local` or `cloud`)
   - `CURSOR_CLOUD_REPO_URL` (required for cloud runtime)
   - `SENTRY_CONTEXT_SOURCE` (`inline`, `fixture`, or `mcp`)
   - `SENTRY_FIXTURE_PATH` (used when source is `fixture`)
   - `SENTRY_MCP_SERVER` / `SENTRY_MCP_TOOL` (used when source is `mcp`)
   - `SENTRY_PERSONAL_ACCESS_TOKEN` (required by `.cursor/mcp.json` if your Sentry MCP server uses token auth)
   - `SENTRY_MCP_TIMEOUT_MS` / `SENTRY_MCP_MAX_RETRIES` (MCP resilience controls)
   - `WEAVE_TRACE_LOG_PATH` (JSONL trace log path for agent action observability)

4. Start Redis and run:

```bash
npm run dev:server
npm run dev:worker
```

5. Expose local webhook for Sentry:

```bash
ngrok http 3000
```

Use `https://<ngrok-domain>/webhooks/sentry` in Sentry integration settings.

## CLI Modes

- `npm run dev:server`: starts Fastify webhook producer
- `npm run dev:worker`: starts BullMQ maintenance worker

## Verification Standard

Every autonomous PR is expected to include:

- decision log (`decision-log.json` or equivalent)
- reasoning log (`reasoning_log.md`)
- execution evidence (test/lint output, and video for visual flows)

Current scaffold enforces artifact presence for:
- `artifacts/<traceId>/reasoning_log.md`
- `artifacts/<traceId>/decision-log.json`
- `artifacts/<traceId>/runs/{maestro|surgeon|verifier}.json`

## Open-Core Boundary

- OSS Core: queue/orchestration/CLI/BYOK
- SaaS Layer: multi-tenant governance, identity binding, artifact hosting, compliance controls

## Project Documentation

- Product requirements: `docs/product_requirements.md`
- Technical design: `docs/technical_design.md`
- Living architecture log: `docs/architecture_journal.md`
