import { z } from "zod";

export const VisualEvidencePacketSchema = z.object({
  status: z.enum(["PASS", "FAIL", "SKIP"]),
  runtime: z.enum(["cursor-cloud", "local", "none"]),
  videoDemoUri: z.string().min(1),
  visualRegressionUri: z.string().min(1),
  summary: z.string().min(1),
  details: z.array(z.string()).default([]),
});

export type VisualEvidencePacket = z.infer<typeof VisualEvidencePacketSchema>;
