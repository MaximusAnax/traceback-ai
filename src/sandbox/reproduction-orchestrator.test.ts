import test from "node:test";
import assert from "node:assert/strict";
import { runReproductionOrchestrator } from "./reproduction-orchestrator.js";
import { type MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { env } from "../config/env.js";

const buildJob = (): MaintenanceJob => ({
  traceId: "trace-sandbox",
  incident: {
    provider: "sentry",
    eventId: "evt-sandbox",
    fingerprint: ["fp-1"],
    title: "Sandbox incident",
    message: "sandbox failure",
    culprit: "src/service.ts",
    stacktrace: "Error: boom",
    breadcrumbs: [],
    tags: {},
    repository: { owner: "acme", name: "traceback", defaultBranch: "main" },
    severity: "medium",
    receivedAt: new Date().toISOString(),
  },
});

test("returns SKIP when no reproduction drivers are configured", async () => {
  const priorE2B = env.E2B_API_KEY;
  const priorCmd = env.E2B_REPRO_COMMAND;
  const priorRuntime = env.CURSOR_RUNTIME;
  const priorRepo = env.CURSOR_CLOUD_REPO_URL;
  env.E2B_API_KEY = undefined;
  env.E2B_REPRO_COMMAND = undefined;
  env.CURSOR_RUNTIME = "local";
  env.CURSOR_CLOUD_REPO_URL = undefined;

  try {
    const result = await runReproductionOrchestrator(buildJob());
    assert.equal(result.status, "SKIP");
    assert.equal(result.selectedDriver, "none");
    assert.equal(result.attempts.length, 2);
  } finally {
    env.E2B_API_KEY = priorE2B;
    env.E2B_REPRO_COMMAND = priorCmd;
    env.CURSOR_RUNTIME = priorRuntime;
    env.CURSOR_CLOUD_REPO_URL = priorRepo;
  }
});
