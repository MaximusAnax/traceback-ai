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

type E2BSandboxLike = {
  sandboxId?: string;
  id?: string;
  commands?: {
    run?: (command: string, options?: Record<string, unknown>) => Promise<unknown>;
  };
  runCode?: (code: string, options?: Record<string, unknown>) => Promise<unknown>;
  kill?: () => Promise<void>;
  close?: () => Promise<void>;
};

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<Record<string, unknown>>;

const createE2BSandbox = async (): Promise<E2BSandboxLike> => {
  const imported = await dynamicImport("e2b");
  const maybeSandbox =
    imported.Sandbox ??
    (typeof imported.default === "object" && imported.default !== null
      ? (imported.default as Record<string, unknown>).Sandbox
      : undefined);
  if (!maybeSandbox || typeof maybeSandbox !== "function") {
    throw new Error("The e2b package did not expose a Sandbox constructor.");
  }

  const Sandbox = maybeSandbox as {
    create?: (options?: Record<string, unknown>) => Promise<E2BSandboxLike>;
    new (options?: Record<string, unknown>): E2BSandboxLike;
  };
  const options = {
    apiKey: env.E2B_API_KEY,
    template: env.E2B_TEMPLATE_ID,
    timeoutMs: env.E2B_REPRO_TIMEOUT_MS,
  };
  if (typeof Sandbox.create === "function") return Sandbox.create(options);
  return new Sandbox(options);
};

const stringifyE2BResult = (result: unknown): string => {
  if (typeof result === "string") return result;
  if (typeof result === "object" && result !== null) return JSON.stringify(result);
  return String(result);
};

const terminateE2BSandbox = async (sandbox: E2BSandboxLike): Promise<boolean> => {
  if (typeof sandbox.kill === "function") {
    await sandbox.kill();
    return true;
  }
  if (typeof sandbox.close === "function") {
    await sandbox.close();
    return true;
  }
  return false;
};

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

  const startedAt = Date.now();
  let sandbox: E2BSandboxLike | undefined;
  let terminated = false;
  try {
    sandbox = await createE2BSandbox();
    const incidentJson = JSON.stringify(job.incident).replaceAll("'", "'\\''");
    const envPrefix = [
      `TRACEBACK_TRACE_ID='${job.traceId}'`,
      `TRACEBACK_EVENT_ID='${job.incident.eventId}'`,
      `TRACEBACK_INCIDENT_JSON='${incidentJson}'`,
    ].join(" ");
    const command = `${envPrefix} ${env.E2B_REPRO_COMMAND}`;
    const result =
      typeof sandbox.commands?.run === "function"
        ? await sandbox.commands.run(command, { timeoutMs: env.E2B_REPRO_TIMEOUT_MS })
        : await sandbox.runCode?.(command, { timeoutMs: env.E2B_REPRO_TIMEOUT_MS });
    const details = result ? [stringifyE2BResult(result)] : ["E2B reproduction command completed."];
    terminated = await terminateE2BSandbox(sandbox);
    return ReproductionAttemptSchema.parse({
      driver: "e2b",
      status: "PASS",
      summary: "E2B sandbox reproduction completed successfully.",
      details,
      sandboxId: sandbox.sandboxId ?? sandbox.id,
      durationMs: Date.now() - startedAt,
      terminated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown E2B reproduction error";
    if (sandbox) {
      try {
        terminated = await terminateE2BSandbox(sandbox);
      } catch {
        terminated = false;
      }
    }
    return ReproductionAttemptSchema.parse({
      driver: "e2b",
      status: "FAIL",
      summary: "E2B sandbox reproduction attempt failed.",
      details: [message],
      sandboxId: sandbox?.sandboxId ?? sandbox?.id,
      durationMs: Date.now() - startedAt,
      terminated,
    });
  } finally {
    if (sandbox && !terminated) {
      try {
        terminated = await terminateE2BSandbox(sandbox);
      } catch {
        terminated = false;
      }
    }
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
