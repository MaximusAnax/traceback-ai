import { z } from "zod";

export const EnvelopeSchema = <T extends z.ZodTypeAny>(payloadSchema: T) =>
  z.object({
    schemaVersion: z.literal("1.0.0"),
    traceId: z.string().min(1),
    jobId: z.string().min(1),
    agentRole: z.enum(["maestro", "surgeon", "verifier"]),
    timestamp: z.string().datetime(),
    budgetSnapshot: z.object({
      maxUsd: z.number().nonnegative(),
      consumedUsd: z.number().nonnegative(),
    }),
    provenance: z.object({
      source: z.string().min(1),
      tools: z.array(z.string()).default([]),
    }),
    payload: payloadSchema,
  });
