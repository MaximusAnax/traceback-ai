import { z } from "zod";
import { SubagentResultPacketSchema } from "./subagent-packet.js";

export const ChangeSetPacketSchema = z.object({
  diffSummary: z.string().min(1),
  filesModified: z.array(z.string()),
  whyThisFix: z.string().min(1),
  testsAddedOrUpdated: z.array(z.string()),
  knownLimitations: z.array(z.string()).default([]),
  subagentResults: z.array(SubagentResultPacketSchema).optional(),
});

export type ChangeSetPacket = z.infer<typeof ChangeSetPacketSchema>;
