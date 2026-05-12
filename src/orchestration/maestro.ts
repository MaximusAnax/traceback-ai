import { PlanPacket } from "../contracts/plan-packet.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { runCursorPrompt } from "./cursor-agent.js";
import { chooseModelForRole } from "./model-router.js";
import { createSentryContextProvider } from "../providers/sentry/sentry-context-provider.js";
import { InlineSentryContextProvider } from "../providers/sentry/sentry-context-provider.js";
import { PlanPacketSchema } from "../contracts/plan-packet.js";
import { extractJsonObject } from "../utils/json.js";
import { persistRunEnvelope } from "../observability/cost-ledger.js";
import { logger } from "../utils/logger.js";
import { recordWeaveTraceEvent } from "../observability/weave.js";
import { ReproductionPacket } from "../contracts/reproduction-packet.js";

export const runMaestro = async (
  job: MaintenanceJob,
  reproduction?: ReproductionPacket,
): Promise<PlanPacket> => {
  const routing = chooseModelForRole("maestro", job);
  const contextProvider = createSentryContextProvider();
  let context = await new InlineSentryContextProvider().getContext(job);

  await recordWeaveTraceEvent({
    traceId: job.traceId,
    role: "maestro",
    action: "context-provider",
    status: "started",
    metadata: { source: "selected-provider" },
  });
  try {
    context = await contextProvider.getContext(job);
    await recordWeaveTraceEvent({
      traceId: job.traceId,
      role: "maestro",
      action: "context-provider",
      status: "succeeded",
      metadata: { eventId: job.incident.eventId },
    });
  } catch (error) {
    logger.warn(
      { traceId: job.traceId, err: error, source: "sentry-context-provider" },
      "context provider failed, using inline context fallback",
    );
    await recordWeaveTraceEvent({
      traceId: job.traceId,
      role: "maestro",
      action: "context-provider",
      status: "fallback",
      metadata: { reason: error instanceof Error ? error.message : "unknown" },
    });
  }

  const fallback: PlanPacket = {
    incidentSummary: `${job.incident.title}: ${job.incident.message}`,
    rootCauseHypotheses: [
      `Investigate culprit path ${job.incident.culprit} from Sentry event ${job.incident.eventId}.`,
    ],
    filesOfInterest: [job.incident.culprit],
    proposedChanges: ["Patch the error origin and add a focused regression test."],
    verificationPlan: [
      "Run lint and tests.",
      "Validate failure reproduction is eliminated.",
      "Emit reasoning_log.md and decision-log.json artifacts.",
    ],
    riskFlags: job.incident.severity === "critical" ? ["critical-incident"] : [],
    subagentTasks:
      job.incident.severity === "critical"
        ? [
            {
              id: "logic-fix",
              role: "logic",
              objective: "Patch the suspected runtime failure with minimal edits.",
              filesOfInterest: [job.incident.culprit],
              constraints: ["depth-limit:1", "do not edit configuration secrets"],
            },
            {
              id: "regression-tests",
              role: "tests",
              objective: "Add or update focused regression coverage for the incident.",
              filesOfInterest: [job.incident.culprit],
              constraints: ["depth-limit:1", "keep tests deterministic"],
            },
          ]
        : [],
    budgetLimits: { maxTokens: routing.maxTokens, maxUsd: routing.maxUsd },
  };

  const prompt = [
    "You are TraceBack Maestro. Produce a concise JSON object only.",
    `Use this schema keys: incidentSummary, rootCauseHypotheses, filesOfInterest, proposedChanges, verificationPlan, riskFlags, subagentTasks, budgetLimits.`,
    `Incident event id: ${job.incident.eventId}`,
    `Severity: ${job.incident.severity}`,
    `Reproduction status: ${reproduction?.status ?? "SKIP"}`,
    `Reproduction summary: ${reproduction?.summary ?? "No reproduction attempt was executed."}`,
    `Context repository: ${context.repository.owner}/${context.repository.name}`,
    `Stacktrace:\n${context.stacktrace}`,
    `Breadcrumbs:\n- ${context.breadcrumbs.join("\n- ") || "none"}`,
    `Constraints: minimal edits, include evidence-driven verification steps.`,
    `If the fix is complex, include at most two subagentTasks using roles logic/tests/verification/docs. Depth limit is always 1.`,
  ].join("\n\n");

  try {
    await recordWeaveTraceEvent({
      traceId: job.traceId,
      role: "maestro",
      action: "run-cursor-prompt",
      status: "started",
      metadata: { modelId: routing.modelId },
    });
    const runEnvelope = await runCursorPrompt({
      role: "maestro",
      prompt,
      modelId: routing.modelId,
      cwd: process.cwd(),
      agentName: "TraceBack Maestro",
    });
    await persistRunEnvelope(job.traceId, runEnvelope);
    await recordWeaveTraceEvent({
      traceId: job.traceId,
      role: "maestro",
      action: "run-cursor-prompt",
      status: "succeeded",
      metadata: { outputChars: runEnvelope.outputText.length },
    });
    const parsed = JSON.parse(extractJsonObject(runEnvelope.outputText));
    return PlanPacketSchema.parse(parsed);
  } catch (error) {
    await recordWeaveTraceEvent({
      traceId: job.traceId,
      role: "maestro",
      action: "run-cursor-prompt",
      status: "fallback",
      metadata: { reason: error instanceof Error ? error.message : "unknown" },
    });
    return fallback;
  }
};
