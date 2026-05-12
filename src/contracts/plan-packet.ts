import { z } from "zod";
import { SubagentTaskPacketSchema } from "./subagent-packet.js";

export const PlanPacketSchema = z.object({
  incidentSummary: z.string().min(1),
  rootCauseHypotheses: z.array(z.string()).min(1),
  filesOfInterest: z.array(z.string()).min(1),
  proposedChanges: z.array(z.string()).min(1),
  verificationPlan: z.array(z.string()).min(1),
  riskFlags: z.array(z.string()).default([]),
  subagentTasks: z.array(SubagentTaskPacketSchema).optional(),
  budgetLimits: z.object({
    maxTokens: z.number().int().positive(),
    maxUsd: z.number().positive(),
  }),
});

export type PlanPacket = z.infer<typeof PlanPacketSchema>;
