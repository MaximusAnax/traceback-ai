# TraceBack Progress

## 2026-04-30

### Completed

- Repository initialized with strict TypeScript + Node scaffolding.
- BullMQ ingestion queue and maintenance worker loop implemented.
- Fastify Sentry webhook route implemented with Zod payload validation.
- Native Sentry webhook signature verification implemented:
  - `x-sentry-hook-signature` / `sentry-hook-signature`
  - `x-sentry-hook-timestamp` / `sentry-hook-timestamp`
  - HMAC-SHA256 on raw request body
  - stale timestamp rejection via `SENTRY_HOOK_MAX_AGE_SECONDS`
- `@cursor/sdk` integrated into Surgeon execution path.
- Baseline docs added (`README`, architecture journal).

### In Progress

- Cursor model catalog discovery and model-ID alignment for Maestro/Surgeon/Verifier.

### Completed (Update)

- Cursor model discovery completed against account API key.
- Default routed model IDs aligned to account-available slugs:
  - Maestro: `claude-opus-4-6`
  - Surgeon: `gpt-5.3-codex`
  - Verifier: `gpt-5-mini`

### Blockers

- None at this stage.

### Next

1. Complete model discovery and lock env model IDs.
2. Add budget-aware model router module.
3. Upgrade Maestro and Verifier to SDK-backed runs.
4. Add MCP-ready Sentry context provider interface.
5. Enforce evidence gate artifacts before PR-ready transitions.
