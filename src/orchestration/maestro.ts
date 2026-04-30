import { PlanPacket } from "../contracts/plan-packet.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { runCursorPrompt } from "./cursor-agent.js";
import { chooseModelForRole } from "./model-router.js";
import { InlineSentryContextProvider } from "../providers/sentry/sentry-context-provider.js";
import { PlanPacketSchema } from "../contracts/plan-packet.js";
import { extractJsonObject } from "../utils/json.js";
import { persistRunEnvelope } from "../observability/cost-ledger.js";

export const runMaestro = async (job: MaintenanceJob): Promise<PlanPacket> => {
  const routing = chooseModelForRole("maestro", job);
  const contextProvider = new InlineSentryContextProvider();
  const context = await contextProvider.getContext(job);

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
    budgetLimits: { maxTokens: routing.maxTokens, maxUsd: routing.maxUsd },
  };

  const prompt = [
    "You are TraceBack Maestro. Produce a concise JSON object only.",
    `Use this schema keys: incidentSummary, rootCauseHypotheses, filesOfInterest, proposedChanges, verificationPlan, riskFlags, budgetLimits.`,
    `Incident event id: ${job.incident.eventId}`,
    `Severity: ${job.incident.severity}`,
    `Context repository: ${context.repository.owner}/${context.repository.name}`,
    `Stacktrace:\n${context.stacktrace}`,
    `Breadcrumbs:\n- ${context.breadcrumbs.join("\n- ") || "none"}`,
    `Constraints: minimal edits, include evidence-driven verification steps.`,
  ].join("\n\n");

  try {
    const runEnvelope = await runCursorPrompt({
      role: "maestro",
      prompt,
      modelId: routing.modelId,
      cwd: process.cwd(),
      agentName: "TraceBack Maestro",
    });
    await persistRunEnvelope(job.traceId, runEnvelope);
    const parsed = JSON.parse(extractJsonObject(runEnvelope.outputText));
    return PlanPacketSchema.parse(parsed);
  } catch {
    return fallback;
  }
};
