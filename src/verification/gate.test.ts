import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluateEvidenceGate } from "./gate.js";

test("returns PASS when all required artifacts exist", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "traceback-gate-"));
  const a = path.join(dir, "reasoning_log.md");
  const b = path.join(dir, "decision-log.json");
  await writeFile(a, "ok", "utf8");
  await writeFile(b, "{}", "utf8");

  const result = await evaluateEvidenceGate([a, b]);
  assert.equal(result.passed, true);
  assert.equal(result.failures.length, 0);
  assert.equal(result.checks.length, 2);
  assert.equal(result.checks.every((check) => check.exists), true);
});

test("returns FAIL and check details when an artifact is missing", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "traceback-gate-"));
  const existing = path.join(dir, "reasoning_log.md");
  const missing = path.join(dir, "decision-log.json");
  await writeFile(existing, "ok", "utf8");

  const result = await evaluateEvidenceGate([existing, missing]);
  assert.equal(result.passed, false);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /Missing required artifact/);
  const missingCheck = result.checks.find((check) => check.artifactUri === missing);
  assert.ok(missingCheck);
  assert.equal(missingCheck.exists, false);
});
