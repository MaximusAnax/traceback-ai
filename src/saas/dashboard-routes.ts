import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createAuditAdapter, buildDashboardAuditEvent } from "./audit.js";
import { createIdentityAdapter } from "./identity.js";
import { createArtifactStorageAdapter } from "./storage.js";

const TraceParamsSchema = z.object({ traceId: z.string().min(1) });

export const registerSaasDashboardRoutes = async (app: FastifyInstance): Promise<void> => {
  const storage = createArtifactStorageAdapter();
  const identity = createIdentityAdapter();
  const audit = createAuditAdapter();

  app.get("/saas/review-packets", async (request) => {
    const actor = await identity.authenticate(request.headers);
    const packets = await storage.listReviewPackets();
    await audit.record(
      buildDashboardAuditEvent({
        identity: actor,
        traceId: "dashboard",
        action: "review-packets.list",
      }),
    );
    return {
      packets: packets.map((packet) => ({
        traceId: packet.traceId,
        timestamp: packet.timestamp,
        incident: packet.payload.incident,
        recommendation: packet.payload.recommendation,
        gateStatus: packet.payload.verification.gateStatus,
        publish: packet.payload.publish.result,
      })),
    };
  });

  app.get("/saas/review-packets/:traceId", async (request, reply) => {
    const params = TraceParamsSchema.parse(request.params);
    const actor = await identity.authenticate(request.headers);
    const packet = await storage.getReviewPacket(params.traceId);
    if (!packet) {
      return reply.code(404).send({ error: "review packet not found" });
    }
    await audit.record(
      buildDashboardAuditEvent({
        identity: actor,
        traceId: params.traceId,
        action: "review-packets.read",
        artifactUris: packet.payload.verification.artifactUris,
      }),
    );
    return packet;
  });
};
