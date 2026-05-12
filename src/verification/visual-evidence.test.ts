import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "../config/env.js";
import { recordVisualEvidence } from "./visual-evidence.js";
import { type MaintenanceJob } from "../queue/jobs/maintenance-job.js";

const job: MaintenanceJob = {
  traceId: "trace-visual",
  incident: {
    provider: "sentry",
    eventId: "evt-visual",
    fingerprint: ["fp"],
    title: "Issue",
    message: "oops",
    culprit: "src/app.ts",
    stacktrace: "boom",
    breadcrumbs: [],
    tags: {},
    repository: { owner: "acme", name: "repo", defaultBranch: "main" },
    severity: "medium",
    receivedAt: new Date().toISOString(),
  },
};

test("emits deterministic skip artifacts when cloud browser is not configured", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "traceback-visual-"));
  const priorRoot = env.TRACEBACK_ARTIFACTS_ROOT;
  const priorRuntime = env.CURSOR_RUNTIME;
  env.TRACEBACK_ARTIFACTS_ROOT = dir;
  env.CURSOR_RUNTIME = "local";

  try {
    const packet = await recordVisualEvidence({
      job,
      changeSet: {
        diffSummary: "no frontend change",
        filesModified: ["src/app.ts"],
        whyThisFix: "test",
        testsAddedOrUpdated: [],
        knownLimitations: [],
      },
    });
    assert.equal(packet.status, "SKIP");
    const raw = await readFile(path.join(dir, job.traceId, "video-demo.json"), "utf8");
    assert.match(raw, /Visual evidence skipped/);
  } finally {
    env.TRACEBACK_ARTIFACTS_ROOT = priorRoot;
    env.CURSOR_RUNTIME = priorRuntime;
  }
});
