import { Worker } from "bullmq";
import { redisConnection } from "../connection.js";
import { MaintenanceJobSchema } from "../jobs/maintenance-job.js";
import { logger } from "../../utils/logger.js";
import { runMaestro } from "../../orchestration/maestro.js";
import { runSurgeon } from "../../orchestration/surgeon.js";
import { runVerifier } from "../../orchestration/verifier.js";
import { recordEvidenceArtifacts } from "../../verification/artifact-recorder.js";

export const startMaintenanceWorker = (): Worker => {
  const worker = new Worker(
    "maintenance:ingest",
    async (job) => {
      const payload = MaintenanceJobSchema.parse(job.data);
      logger.info({ traceId: payload.traceId, eventId: payload.incident.eventId }, "job received");

      const plan = await runMaestro(payload);
      const changeSet = await runSurgeon(payload, plan);
      await recordEvidenceArtifacts({ job: payload, plan, changeSet });
      const verification = await runVerifier(payload, plan, changeSet);

      logger.info(
        { traceId: payload.traceId, status: verification.gateStatus, artifacts: verification.artifactUris },
        "job processed",
      );
      return { plan, changeSet, verification };
    },
    { connection: redisConnection, concurrency: 3 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "maintenance worker failed");
  });

  return worker;
};
