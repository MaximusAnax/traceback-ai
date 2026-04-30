import { readFile } from "node:fs/promises";
import path from "node:path";
import { MaintenanceJob } from "../../queue/jobs/maintenance-job.js";
import { env } from "../../config/env.js";
import { callToolViaCursorMcp } from "../../integrations/mcp/client.js";
import { recordWeaveTraceEvent } from "../../observability/weave.js";
import {
  SentryContextEnvelopeSchema,
  type SentryContextEnvelope,
  parseSentryContextFromMcpResult,
} from "./sentry-mcp-parser.js";

export interface SentryContextProvider {
  getContext(job: MaintenanceJob): Promise<SentryContextEnvelope>;
}

export class InlineSentryContextProvider implements SentryContextProvider {
  async getContext(job: MaintenanceJob): Promise<SentryContextEnvelope> {
    return SentryContextEnvelopeSchema.parse({
      provider: "sentry",
      eventId: job.incident.eventId,
      stacktrace: job.incident.stacktrace,
      breadcrumbs: job.incident.breadcrumbs,
      tags: job.incident.tags,
      repository: job.incident.repository,
      mcpReady: true,
    });
  }
}

export class FixtureSentryContextProvider implements SentryContextProvider {
  async getContext(job: MaintenanceJob): Promise<SentryContextEnvelope> {
    const fixturePath = path.resolve(process.cwd(), env.SENTRY_FIXTURE_PATH);
    const raw = await readFile(fixturePath, "utf8");
    const fixture = JSON.parse(raw);
    return SentryContextEnvelopeSchema.parse({
      ...fixture,
      eventId: fixture.eventId ?? job.incident.eventId,
      repository: fixture.repository ?? job.incident.repository,
    });
  }
}

export class McpSentryContextProvider implements SentryContextProvider {
  async getContext(job: MaintenanceJob): Promise<SentryContextEnvelope> {
    if (!env.SENTRY_MCP_SERVER || !env.SENTRY_MCP_TOOL) {
      throw new Error(
        "SENTRY_MCP_SERVER and SENTRY_MCP_TOOL must be configured to use SENTRY_CONTEXT_SOURCE=mcp.",
      );
    }

    await recordWeaveTraceEvent({
      traceId: job.traceId,
      role: "context-provider",
      action: "sentry-mcp-context-fetch",
      status: "started",
      metadata: { server: env.SENTRY_MCP_SERVER, tool: env.SENTRY_MCP_TOOL },
    });

    try {
      const rawToolResult = await callToolViaCursorMcp({
        serverName: env.SENTRY_MCP_SERVER,
        toolName: env.SENTRY_MCP_TOOL,
        args: {
          eventId: job.incident.eventId,
          traceId: job.traceId,
          incident: job.incident,
        },
      });
      const parsed = parseSentryContextFromMcpResult(job, rawToolResult);
      await recordWeaveTraceEvent({
        traceId: job.traceId,
        role: "context-provider",
        action: "sentry-mcp-context-fetch",
        status: "succeeded",
        metadata: { eventId: job.incident.eventId },
      });
      return parsed;
    } catch (error) {
      await recordWeaveTraceEvent({
        traceId: job.traceId,
        role: "context-provider",
        action: "sentry-mcp-context-fetch",
        status: "failed",
        metadata: { reason: error instanceof Error ? error.message : "unknown" },
      });
      throw error;
    }
  }
}

export const createSentryContextProvider = (): SentryContextProvider => {
  if (env.SENTRY_CONTEXT_SOURCE === "fixture") {
    return new FixtureSentryContextProvider();
  }
  if (env.SENTRY_CONTEXT_SOURCE === "mcp") {
    return new McpSentryContextProvider();
  }
  return new InlineSentryContextProvider();
};
