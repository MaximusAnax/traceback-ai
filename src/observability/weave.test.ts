import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "../config/env.js";
import { recordWeaveTraceEvent } from "./weave.js";

test("records local weave trace event to JSONL", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "traceback-weave-"));
  const priorLogPath = env.WEAVE_TRACE_LOG_PATH;
  const priorSinkMode = env.WEAVE_SINK_MODE;
  env.WEAVE_TRACE_LOG_PATH = path.join(tmpDir, "weave-trace.jsonl");
  env.WEAVE_SINK_MODE = "local";

  try {
    await recordWeaveTraceEvent({
      traceId: "trace-local",
      role: "worker",
      action: "maintenance-job",
      status: "started",
      metadata: { source: "test" },
    });

    const content = await readFile(env.WEAVE_TRACE_LOG_PATH, "utf8");
    assert.match(content, /"traceId":"trace-local"/);
    assert.match(content, /"action":"maintenance-job"/);
  } finally {
    env.WEAVE_TRACE_LOG_PATH = priorLogPath;
    env.WEAVE_SINK_MODE = priorSinkMode;
  }
});

test("does not throw when remote W&B sink fails", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "traceback-weave-"));
  const priorLogPath = env.WEAVE_TRACE_LOG_PATH;
  const priorSinkMode = env.WEAVE_SINK_MODE;
  const priorApiKey = env.WANDB_API_KEY;
  const priorBaseUrl = env.WANDB_BASE_URL;
  const priorEntity = env.WANDB_ENTITY;
  const priorProject = env.WANDB_PROJECT;
  const priorFetch = globalThis.fetch;

  env.WEAVE_TRACE_LOG_PATH = path.join(tmpDir, "weave-trace.jsonl");
  env.WEAVE_SINK_MODE = "wandb";
  env.WANDB_API_KEY = "test-key";
  env.WANDB_BASE_URL = "https://api.wandb.ai";
  env.WANDB_ENTITY = "traceback";
  env.WANDB_PROJECT = "core";

  globalThis.fetch = async () => {
    throw new Error("network down");
  };

  try {
    await recordWeaveTraceEvent({
      traceId: "trace-remote",
      role: "maestro",
      action: "run-cursor-prompt",
      status: "succeeded",
    });

    const content = await readFile(env.WEAVE_TRACE_LOG_PATH, "utf8");
    assert.match(content, /"traceId":"trace-remote"/);
  } finally {
    env.WEAVE_TRACE_LOG_PATH = priorLogPath;
    env.WEAVE_SINK_MODE = priorSinkMode;
    env.WANDB_API_KEY = priorApiKey;
    env.WANDB_BASE_URL = priorBaseUrl;
    env.WANDB_ENTITY = priorEntity;
    env.WANDB_PROJECT = priorProject;
    globalThis.fetch = priorFetch;
  }
});
