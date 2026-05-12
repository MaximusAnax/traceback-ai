import { createHmac, randomUUID } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import {
  GovernanceAuditEvent,
  GovernanceAuditEventSchema,
  GovernanceIdentity,
} from "../contracts/governance-packet.js";
import { env } from "../config/env.js";

export interface AuditAdapter {
  record(event: Omit<GovernanceAuditEvent, "id" | "timestamp" | "signature">): Promise<GovernanceAuditEvent>;
}

export class LocalSignedAuditAdapter implements AuditAdapter {
  async record(
    event: Omit<GovernanceAuditEvent, "id" | "timestamp" | "signature">,
  ): Promise<GovernanceAuditEvent> {
    const unsigned = {
      ...event,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    const secret = env.SAAS_AUDIT_SIGNING_SECRET ?? "local-development-audit-secret";
    const signature = createHmac("sha256", secret).update(JSON.stringify(unsigned)).digest("hex");
    const signed = GovernanceAuditEventSchema.parse({ ...unsigned, signature });
    const auditPath = path.resolve(process.cwd(), env.TRACEBACK_ARTIFACTS_ROOT, "saas-audit.jsonl");
    await mkdir(path.dirname(auditPath), { recursive: true });
    await appendFile(auditPath, `${JSON.stringify(signed)}\n`, "utf8");
    return signed;
  }
}

export const createAuditAdapter = (): AuditAdapter => new LocalSignedAuditAdapter();

export const buildDashboardAuditEvent = (args: {
  identity: GovernanceIdentity;
  traceId: string;
  action: string;
  artifactUris?: string[];
}) => ({
  traceId: args.traceId,
  jobId: args.traceId,
  tenantId: args.identity.tenantId,
  actor: args.identity,
  action: args.action,
  agentRole: "publisher" as const,
  artifactUris: args.artifactUris ?? [],
});
