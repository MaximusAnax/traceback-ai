import { createHash } from "node:crypto";
import { z } from "zod";
import { IncidentContextSchema } from "../../contracts/incident.js";

export const MaintenanceJobSchema = z.object({
  traceId: z.string().min(1),
  incident: IncidentContextSchema,
});

export type MaintenanceJob = z.infer<typeof MaintenanceJobSchema>;

export const buildMaintenanceJobId = (eventId: string, fingerprint: string[]): string => {
  return createHash("sha256")
    .update(`${eventId}:${fingerprint.join("|")}`)
    .digest("hex")
    .slice(0, 32);
};
