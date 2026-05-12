import { z } from "zod";

export const RuleAuditFindingSchema = z.object({
  rule: z.string().min(1),
  status: z.enum(["PASS", "WARN", "FAIL"]),
  summary: z.string().min(1),
});

export const RuleAuditPacketSchema = z.object({
  status: z.enum(["PASS", "WARN", "FAIL"]),
  rulesChecked: z.array(z.string()).default([]),
  findings: z.array(RuleAuditFindingSchema).default([]),
  securityFindings: z.array(z.string()).default([]),
  artifactUris: z.array(z.string()).default([]),
});

export type RuleAuditPacket = z.infer<typeof RuleAuditPacketSchema>;
