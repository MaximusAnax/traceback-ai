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
  CURSOR_SURGEON_MODEL: z.string().min(1).default("gpt-5.3-codex"),
  CURSOR_MAESTRO_MODEL: z.string().min(1).default("claude-opus-4-6"),
  CURSOR_VERIFIER_MODEL: z.string().min(1).default("gpt-5-mini"),
});

export type Env = z.infer<typeof EnvSchema>;
export const env: Env = EnvSchema.parse(process.env);
