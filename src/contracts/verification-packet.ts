import { z } from "zod";
import { VisualEvidencePacketSchema } from "./visual-evidence-packet.js";
import { RuleAuditPacketSchema } from "./rule-audit-packet.js";

export const VerificationPacketSchema = z.object({
  gateStatus: z.enum(["PASS", "FAIL"]),
  gateChecks: z.array(
    z.object({
      artifactUri: z.string().min(1),
      exists: z.boolean(),
      required: z.boolean().default(true),
    }),
  ),
  testResults: z.array(z.string()),
  securityFindings: z.array(z.string()).default([]),
  artifactUris: z.array(z.string()),
  visualEvidence: VisualEvidencePacketSchema.optional(),
  ruleAudit: RuleAuditPacketSchema.optional(),
  humanReviewBrief: z.string().min(1),
});

export type VerificationPacket = z.infer<typeof VerificationPacketSchema>;
