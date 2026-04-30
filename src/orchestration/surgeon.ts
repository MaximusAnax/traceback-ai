import { ChangeSetPacket } from "../contracts/changeset-packet.js";
import { PlanPacket } from "../contracts/plan-packet.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { runCursorPrompt } from "./cursor-agent.js";
import { chooseModelForRole } from "./model-router.js";
import { ChangeSetPacketSchema } from "../contracts/changeset-packet.js";
import { extractJsonObject } from "../utils/json.js";
import { persistRunEnvelope } from "../observability/cost-ledger.js";

export const runSurgeon = async (
  job: MaintenanceJob,
  plan: PlanPacket,
): Promise<ChangeSetPacket> => {
  const prompt = [
    "You are TraceBack Surgeon. Make minimal edits to fix the bug.",
    "Return JSON only with keys: diffSummary, filesModified, whyThisFix, testsAddedOrUpdated, knownLimitations.",
    `Sentry event: ${job.incident.eventId}`,
    `Incident title: ${job.incident.title}`,
    `Message: ${job.incident.message}`,
    `Culprit: ${job.incident.culprit}`,
    `Stacktrace:\n${job.incident.stacktrace}`,
    `Plan summary: ${plan.incidentSummary}`,
    `Hypotheses:\n- ${plan.rootCauseHypotheses.join("\n- ")}`,
    `Target files:\n- ${plan.filesOfInterest.join("\n- ")}`,
    "Required output:",
    "1) concise diff summary",
    "2) tests to update",
    "3) residual risks",
  ].join("\n\n");

  let diffSummary = `Prepared implementation strategy for ${job.incident.eventId}.`;
  let filesModified = plan.filesOfInterest;
  let whyThisFix = "Implements the planned narrow patch surface to reduce regression risk.";
  let testsAddedOrUpdated = ["traceback_repro.test.ts"];
  const knownLimitations: string[] = [];
  const routing = chooseModelForRole("surgeon", job);
  try {
    const runEnvelope = await runCursorPrompt({
      role: "surgeon",
      prompt,
      modelId: routing.modelId,
      cwd: process.cwd(),
      agentName: "TraceBack Surgeon",
    });
    await persistRunEnvelope(job.traceId, runEnvelope);
    const parsed = ChangeSetPacketSchema.parse(JSON.parse(extractJsonObject(runEnvelope.outputText)));
    diffSummary = parsed.diffSummary;
    filesModified = parsed.filesModified;
    whyThisFix = parsed.whyThisFix;
    testsAddedOrUpdated = parsed.testsAddedOrUpdated;
    knownLimitations.push(...parsed.knownLimitations);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown Cursor SDK error";
    knownLimitations.push(`Cursor SDK execution fallback triggered: ${reason}`);
  }

  return {
    diffSummary,
    filesModified,
    whyThisFix,
    testsAddedOrUpdated,
    knownLimitations: [...knownLimitations, `Routing reason: ${routing.reason}`],
  };
};
