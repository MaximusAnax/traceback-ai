import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export type WeaveTraceEvent = {
  traceId: string;
  action: string;
  role?: "maestro" | "surgeon" | "verifier" | "context-provider" | "worker";
  status: "started" | "succeeded" | "failed" | "fallback";
  metadata?: Record<string, unknown>;
  at: string;
};

const resolveTraceLogPath = (): string => path.resolve(process.cwd(), env.WEAVE_TRACE_LOG_PATH);

const buildWandbWeaveIngestUrl = (): string => {
  if (!env.WANDB_ENTITY || !env.WANDB_PROJECT) {
    throw new Error(
      "WANDB_ENTITY and WANDB_PROJECT must be set when WEAVE_SINK_MODE=wandb.",
    );
  }
  return `${env.WANDB_BASE_URL}/api/v1/weave/trace/${encodeURIComponent(
    env.WANDB_ENTITY,
  )}/${encodeURIComponent(env.WANDB_PROJECT)}`;
};

const postEventToWandb = async (payload: WeaveTraceEvent): Promise<void> => {
  if (!env.WANDB_API_KEY) {
    throw new Error("WANDB_API_KEY must be set when WEAVE_SINK_MODE=wandb.");
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), env.WEAVE_REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(buildWandbWeaveIngestUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WANDB_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`W&B sink returned ${response.status} ${response.statusText}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
};

export const recordWeaveTraceEvent = async (
  event: Omit<WeaveTraceEvent, "at">,
): Promise<void> => {
  const filePath = resolveTraceLogPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload: WeaveTraceEvent = { ...event, at: new Date().toISOString() };
  await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");

  if (env.WEAVE_SINK_MODE !== "wandb") {
    return;
  }

  try {
    await postEventToWandb(payload);
  } catch (error) {
    logger.warn(
      { err: error, traceId: payload.traceId, action: payload.action },
      "failed to export Weave trace event to W&B sink; local trace was preserved",
    );
  }
};
