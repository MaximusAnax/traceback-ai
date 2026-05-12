import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { env } from "../config/env.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { ReproductionPacket } from "../contracts/reproduction-packet.js";
import { PlanPacket } from "../contracts/plan-packet.js";
import { ChangeSetPacket } from "../contracts/changeset-packet.js";
import { VerificationPacket } from "../contracts/verification-packet.js";
import { ReviewPacketEnvelopeSchema } from "../contracts/review-packet.js";
import { recordWeaveTraceEvent } from "../observability/weave.js";
import { RuleAuditPacket } from "../contracts/rule-audit-packet.js";
import { VisualEvidencePacket } from "../contracts/visual-evidence-packet.js";

const execFileAsync = promisify(execFile);

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
  ruleAudit?: RuleAuditPacket;
  visualEvidence?: VisualEvidencePacket;
}): Promise<{
  path: string;
  recommendation: "open-pr" | "hold";
  publishStatus: "skipped" | "created" | "failed";
  prUrl?: string;
}> => {
  const headBranch = `${env.GITHUB_HEAD_BRANCH_PREFIX}/${args.job.traceId}`;
  const recommendation = args.verification.gateStatus === "PASS" ? "open-pr" : "hold";
  let publishStatus: "skipped" | "created" | "failed" = "skipped";
  let publishReason: string | undefined = "PR publishing mode does not execute side effects.";
  let prUrl: string | undefined;

  if (env.PR_PUBLISH_MODE === "github" && recommendation === "open-pr") {
    if (!env.GITHUB_REPOSITORY) {
      publishStatus = "failed";
      publishReason = "GITHUB_REPOSITORY is required for PR_PUBLISH_MODE=github.";
    } else {
      try {
        const title = `fix: resolve ${args.job.incident.provider} incident ${args.job.incident.eventId}`;
        const body = [
          "## Summary",
          `- Incident: ${args.job.incident.eventId} (${args.job.incident.severity})`,
          `- Plan: ${args.plan.incidentSummary}`,
          `- ChangeSet: ${args.changeSet.diffSummary}`,
          "",
          "## Verification",
          `- Gate status: ${args.verification.gateStatus}`,
          `- Required artifacts checked: ${args.verification.gateChecks.length}`,
          `- Rule audit: ${args.ruleAudit?.status ?? "not-run"}`,
          `- Visual evidence: ${args.visualEvidence?.status ?? "not-run"}`,
          "",
          "## TraceBack Review Packet",
          `- Trace ID: ${args.job.traceId}`,
        ].join("\n");
        await execFileAsync("git", ["checkout", "-B", headBranch]);
        await execFileAsync("git", ["add", "-A"]);
        await execFileAsync("git", [
          "commit",
          "-m",
          `fix: resolve ${args.job.incident.provider} incident ${args.job.incident.eventId}`,
          "--allow-empty",
        ]);
        await execFileAsync("git", ["push", "--set-upstream", "origin", headBranch]);
        const { stdout } = await execFileAsync("gh", [
          "pr",
          "create",
          "--repo",
          env.GITHUB_REPOSITORY,
          "--base",
          env.GITHUB_BASE_BRANCH,
          "--head",
          headBranch,
          "--title",
          title,
          "--body",
          body,
        ]);
        prUrl = stdout.trim() || undefined;
        publishStatus = "created";
        publishReason = undefined;
      } catch (error) {
        publishStatus = "failed";
        publishReason = error instanceof Error ? error.message : "Unknown gh pr create failure.";
      }
    }
  } else if (recommendation !== "open-pr") {
    publishReason = "Recommendation is hold; PR creation skipped.";
  }

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
      ruleAudit: args.ruleAudit,
      visualEvidence: args.visualEvidence,
      verification: args.verification,
      publish: {
        mode: env.PR_PUBLISH_MODE,
        baseBranch: env.GITHUB_BASE_BRANCH,
        headBranch,
        repository: env.GITHUB_REPOSITORY,
        result: {
          attempted: env.PR_PUBLISH_MODE === "github" && recommendation === "open-pr",
          status: publishStatus,
          prUrl,
          reason: publishReason,
        },
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
      publishStatus,
      prUrl,
    },
  });

  return { path: packetPath, recommendation, publishStatus, prUrl };
};
