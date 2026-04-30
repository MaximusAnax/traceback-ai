import { exec } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../config/env.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import {
  ReproductionAttemptSchema,
  ReproductionPacket,
  ReproductionPacketSchema,
} from "../contracts/reproduction-packet.js";
import { runCursorPrompt } from "../orchestration/cursor-agent.js";
import { chooseModelForRole } from "../orchestration/model-router.js";
import { recordWeaveTraceEvent } from "../observability/weave.js";

const execAsync = promisify(exec);

const attemptE2BReproduction = async (job: MaintenanceJob) => {
  if (!env.E2B_API_KEY) {
    return ReproductionAttemptSchema.parse({
      driver: "e2b",
      status: "SKIP",
      summary: "E2B reproduction skipped because E2B_API_KEY is not configured.",
      details: [],
    });
  }

  if (!env.E2B_REPRO_COMMAND) {
    return ReproductionAttemptSchema.parse({
      driver: "e2b",
      status: "FAIL",
      summary: "E2B API key is configured, but E2B_REPRO_COMMAND is missing.",
      details: ["Set E2B_REPRO_COMMAND to run your reproduction script in an E2B context."],
    });
  }

  try {
    const { stdout, stderr } = await execAsync(env.E2B_REPRO_COMMAND, {
      timeout: env.E2B_REPRO_TIMEOUT_MS,
      env: {
        ...process.env,
        E2B_API_KEY: env.E2B_API_KEY,
        TRACEBACK_TRACE_ID: job.traceId,
        TRACEBACK_EVENT_ID: job.incident.eventId,
        TRACEBACK_INCIDENT_JSON: JSON.stringify(job.incident),
      },
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
    });

    const details = [stdout.trim(), stderr.trim()].filter(Boolean);
    return ReproductionAttemptSchema.parse({
      driver: "e2b",
      status: "PASS",
      summary: "E2B reproduction command completed successfully.",
      details,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown E2B reproduction error";
    return ReproductionAttemptSchema.parse({
      driver: "e2b",
      status: "FAIL",
      summary: "E2B reproduction attempt failed.",
      details: [message],
    });
  }
};

const attemptCursorCloudReproduction = async (job: MaintenanceJob) => {
  if (env.CURSOR_RUNTIME !== "cloud" || !env.CURSOR_CLOUD_REPO_URL) {
    return ReproductionAttemptSchema.parse({
      driver: "cursor-cloud",
      status: "SKIP",
      summary: "Cursor Cloud reproduction skipped because CURSOR_RUNTIME=cloud is not configured.",
      details: [],
    });
  }

  const routing = chooseModelForRole("verifier", job);
  const prompt = [
    "You are TraceBack Reproduction Runner.",
    "Attempt to describe concise reproduction steps and expected failing behavior for this incident.",
    "Return plain text only.",
    `Event ID: ${job.incident.eventId}`,
    `Title: ${job.incident.title}`,
    `Message: ${job.incident.message}`,
    `Culprit: ${job.incident.culprit}`,
    `Stacktrace:\n${job.incident.stacktrace}`,
  ].join("\n\n");

  try {
    const run = await runCursorPrompt({
      role: "verifier",
      prompt,
      modelId: routing.modelId,
      cwd: process.cwd(),
      agentName: "TraceBack Repro Runner",
    });
    return ReproductionAttemptSchema.parse({
      driver: "cursor-cloud",
      status: "PASS",
      summary: "Cursor Cloud reproduction fallback completed.",
      details: [run.outputText],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown Cursor Cloud reproduction error";
    return ReproductionAttemptSchema.parse({
      driver: "cursor-cloud",
      status: "FAIL",
      summary: "Cursor Cloud reproduction fallback failed.",
      details: [message],
    });
  }
};

export const runReproductionOrchestrator = async (job: MaintenanceJob): Promise<ReproductionPacket> => {
  await recordWeaveTraceEvent({
    traceId: job.traceId,
    role: "worker",
    action: "reproduction-orchestrator",
    status: "started",
    metadata: { eventId: job.incident.eventId },
  });

  const attempts = [];
  const e2b = await attemptE2BReproduction(job);
  attempts.push(e2b);

  if (e2b.status === "PASS") {
    const packet = ReproductionPacketSchema.parse({
      selectedDriver: "e2b",
      status: "PASS",
      summary: e2b.summary,
      attempts,
    });
    await recordWeaveTraceEvent({
      traceId: job.traceId,
      role: "worker",
      action: "reproduction-orchestrator",
      status: "succeeded",
      metadata: { selectedDriver: packet.selectedDriver, status: packet.status },
    });
    return packet;
  }

  const cursorFallback = await attemptCursorCloudReproduction(job);
  attempts.push(cursorFallback);
  const selectedDriver =
    cursorFallback.status === "PASS"
      ? "cursor-cloud"
      : e2b.status === "SKIP" && cursorFallback.status === "SKIP"
        ? "none"
        : "cursor-cloud";
  const finalStatus =
    cursorFallback.status === "PASS"
      ? "PASS"
      : e2b.status === "SKIP" && cursorFallback.status === "SKIP"
        ? "SKIP"
        : "FAIL";
  const packet = ReproductionPacketSchema.parse({
    selectedDriver,
    status: finalStatus,
    summary:
      finalStatus === "PASS"
        ? "Reproduction succeeded."
        : finalStatus === "SKIP"
          ? "Reproduction skipped because no sandbox driver is configured."
          : "Reproduction failed across configured sandbox drivers.",
    attempts,
  });
  await recordWeaveTraceEvent({
    traceId: job.traceId,
    role: "worker",
    action: "reproduction-orchestrator",
    status: finalStatus === "FAIL" ? "failed" : "fallback",
    metadata: { selectedDriver: packet.selectedDriver, status: packet.status },
  });
  return packet;
};
