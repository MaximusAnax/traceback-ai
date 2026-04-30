import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

export type WeaveTraceEvent = {
  traceId: string;
  action: string;
  role?: "maestro" | "surgeon" | "verifier" | "context-provider" | "worker";
  status: "started" | "succeeded" | "failed" | "fallback";
  metadata?: Record<string, unknown>;
  at: string;
};

const resolveTraceLogPath = (): string => path.resolve(process.cwd(), env.WEAVE_TRACE_LOG_PATH);

export const recordWeaveTraceEvent = async (
  event: Omit<WeaveTraceEvent, "at">,
): Promise<void> => {
  const filePath = resolveTraceLogPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload: WeaveTraceEvent = { ...event, at: new Date().toISOString() };
  await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
};
