import { z } from "zod";

export const CursorRunEnvelopeSchema = z.object({
  role: z.enum(["maestro", "surgeon", "verifier"]),
  runtime: z.enum(["local", "cloud"]),
  modelId: z.string().min(1),
  runId: z.string().min(1),
  agentId: z.string().min(1),
  status: z.enum(["finished", "error", "cancelled"]),
  outputText: z.string().min(1),
  durationMs: z.number().int().nonnegative().default(0),
  tokenEstimate: z.number().int().nonnegative(),
  estimatedUsd: z.number().nonnegative(),
  generatedAt: z.string().datetime(),
});

export type CursorRunEnvelope = z.infer<typeof CursorRunEnvelopeSchema>;
