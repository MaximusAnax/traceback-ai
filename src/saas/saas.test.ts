import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "../config/env.js";
import { LocalArtifactStorageAdapter } from "./storage.js";
import { LocalSignedAuditAdapter } from "./audit.js";

test("local SaaS storage reads review packets from artifact folders", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "traceback-saas-storage-"));
  const priorRoot = env.TRACEBACK_ARTIFACTS_ROOT;
  env.TRACEBACK_ARTIFACTS_ROOT = dir;

  try {
    const traceDir = path.join(dir, "trace-saas");
    await mkdir(traceDir, { recursive: true });
    await writeFile(
      path.join(traceDir, "review-packet.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        traceId: "trace-saas",
        jobId: "trace-saas",
        agentRole: "verifier",
        timestamp: new Date().toISOString(),
        budgetSnapshot: { maxUsd: 1, consumedUsd: 0 },
        provenance: { source: "test", tools: [] },
        payload: {
          incident: {
            eventId: "evt",
            title: "Issue",
            severity: "high",
            repository: { owner: "acme", name: "repo", defaultBranch: "main" },
          },
          plan: {
            incidentSummary: "summary",
            rootCauseHypotheses: ["h"],
            filesOfInterest: ["src/app.ts"],
            proposedChanges: ["fix"],
            verificationPlan: ["test"],
            riskFlags: [],
            budgetLimits: { maxTokens: 100, maxUsd: 1 },
          },
          changeSet: {
            diffSummary: "diff",
            filesModified: ["src/app.ts"],
            whyThisFix: "why",
            testsAddedOrUpdated: [],
            knownLimitations: [],
          },
          verification: {
            gateStatus: "PASS",
            gateChecks: [],
            testResults: [],
            securityFindings: [],
            artifactUris: [],
            humanReviewBrief: "ok",
          },
          publish: {
            mode: "dry-run",
            baseBranch: "main",
            headBranch: "traceback/fix/trace-saas",
            result: { attempted: false, status: "skipped" },
          },
          recommendation: "open-pr",
        },
      }),
      "utf8",
    );

    const packets = await new LocalArtifactStorageAdapter().listReviewPackets();
    assert.equal(packets.length, 1);
    assert.equal(packets[0].traceId, "trace-saas");
  } finally {
    env.TRACEBACK_ARTIFACTS_ROOT = priorRoot;
  }
});

test("local SaaS audit adapter signs and persists audit events", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "traceback-saas-audit-"));
  const priorRoot = env.TRACEBACK_ARTIFACTS_ROOT;
  const priorSecret = env.SAAS_AUDIT_SIGNING_SECRET;
  env.TRACEBACK_ARTIFACTS_ROOT = dir;
  env.SAAS_AUDIT_SIGNING_SECRET = "secret";

  try {
    const event = await new LocalSignedAuditAdapter().record({
      traceId: "trace-audit",
      jobId: "trace-audit",
      tenantId: "tenant",
      actor: { tenantId: "tenant", userId: "user", groups: [] },
      action: "review-packets.read",
      agentRole: "publisher",
      artifactUris: [],
    });
    assert.ok(event.signature);
    const raw = await readFile(path.join(dir, "saas-audit.jsonl"), "utf8");
    assert.match(raw, /review-packets.read/);
  } finally {
    env.TRACEBACK_ARTIFACTS_ROOT = priorRoot;
    env.SAAS_AUDIT_SIGNING_SECRET = priorSecret;
  }
});
