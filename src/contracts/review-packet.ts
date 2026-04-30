import { z } from "zod";
import { EnvelopeSchema } from "./envelope.js";
import { PlanPacketSchema } from "./plan-packet.js";
import { ChangeSetPacketSchema } from "./changeset-packet.js";
import { VerificationPacketSchema } from "./verification-packet.js";
import { ReproductionPacketSchema } from "./reproduction-packet.js";

export const ReviewPacketPayloadSchema = z.object({
  incident: z.object({
    eventId: z.string().min(1),
    title: z.string().min(1),
    severity: z.enum(["critical", "high", "medium", "low"]),
    repository: z.object({
      owner: z.string().min(1),
      name: z.string().min(1),
      defaultBranch: z.string().min(1),
    }),
  }),
  reproduction: ReproductionPacketSchema.optional(),
  plan: PlanPacketSchema,
  changeSet: ChangeSetPacketSchema,
  verification: VerificationPacketSchema,
  publish: z.object({
    mode: z.enum(["disabled", "dry-run", "github"]),
    baseBranch: z.string().min(1),
    headBranch: z.string().min(1),
    repository: z.string().optional(),
  }),
  recommendation: z.enum(["open-pr", "hold"]),
});

export const ReviewPacketEnvelopeSchema = EnvelopeSchema(ReviewPacketPayloadSchema);

export type ReviewPacketPayload = z.infer<typeof ReviewPacketPayloadSchema>;
export type ReviewPacketEnvelope = z.infer<typeof ReviewPacketEnvelopeSchema>;
