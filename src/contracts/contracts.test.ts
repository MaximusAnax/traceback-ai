import test from "node:test";
import assert from "node:assert/strict";
import { IncidentContextSchema } from "./incident.js";
import { MultitaskPacketSchema } from "./subagent-packet.js";
import { GovernanceAuditEventSchema } from "./governance-packet.js";

test("accepts GitHub incident context without breaking Sentry shape", () => {
  const parsed = IncidentContextSchema.parse({
    provider: "github",
    eventId: "github-check-run-1",
    fingerprint: ["github", "check_run", "1"],
    title: "CI failed",
    message: "test failed",
    culprit: "checks/1",
    stacktrace: "failure output",
    breadcrumbs: [],
    tags: { githubEvent: "check_run" },
    repository: {
      owner: "acme",
      name: "repo",
      defaultBranch: "main",
      url: "https://github.com/acme/repo",
    },
    severity: "high",
    receivedAt: new Date().toISOString(),
    providerMetadata: { conclusion: "failure" },
  });

  assert.equal(parsed.provider, "github");
  assert.equal(parsed.repository.url, "https://github.com/acme/repo");
});

test("validates bounded multitask packets", () => {
  const packet = MultitaskPacketSchema.parse({
    enabled: true,
    depthLimit: 1,
    tasks: [
      {
        id: "logic",
        role: "logic",
        objective: "fix runtime branch",
        filesOfInterest: ["src/app.ts"],
      },
    ],
  });

  assert.equal(packet.depthLimit, 1);
  assert.equal(packet.tasks[0].constraints.length, 0);
});

test("validates signed SaaS audit event contract", () => {
  const event = GovernanceAuditEventSchema.parse({
    id: "audit-1",
    traceId: "trace-1",
    jobId: "trace-1",
    tenantId: "tenant-1",
    actor: { tenantId: "tenant-1", userId: "user-1", groups: [] },
    action: "review-packets.read",
    agentRole: "publisher",
    artifactUris: ["artifacts/trace-1/review-packet.json"],
    timestamp: new Date().toISOString(),
    signature: "abc123",
  });

  assert.equal(event.actor.userId, "user-1");
});
