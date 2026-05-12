import { access, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { env } from "../config/env.js";
import { redisConnection } from "../queue/connection.js";

const execFileAsync = promisify(execFile);

export type CapabilityCheck = {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
};

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);

export const runCapabilityChecks = async (): Promise<CapabilityCheck[]> => {
  const checks: CapabilityCheck[] = [];

  try {
    await withTimeout(redisConnection.ping(), 1500);
    checks.push({ name: "Redis", status: "PASS", detail: "Redis ping succeeded." });
  } catch (error) {
    checks.push({
      name: "Redis",
      status: "FAIL",
      detail: error instanceof Error ? error.message : "Redis ping failed.",
    });
  }

  checks.push({
    name: "Cursor SDK",
    status: env.CURSOR_API_KEY ? "PASS" : "WARN",
    detail: env.CURSOR_API_KEY
      ? `Configured for ${env.CURSOR_RUNTIME} runtime.`
      : "CURSOR_API_KEY is not configured; SDK-backed runs will fall back.",
  });

  checks.push({
    name: "Sentry MCP",
    status: env.SENTRY_MCP_SERVER && env.SENTRY_MCP_TOOL ? "PASS" : "WARN",
    detail:
      env.SENTRY_MCP_SERVER && env.SENTRY_MCP_TOOL
        ? `Configured server/tool: ${env.SENTRY_MCP_SERVER}/${env.SENTRY_MCP_TOOL}.`
        : "SENTRY_MCP_SERVER and SENTRY_MCP_TOOL are not both configured.",
  });

  checks.push({
    name: "Playwright MCP",
    status: env.PLAYWRIGHT_MCP_SERVER && env.PLAYWRIGHT_MCP_VISUAL_TOOL ? "PASS" : "WARN",
    detail:
      env.PLAYWRIGHT_MCP_SERVER && env.PLAYWRIGHT_MCP_VISUAL_TOOL
        ? `Configured server/tool: ${env.PLAYWRIGHT_MCP_SERVER}/${env.PLAYWRIGHT_MCP_VISUAL_TOOL}.`
        : "Visual verification will emit SKIP artifacts until Playwright MCP is configured.",
  });

  checks.push({
    name: "E2B",
    status: env.E2B_API_KEY ? "PASS" : "WARN",
    detail: env.E2B_API_KEY
      ? "E2B_API_KEY is configured."
      : "E2B reproduction will be skipped without E2B_API_KEY.",
  });

  try {
    const { stdout } = await execFileAsync("gh", ["--version"]);
    checks.push({
      name: "GitHub CLI",
      status: "PASS",
      detail: stdout.split("\n")[0] ?? "gh is installed.",
    });
  } catch (error) {
    checks.push({
      name: "GitHub CLI",
      status: "WARN",
      detail: error instanceof Error ? error.message : "gh is unavailable.",
    });
  }

  try {
    const folder = path.resolve(process.cwd(), env.TRACEBACK_ARTIFACTS_ROOT, ".capability-check");
    await mkdir(folder, { recursive: true });
    const filePath = path.join(folder, "write-test.txt");
    await writeFile(filePath, new Date().toISOString(), "utf8");
    await access(filePath);
    checks.push({
      name: "Artifact storage",
      status: "PASS",
      detail: `${env.TRACEBACK_ARTIFACTS_ROOT} is writable.`,
    });
  } catch (error) {
    checks.push({
      name: "Artifact storage",
      status: "FAIL",
      detail: error instanceof Error ? error.message : "artifact write failed.",
    });
  }

  return checks;
};
