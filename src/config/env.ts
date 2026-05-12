import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  REDIS_URL: z.url(),
  SENTRY_WEBHOOK_SECRET: z.string().min(1),
  SENTRY_HOOK_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(300),
  TRACEBACK_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
  CURSOR_API_KEY: z.string().optional(),
  CURSOR_RUNTIME: z.enum(["local", "cloud"]).default("local"),
  CURSOR_CLOUD_REPO_URL: z.string().optional(),
  CURSOR_CLOUD_REPO_REF: z.string().min(1).default("main"),
  SENTRY_CONTEXT_SOURCE: z.enum(["inline", "fixture", "mcp"]).default("inline"),
  SENTRY_FIXTURE_PATH: z.string().min(1).default("fixtures/sentry/sample-incident.json"),
  SENTRY_MCP_SERVER: z.string().optional(),
  SENTRY_MCP_TOOL: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  PLAYWRIGHT_MCP_SERVER: z.string().optional(),
  PLAYWRIGHT_MCP_VISUAL_TOOL: z.string().optional(),
  PLAYWRIGHT_MCP_DOCS_TOOL: z.string().optional(),
  SENTRY_PERSONAL_ACCESS_TOKEN: z.string().optional(),
  SENTRY_MCP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  SENTRY_MCP_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),
  WEAVE_SINK_MODE: z.enum(["local", "wandb"]).default("local"),
  WEAVE_TRACE_LOG_PATH: z.string().min(1).default("artifacts/weave-trace.jsonl"),
  WANDB_BASE_URL: z.string().url().default("https://api.wandb.ai"),
  WANDB_API_KEY: z.string().optional(),
  WANDB_ENTITY: z.string().optional(),
  WANDB_PROJECT: z.string().optional(),
  WEAVE_REMOTE_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  E2B_API_KEY: z.string().optional(),
  E2B_REPRO_COMMAND: z.string().optional(),
  E2B_TEMPLATE_ID: z.string().optional(),
  E2B_REPRO_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  PR_PUBLISH_MODE: z.enum(["disabled", "dry-run", "github"]).default("dry-run"),
  PR_REVIEW_PACKET_PATH: z
    .string()
    .min(1)
    .default("artifacts/{traceId}/review-packet.json"),
  GITHUB_REPOSITORY: z.string().optional(),
  GITHUB_BASE_BRANCH: z.string().min(1).default("main"),
  GITHUB_HEAD_BRANCH_PREFIX: z.string().min(1).default("traceback/fix"),
  CURSOR_SURGEON_MODEL: z.string().min(1).default("gpt-5.4-codex"),
  CURSOR_MAESTRO_MODEL: z.string().min(1).default("claude-opus-4-6"),
  CURSOR_VERIFIER_MODEL: z.string().min(1).default("gpt-5-mini"),
  TRACEBACK_ARTIFACTS_ROOT: z.string().min(1).default("artifacts"),
  SAAS_STORAGE_MODE: z.enum(["local", "external"]).default("local"),
  SAAS_AUDIT_SIGNING_SECRET: z.string().optional(),
  SAAS_OIDC_ISSUER: z.string().url().optional(),
  SAAS_OIDC_AUDIENCE: z.string().optional(),
  SAAS_SCIM_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;
export const env: Env = EnvSchema.parse(process.env);
