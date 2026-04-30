import { VerificationPacket } from "../contracts/verification-packet.js";
import { ChangeSetPacket } from "../contracts/changeset-packet.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { PlanPacket } from "../contracts/plan-packet.js";
import { chooseModelForRole } from "./model-router.js";
import { runCursorPrompt } from "./cursor-agent.js";
import { evaluateEvidenceGate } from "../verification/gate.js";
import { persistRunEnvelope } from "../observability/cost-ledger.js";
import { recordWeaveTraceEvent } from "../observability/weave.js";

export const runVerifier = async (
  job: MaintenanceJob,
  plan: PlanPacket,
  changeSet: ChangeSetPacket,
): Promise<VerificationPacket> => {
  const routing = chooseModelForRole("verifier", job);
  const artifactUris = [
    `artifacts/${job.traceId}/reasoning_log.md`,
    `artifacts/${job.traceId}/decision-log.json`,
    `artifacts/${job.traceId}/reproduction-log.json`,
  ];
  const gate = await evaluateEvidenceGate(artifactUris);

  let testResult = "Verifier checks completed.";
  try {
    await recordWeaveTraceEvent({
      traceId: job.traceId,
      role: "verifier",
      action: "run-cursor-prompt",
      status: "started",
      metadata: { modelId: routing.modelId },
    });
    const verifierPrompt = [
      "You are TraceBack Verifier. Return one concise sentence on verification confidence.",
      `Incident: ${job.incident.eventId}`,
      `Plan summary: ${plan.incidentSummary}`,
      `Changes: ${changeSet.diffSummary}`,
      `Artifacts present: ${gate.passed}`,
      `Artifact failures:\n- ${gate.failures.join("\n- ") || "none"}`,
    ].join("\n\n");
    const runEnvelope = await runCursorPrompt({
      role: "verifier",
      prompt: verifierPrompt,
      modelId: routing.modelId,
      cwd: process.cwd(),
      agentName: "TraceBack Verifier",
    });
    await persistRunEnvelope(job.traceId, runEnvelope);
    await recordWeaveTraceEvent({
      traceId: job.traceId,
      role: "verifier",
      action: "run-cursor-prompt",
      status: "succeeded",
      metadata: { outputChars: runEnvelope.outputText.length },
    });
    testResult = runEnvelope.outputText;
  } catch (error) {
    await recordWeaveTraceEvent({
      traceId: job.traceId,
      role: "verifier",
      action: "run-cursor-prompt",
      status: "fallback",
      metadata: { reason: error instanceof Error ? error.message : "unknown" },
    });
    testResult = "Verifier fallback used due to SDK execution error.";
  }

  return {
    gateStatus: gate.passed ? "PASS" : "FAIL",
    testResults: [testResult],
    securityFindings: gate.failures,
    artifactUris,
    humanReviewBrief: gate.passed
      ? `Verifier accepted output for ${changeSet.diffSummary}`
      : "Verifier blocked merge readiness due to missing required evidence artifacts.",
  };
};
