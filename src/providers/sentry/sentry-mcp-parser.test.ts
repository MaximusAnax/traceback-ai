import test from "node:test";
import assert from "node:assert/strict";
import { parseSentryContextFromMcpResult } from "./sentry-mcp-parser.js";
import { type MaintenanceJob } from "../../queue/jobs/maintenance-job.js";

const baseJob: MaintenanceJob = {
  traceId: "trace-1",
  incident: {
    provider: "sentry",
    eventId: "evt-123",
    fingerprint: ["fp-1"],
    title: "Error",
    message: "Something failed",
    culprit: "src/app.ts",
    stacktrace: "stack",
    breadcrumbs: ["a"],
    tags: { env: "test" },
    repository: { owner: "acme", name: "repo", defaultBranch: "main" },
    severity: "high",
    receivedAt: new Date().toISOString(),
  },
};

test("parses structuredContent result", () => {
  const parsed = parseSentryContextFromMcpResult(baseJob, {
    structuredContent: {
      provider: "sentry",
      stacktrace: "remote stack",
      breadcrumbs: ["b1"],
      tags: { source: "mcp" },
      repository: { owner: "acme", name: "repo", defaultBranch: "main" },
      mcpReady: true,
    },
  });

  assert.equal(parsed.eventId, "evt-123");
  assert.equal(parsed.stacktrace, "remote stack");
});

test("parses text JSON fallback result", () => {
  const parsed = parseSentryContextFromMcpResult(baseJob, {
    content: [
      { type: "text", text: "not json" },
      {
        type: "text",
        text: JSON.stringify({
          provider: "sentry",
          stacktrace: "from-text",
          breadcrumbs: ["b1"],
          tags: { source: "text" },
          repository: { owner: "acme", name: "repo", defaultBranch: "main" },
          mcpReady: true,
        }),
      },
    ],
  });

  assert.equal(parsed.eventId, "evt-123");
  assert.equal(parsed.tags.source, "text");
});

test("throws when result is not parseable", () => {
  assert.throws(
    () => parseSentryContextFromMcpResult(baseJob, { content: [{ type: "text", text: "hello" }] }),
    /did not return parseable structured content/,
  );
});
