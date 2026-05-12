import { z } from "zod";

export const SubagentTaskPacketSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["logic", "tests", "verification", "docs"]),
  objective: z.string().min(1),
  filesOfInterest: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
});

export const SubagentResultPacketSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(["PASS", "FAIL", "SKIP"]),
  summary: z.string().min(1),
  filesModified: z.array(z.string()).default([]),
  testsAddedOrUpdated: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

export const MultitaskPacketSchema = z.object({
  enabled: z.boolean(),
  depthLimit: z.literal(1),
  tasks: z.array(SubagentTaskPacketSchema).default([]),
  results: z.array(SubagentResultPacketSchema).default([]),
});

export type SubagentTaskPacket = z.infer<typeof SubagentTaskPacketSchema>;
export type SubagentResultPacket = z.infer<typeof SubagentResultPacketSchema>;
export type MultitaskPacket = z.infer<typeof MultitaskPacketSchema>;
