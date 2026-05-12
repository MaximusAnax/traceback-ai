import { createHash } from "node:crypto";
import { z } from "zod";
import { IncidentContextSchema } from "../../contracts/incident.js";

export const MaintenanceJobSchema = z.object({
  traceId: z.string().min(1),
  incident: IncidentContextSchema,
  source: z
    .object({
      provider: z.enum(["sentry", "github"]),
      webhookEvent: z.string().optional(),
      deliveryId: z.string().optional(),
      receivedAt: z.string().datetime(),
    })
    .optional(),
  priority: z
    .object({
      value: z.number().int().positive(),
      reason: z.string().min(1),
    })
    .optional(),
  enterpriseIdentity: z
    .object({
      tenantId: z.string().min(1),
      userId: z.string().min(1),
      userEmail: z.string().email().optional(),
      groups: z.array(z.string()).default([]),
    })
    .optional(),
});

export type MaintenanceJob = z.infer<typeof MaintenanceJobSchema>;

export const buildMaintenanceJobId = (eventId: string, fingerprint: string[]): string => {
  return createHash("sha256")
    .update(`${eventId}:${fingerprint.join("|")}`)
    .digest("hex")
    .slice(0, 32);
};
