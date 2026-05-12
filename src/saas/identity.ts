import { createHash } from "node:crypto";
import { GovernanceIdentity, GovernanceIdentitySchema } from "../contracts/governance-packet.js";
import { env } from "../config/env.js";

export interface IdentityAdapter {
  authenticate(headers: Record<string, string | string[] | undefined>): Promise<GovernanceIdentity>;
}

export interface ScimAdapter {
  upsertUser(identity: GovernanceIdentity): Promise<void>;
  deactivateUser(tenantId: string, userId: string): Promise<void>;
}

export class HeaderIdentityAdapter implements IdentityAdapter {
  async authenticate(headers: Record<string, string | string[] | undefined>): Promise<GovernanceIdentity> {
    const authorization = typeof headers.authorization === "string" ? headers.authorization : "";
    const tenantId =
      typeof headers["x-traceback-tenant"] === "string" ? headers["x-traceback-tenant"] : "local";
    const email =
      typeof headers["x-traceback-user-email"] === "string"
        ? headers["x-traceback-user-email"]
        : undefined;
    const subject =
      typeof headers["x-traceback-user-id"] === "string"
        ? headers["x-traceback-user-id"]
        : createHash("sha256").update(authorization || "anonymous").digest("hex").slice(0, 16);

    return GovernanceIdentitySchema.parse({
      tenantId,
      userId: subject,
      email,
      groups:
        typeof headers["x-traceback-groups"] === "string"
          ? headers["x-traceback-groups"].split(",").map((group) => group.trim()).filter(Boolean)
          : [],
    });
  }
}

export class InMemoryScimAdapter implements ScimAdapter {
  private readonly users = new Map<string, GovernanceIdentity>();

  async upsertUser(identity: GovernanceIdentity): Promise<void> {
    this.users.set(`${identity.tenantId}:${identity.userId}`, identity);
  }

  async deactivateUser(tenantId: string, userId: string): Promise<void> {
    this.users.delete(`${tenantId}:${userId}`);
  }
}

export const createIdentityAdapter = (): IdentityAdapter => {
  if (env.SAAS_OIDC_ISSUER && env.SAAS_OIDC_AUDIENCE) {
    return new HeaderIdentityAdapter();
  }
  return new HeaderIdentityAdapter();
};
