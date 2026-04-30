import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { ReproductionPacket } from "../contracts/reproduction-packet.js";
import { PlanPacket } from "../contracts/plan-packet.js";
import { ChangeSetPacket } from "../contracts/changeset-packet.js";
import { VerificationPacket } from "../contracts/verification-packet.js";
import { ReviewPacketEnvelopeSchema } from "../contracts/review-packet.js";
import { recordWeaveTraceEvent } from "../observability/weave.js";

const resolveReviewPacketPath = (traceId: string): string => {
  const template = env.PR_REVIEW_PACKET_PATH.replace("{traceId}", traceId);
  return path.resolve(process.cwd(), template);
};

export const publishReviewPacket = async (args: {
  job: MaintenanceJob;
  reproduction: ReproductionPacket;
  plan: PlanPacket;
  changeSet: ChangeSetPacket;
  verification: VerificationPacket;
}): Promise<{ path: string; recommendation: "open-pr" | "hold" }> => {
  const headBranch = `${env.GITHUB_HEAD_BRANCH_PREFIX}/${args.job.traceId}`;
  const recommendation = args.verification.gateStatus === "PASS" ? "open-pr" : "hold";
  const envelope = ReviewPacketEnvelopeSchema.parse({
    schemaVersion: "1.0.0",
    traceId: args.job.traceId,
    jobId: args.job.traceId,
    agentRole: "verifier",
    timestamp: new Date().toISOString(),
    budgetSnapshot: { maxUsd: args.plan.budgetLimits.maxUsd, consumedUsd: 0 },
    provenance: {
      source: "traceback-review-publisher",
      tools: ["evidence-gate", "artifacts", "review-packet"],
    },
    payload: {
      incident: {
        eventId: args.job.incident.eventId,
        title: args.job.incident.title,
        severity: args.job.incident.severity,
        repository: args.job.incident.repository,
      },
      reproduction: args.reproduction,
      plan: args.plan,
      changeSet: args.changeSet,
      verification: args.verification,
      publish: {
        mode: env.PR_PUBLISH_MODE,
        baseBranch: env.GITHUB_BASE_BRANCH,
        headBranch,
        repository: env.GITHUB_REPOSITORY,
      },
      recommendation,
    },
  });

  const packetPath = resolveReviewPacketPath(args.job.traceId);
  await mkdir(path.dirname(packetPath), { recursive: true });
  await writeFile(packetPath, JSON.stringify(envelope, null, 2), "utf8");

  await recordWeaveTraceEvent({
    traceId: args.job.traceId,
    role: "worker",
    action: "review-publisher",
    status: "succeeded",
    metadata: {
      mode: env.PR_PUBLISH_MODE,
      recommendation,
      packetPath,
    },
  });

  return { path: packetPath, recommendation };
};
