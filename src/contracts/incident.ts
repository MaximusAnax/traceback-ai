import { z } from "zod";

export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export const IncidentProviderSchema = z.enum(["sentry", "github"]);

export const IncidentContextSchema = z.object({
  provider: IncidentProviderSchema,
  eventId: z.string().min(1),
  fingerprint: z.array(z.string()).min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  culprit: z.string().min(1),
  stacktrace: z.string().min(1),
  breadcrumbs: z.array(z.string()).default([]),
  tags: z.record(z.string(), z.string()).default({}),
  repository: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    defaultBranch: z.string().min(1),
    url: z.string().url().optional(),
  }),
  severity: SeveritySchema,
  receivedAt: z.string().datetime(),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
});

export type IncidentContext = z.infer<typeof IncidentContextSchema>;
