import { PlanPacket } from "../contracts/plan-packet.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";

export const runMaestro = async (job: MaintenanceJob): Promise<PlanPacket> => {
  return {
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
    budgetLimits: { maxTokens: 60000, maxUsd: 4.0 },
  };
};
