import { z } from "zod";

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
  humanReviewBrief: z.string().min(1),
});

export type VerificationPacket = z.infer<typeof VerificationPacketSchema>;
