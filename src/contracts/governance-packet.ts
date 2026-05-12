import { z } from "zod";

export const GovernanceIdentitySchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email().optional(),
  groups: z.array(z.string()).default([]),
});

export const GovernanceAuditEventSchema = z.object({
  id: z.string().min(1),
  traceId: z.string().min(1),
  jobId: z.string().min(1),
  tenantId: z.string().min(1),
  actor: GovernanceIdentitySchema,
  action: z.string().min(1),
  agentRole: z.enum(["worker", "maestro", "surgeon", "verifier", "auditor", "publisher"]),
  modelId: z.string().optional(),
  tool: z.string().optional(),
  artifactUris: z.array(z.string()).default([]),
  timestamp: z.string().datetime(),
  signature: z.string().min(1),
});

export type GovernanceIdentity = z.infer<typeof GovernanceIdentitySchema>;
export type GovernanceAuditEvent = z.infer<typeof GovernanceAuditEventSchema>;
