import { z } from "zod";

export const ChangeSetPacketSchema = z.object({
  diffSummary: z.string().min(1),
  filesModified: z.array(z.string()),
  whyThisFix: z.string().min(1),
  testsAddedOrUpdated: z.array(z.string()),
  knownLimitations: z.array(z.string()).default([]),
});

export type ChangeSetPacket = z.infer<typeof ChangeSetPacketSchema>;
