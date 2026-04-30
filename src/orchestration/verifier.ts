import { VerificationPacket } from "../contracts/verification-packet.js";
import { ChangeSetPacket } from "../contracts/changeset-packet.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { PlanPacket } from "../contracts/plan-packet.js";
import { chooseModelForRole } from "./model-router.js";
import { runCursorPrompt } from "./cursor-agent.js";
import { evaluateEvidenceGate } from "../verification/gate.js";

export const runVerifier = async (
  job: MaintenanceJob,
  plan: PlanPacket,
  changeSet: ChangeSetPacket,
): Promise<VerificationPacket> => {
  const routing = chooseModelForRole("verifier", job);
  const artifactUris = [
    `artifacts/${job.traceId}/reasoning_log.md`,
    `artifacts/${job.traceId}/decision-log.json`,
  ];
  const gate = await evaluateEvidenceGate(artifactUris);

  let testResult = "Verifier checks completed.";
  try {
    const verifierPrompt = [
      "You are TraceBack Verifier. Return one concise sentence on verification confidence.",
      `Incident: ${job.incident.eventId}`,
      `Plan summary: ${plan.incidentSummary}`,
      `Changes: ${changeSet.diffSummary}`,
      `Artifacts present: ${gate.passed}`,
      `Artifact failures:\n- ${gate.failures.join("\n- ") || "none"}`,
    ].join("\n\n");
    testResult = await runCursorPrompt({
      prompt: verifierPrompt,
      modelId: routing.modelId,
      cwd: process.cwd(),
      agentName: "TraceBack Verifier",
    });
  } catch {
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
