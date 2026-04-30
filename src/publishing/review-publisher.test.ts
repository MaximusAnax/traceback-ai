import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "../config/env.js";
import { publishReviewPacket } from "./review-publisher.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { ReproductionPacket } from "../contracts/reproduction-packet.js";
import { PlanPacket } from "../contracts/plan-packet.js";
import { ChangeSetPacket } from "../contracts/changeset-packet.js";
import { VerificationPacket } from "../contracts/verification-packet.js";

const job: MaintenanceJob = {
  traceId: "trace-review",
  incident: {
    provider: "sentry",
    eventId: "evt-1",
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

const reproduction: ReproductionPacket = {
  selectedDriver: "none",
  status: "SKIP",
  summary: "none",
  attempts: [],
};

const plan: PlanPacket = {
  incidentSummary: "summary",
  rootCauseHypotheses: ["h1"],
  filesOfInterest: ["src/app.ts"],
  proposedChanges: ["fix it"],
  verificationPlan: ["run tests"],
  riskFlags: [],
  budgetLimits: { maxTokens: 1000, maxUsd: 1 },
};

const changeSet: ChangeSetPacket = {
  diffSummary: "diff",
  filesModified: ["src/app.ts"],
  whyThisFix: "why",
  testsAddedOrUpdated: ["test.ts"],
  knownLimitations: [],
};

const verification: VerificationPacket = {
  gateStatus: "PASS",
  gateChecks: [],
  testResults: ["ok"],
  securityFindings: [],
  artifactUris: [],
  humanReviewBrief: "brief",
};

test("writes structured review packet artifact", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "traceback-review-"));
  const priorPath = env.PR_REVIEW_PACKET_PATH;
  env.PR_REVIEW_PACKET_PATH = path.join(dir, "{traceId}.json");

  try {
    const result = await publishReviewPacket({ job, reproduction, plan, changeSet, verification });
    const raw = await readFile(result.path, "utf8");
    assert.match(raw, /"schemaVersion": "1.0.0"/);
    assert.match(raw, /"recommendation": "open-pr"/);
  } finally {
    env.PR_REVIEW_PACKET_PATH = priorPath;
  }
});
