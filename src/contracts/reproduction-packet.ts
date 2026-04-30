import { z } from "zod";

export const ReproductionAttemptSchema = z.object({
  driver: z.enum(["e2b", "cursor-cloud"]),
  status: z.enum(["PASS", "FAIL", "SKIP"]),
  summary: z.string().min(1),
  details: z.array(z.string()).default([]),
});

export const ReproductionPacketSchema = z.object({
  selectedDriver: z.enum(["e2b", "cursor-cloud", "none"]),
  status: z.enum(["PASS", "FAIL", "SKIP"]),
  summary: z.string().min(1),
  attempts: z.array(ReproductionAttemptSchema),
});

export type ReproductionPacket = z.infer<typeof ReproductionPacketSchema>;
