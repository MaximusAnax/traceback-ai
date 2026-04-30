import { z } from "zod";
import { MaintenanceJob } from "../../queue/jobs/maintenance-job.js";

export const SentryContextEnvelopeSchema = z.object({
  provider: z.literal("sentry"),
  eventId: z.string(),
  stacktrace: z.string(),
  breadcrumbs: z.array(z.string()),
  tags: z.record(z.string(), z.string()),
  repository: z.object({
    owner: z.string(),
    name: z.string(),
    defaultBranch: z.string(),
  }),
  mcpReady: z.boolean(),
});

export type SentryContextEnvelope = z.infer<typeof SentryContextEnvelopeSchema>;

export interface SentryContextProvider {
  getContext(job: MaintenanceJob): Promise<SentryContextEnvelope>;
}

export class InlineSentryContextProvider implements SentryContextProvider {
  async getContext(job: MaintenanceJob): Promise<SentryContextEnvelope> {
    return SentryContextEnvelopeSchema.parse({
      provider: "sentry",
      eventId: job.incident.eventId,
      stacktrace: job.incident.stacktrace,
      breadcrumbs: job.incident.breadcrumbs,
      tags: job.incident.tags,
      repository: job.incident.repository,
      mcpReady: true,
    });
  }
}
