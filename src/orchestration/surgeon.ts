import { ChangeSetPacket } from "../contracts/changeset-packet.js";
import { PlanPacket } from "../contracts/plan-packet.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { env } from "../config/env.js";
import { runCursorPrompt } from "./cursor-agent.js";

export const runSurgeon = async (
  job: MaintenanceJob,
  plan: PlanPacket,
): Promise<ChangeSetPacket> => {
  const prompt = [
    "You are TraceBack Surgeon. Make minimal edits to fix the bug.",
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
  const knownLimitations: string[] = [];
  try {
    diffSummary = await runCursorPrompt({
      prompt,
      modelId: env.CURSOR_SURGEON_MODEL,
      cwd: process.cwd(),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown Cursor SDK error";
    knownLimitations.push(`Cursor SDK execution fallback triggered: ${reason}`);
  }

  return {
    diffSummary,
    filesModified: plan.filesOfInterest,
    whyThisFix: "Implements the planned narrow patch surface to reduce regression risk.",
    testsAddedOrUpdated: ["traceback_repro.test.ts"],
    knownLimitations,
  };
};
