import { FastifyInstance } from "fastify";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { SeveritySchema } from "../../contracts/incident.js";
import { ingestQueue } from "../../queue/queues.js";
import { buildMaintenanceJobId } from "../../queue/jobs/maintenance-job.js";

const SentryPayloadSchema = z.object({
  event_id: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1).default(""),
  culprit: z.string().min(1),
  level: z.enum(["fatal", "error", "warning", "info", "debug"]),
  fingerprint: z.array(z.string()).min(1),
  exception: z.object({
    values: z.array(
      z.object({
        stacktrace: z.object({
          frames: z.array(z.object({ filename: z.string(), function: z.string().optional() })),
        }),
      }),
    ),
  }),
  tags: z.record(z.string(), z.string()).default({}),
  breadcrumbs: z
    .object({
      values: z.array(z.object({ message: z.string().optional() })).default([]),
    })
    .default({ values: [] }),
  release: z.string().optional(),
  repository: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    default_branch: z.string().min(1),
  }),
});

const sentryLevelToSeverity = (
  level: z.infer<typeof SentryPayloadSchema>["level"],
): z.infer<typeof SeveritySchema> => {
  if (level === "fatal") return "critical";
  if (level === "error") return "high";
  if (level === "warning") return "medium";
  return "low";
};

export const registerSentryWebhook = async (app: FastifyInstance): Promise<void> => {
  app.post("/webhooks/sentry", { config: { rawBody: true } }, async (request, reply) => {
    const signature = request.headers["x-sentry-hook-signature"] ?? request.headers["sentry-hook-signature"];
    const timestamp = request.headers["x-sentry-hook-timestamp"] ?? request.headers["sentry-hook-timestamp"];
    if (typeof signature !== "string") {
      return reply.code(401).send({ error: "missing signature" });
    }
    if (typeof timestamp !== "string") {
      return reply.code(401).send({ error: "missing timestamp" });
    }
    const timestampMs = Number(timestamp) * 1000;
    if (!Number.isFinite(timestampMs)) {
      return reply.code(401).send({ error: "invalid timestamp format" });
    }
    const maxAgeMs = env.SENTRY_HOOK_MAX_AGE_SECONDS * 1000;
    if (Math.abs(Date.now() - timestampMs) > maxAgeMs) {
      return reply.code(401).send({ error: "stale webhook timestamp" });
    }

    const rawBody = request.rawBody;
    if (!Buffer.isBuffer(rawBody)) {
      return reply.code(400).send({ error: "raw body unavailable for signature verification" });
    }

    const expectedSignature = createHmac("sha256", env.SENTRY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    const provided = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");
    const validSignature = provided.length === expected.length && timingSafeEqual(provided, expected);
    if (!validSignature) {
      return reply.code(401).send({ error: "invalid signature" });
    }

    const payload = SentryPayloadSchema.parse(request.body);
    const stacktrace = payload.exception.values[0]?.stacktrace.frames
      .map((frame) => `${frame.filename}#${frame.function ?? "anonymous"}`)
      .join("\n");

    const traceId = randomUUID();
    const queueJob = {
      traceId,
      incident: {
        provider: "sentry" as const,
        eventId: payload.event_id,
        fingerprint: payload.fingerprint,
        title: payload.title,
        message: payload.message || payload.title,
        culprit: payload.culprit,
        stacktrace: stacktrace || "stacktrace unavailable",
        breadcrumbs: payload.breadcrumbs.values.map((b) => b.message ?? "unknown breadcrumb"),
        tags: payload.tags,
        repository: {
          owner: payload.repository.owner,
          name: payload.repository.name,
          defaultBranch: payload.repository.default_branch,
        },
        severity: sentryLevelToSeverity(payload.level),
        receivedAt: new Date().toISOString(),
      },
    };

    await ingestQueue.add("maintenance", queueJob, {
      jobId: buildMaintenanceJobId(payload.event_id, payload.fingerprint),
      priority: queueJob.incident.severity === "critical" ? 1 : 5,
    });

    return reply.code(202).send({ accepted: true, traceId });
  });
};
