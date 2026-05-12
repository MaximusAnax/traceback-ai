import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "../config/env.js";
import { runRuleAudit } from "./rule-audit.js";
import { type MaintenanceJob } from "../queue/jobs/maintenance-job.js";

const job: MaintenanceJob = {
  traceId: "trace-rule-audit",
  incident: {
    provider: "sentry",
    eventId: "evt-rule",
    fingerprint: ["fp"],
    title: "Issue",
    message: "oops",
    culprit: "src/app.ts",
    stacktrace: "boom",
    breadcrumbs: [],
    tags: {},
    repository: { owner: "acme", name: "repo", defaultBranch: "main" },
    severity: "high",
    receivedAt: new Date().toISOString(),
  },
};

test("records rule audit artifact and flags secret config edits", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "traceback-rule-"));
  const priorRoot = env.TRACEBACK_ARTIFACTS_ROOT;
  env.TRACEBACK_ARTIFACTS_ROOT = dir;

  try {
    const packet = await runRuleAudit({
      job,
      changeSet: {
        diffSummary: "changed env",
        filesModified: [".env"],
        whyThisFix: "test",
        testsAddedOrUpdated: [],
        knownLimitations: [],
      },
      artifactUris: ["a"],
    });
    assert.equal(packet.status, "FAIL");
    assert.equal(packet.securityFindings.length, 1);
    const raw = await readFile(path.join(dir, job.traceId, "rule-audit.json"), "utf8");
    assert.match(raw, /secret-bearing/);
  } finally {
    env.TRACEBACK_ARTIFACTS_ROOT = priorRoot;
  }
});
