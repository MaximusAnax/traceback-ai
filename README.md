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

1. Copy environment file:

```bash
cp .env.example .env
```

1. Fill required values in `.env`:
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
  - `WEAVE_SINK_MODE` (`local` or `wandb`)
  - `WEAVE_TRACE_LOG_PATH` (JSONL local trace log path)
  - `WANDB_BASE_URL`, `WANDB_API_KEY`, `WANDB_ENTITY`, `WANDB_PROJECT` (required for `WEAVE_SINK_MODE=wandb`)
  - `WEAVE_REMOTE_TIMEOUT_MS` (remote Weave sink timeout budget in ms)
  - `E2B_API_KEY`, `E2B_REPRO_COMMAND`, `E2B_REPRO_TIMEOUT_MS` (E2B-first reproduction orchestration controls)
  - `PR_PUBLISH_MODE`, `PR_REVIEW_PACKET_PATH`, `GITHUB_REPOSITORY`, `GITHUB_BASE_BRANCH`, `GITHUB_HEAD_BRANCH_PREFIX` (PR review packet publishing controls)
2. Start Redis and run:

```bash
npm run dev:server
npm run dev:worker
```

1. Expose local webhook for Sentry:

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
- `artifacts/<traceId>/reproduction-log.json`
- `artifacts/<traceId>/runs/{maestro|surgeon|verifier}.json`

Verifier output now includes per-artifact gate checks in addition to PASS/FAIL status, so reviewers can quickly see which required artifacts were present or missing.

The worker now emits a structured review packet artifact at `artifacts/<traceId>/review-packet.json` (path configurable), containing incident, reproduction, plan, change set, verification, and PR recommendation metadata.

When `PR_PUBLISH_MODE=github`, the publisher attempts `gh pr create` for gate-approved fixes and records publish result metadata (`created`, `failed`, or `skipped`) in the review packet.

## Open-Core Boundary

- OSS Core: queue/orchestration/CLI/BYOK
- SaaS Layer: multi-tenant governance, identity binding, artifact hosting, compliance controls

## Project Documentation

- Product requirements: `docs/product_requirements.md`
- Technical design: `docs/technical_design.md`
- Implementation status (implemented vs backlog): `docs/implementation_status.md`
- Chronological execution log: `docs/progress.md`
- Living architecture log: `docs/architecture_journal.md`

