import { Worker } from "bullmq";
import { redisConnection } from "../connection.js";
import { MaintenanceJobSchema } from "../jobs/maintenance-job.js";
import { logger } from "../../utils/logger.js";
import { runMaestro } from "../../orchestration/maestro.js";
import { runSurgeon } from "../../orchestration/surgeon.js";
import { runVerifier } from "../../orchestration/verifier.js";
import { recordEvidenceArtifacts } from "../../verification/artifact-recorder.js";
import { recordWeaveTraceEvent } from "../../observability/weave.js";
import { runReproductionOrchestrator } from "../../sandbox/reproduction-orchestrator.js";
import { publishReviewPacket } from "../../publishing/review-publisher.js";

export const startMaintenanceWorker = (): Worker => {
  const worker = new Worker(
    "maintenance-ingest",
    async (job) => {
      const payload = MaintenanceJobSchema.parse(job.data);
      await recordWeaveTraceEvent({
        traceId: payload.traceId,
        role: "worker",
        action: "maintenance-job",
        status: "started",
        metadata: { eventId: payload.incident.eventId, queueJobId: job.id },
      });
      logger.info({ traceId: payload.traceId, eventId: payload.incident.eventId }, "job received");

      const reproduction = await runReproductionOrchestrator(payload);
      const plan = await runMaestro(payload, reproduction);
      const changeSet = await runSurgeon(payload, plan);
      await recordEvidenceArtifacts({ job: payload, plan, changeSet, reproduction });
      const verification = await runVerifier(payload, plan, changeSet);
      const review = await publishReviewPacket({
        job: payload,
        reproduction,
        plan,
        changeSet,
        verification,
      });

      logger.info(
        {
          traceId: payload.traceId,
          status: verification.gateStatus,
          artifacts: verification.artifactUris,
          reviewPacket: review.path,
          recommendation: review.recommendation,
          publishStatus: review.publishStatus,
          prUrl: review.prUrl,
        },
        "job processed",
      );
      await recordWeaveTraceEvent({
        traceId: payload.traceId,
        role: "worker",
        action: "maintenance-job",
        status: "succeeded",
        metadata: { gateStatus: verification.gateStatus },
      });
      return { reproduction, plan, changeSet, verification, review };
    },
    { connection: redisConnection, concurrency: 3 },
  );

  worker.on("failed", (job, err) => {
    const maybeTraceId =
      job && typeof job.data === "object" && job.data && "traceId" in job.data
        ? String((job.data as { traceId?: unknown }).traceId ?? "unknown")
        : "unknown";
    void recordWeaveTraceEvent({
      traceId: maybeTraceId,
      role: "worker",
      action: "maintenance-job",
      status: "failed",
      metadata: { jobId: job?.id, reason: err.message },
    });
    logger.error({ jobId: job?.id, err }, "maintenance worker failed");
  });

  return worker;
};
