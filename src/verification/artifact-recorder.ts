import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { PlanPacket } from "../contracts/plan-packet.js";
import { ChangeSetPacket } from "../contracts/changeset-packet.js";
import { ReproductionPacket } from "../contracts/reproduction-packet.js";
import { env } from "../config/env.js";

export type EvidenceArtifacts = {
  reasoningLogPath: string;
  decisionLogPath: string;
  reproductionLogPath: string;
};

const artifactsRoot = path.resolve(process.cwd(), env.TRACEBACK_ARTIFACTS_ROOT);

export const recordEvidenceArtifacts = async (args: {
  job: MaintenanceJob;
  plan: PlanPacket;
  changeSet: ChangeSetPacket;
  reproduction?: ReproductionPacket;
}): Promise<EvidenceArtifacts> => {
  const folder = path.join(artifactsRoot, args.job.traceId);
  await mkdir(folder, { recursive: true });

  const reasoningLogPath = path.join(folder, "reasoning_log.md");
  const decisionLogPath = path.join(folder, "decision-log.json");
  const reproductionLogPath = path.join(folder, "reproduction-log.json");

  const reasoningMarkdown = [
    `# TraceBack Reasoning Log`,
    ``,
    `- Trace ID: ${args.job.traceId}`,
    `- Event ID: ${args.job.incident.eventId}`,
    `- Severity: ${args.job.incident.severity}`,
    ``,
    `## Incident Summary`,
    args.plan.incidentSummary,
    ``,
    `## Root Cause Hypotheses`,
    ...args.plan.rootCauseHypotheses.map((item) => `- ${item}`),
    ``,
    `## Proposed Changes`,
    ...args.plan.proposedChanges.map((item) => `- ${item}`),
    ``,
    `## Implemented ChangeSet Summary`,
    args.changeSet.diffSummary,
  ].join("\n");

  const decisionLogJson = JSON.stringify(
    {
      traceId: args.job.traceId,
      eventId: args.job.incident.eventId,
      verificationArtifacts: ["reasoning_log.md", "decision-log.json"],
      generatedAt: new Date().toISOString(),
      reproduction: args.reproduction ?? null,
      plan: args.plan,
      changeSet: args.changeSet,
    },
    null,
    2,
  );

  const reproductionLogJson = JSON.stringify(args.reproduction ?? null, null, 2);

  await writeFile(reasoningLogPath, reasoningMarkdown, "utf8");
  await writeFile(decisionLogPath, decisionLogJson, "utf8");
  await writeFile(reproductionLogPath, reproductionLogJson, "utf8");

  return { reasoningLogPath, decisionLogPath, reproductionLogPath };
};
