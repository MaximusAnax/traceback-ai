import { z } from "zod";
import { MaintenanceJob } from "../../queue/jobs/maintenance-job.js";

export const SentryContextEnvelopeSchema = z.object({
  provider: z.literal("sentry"),
  eventId: z.string(),
  stacktrace: z.string(),
  breadcrumbs: z.array(z.string()),
  tags: z.record(z.string(), z.string()),
  repository: z.object({
    owner: z.string(),
    name: z.string(),
    defaultBranch: z.string(),
  }),
  mcpReady: z.boolean(),
});

export type SentryContextEnvelope = z.infer<typeof SentryContextEnvelopeSchema>;

const McpToolResultSchema = z.object({
  structuredContent: z.record(z.string(), z.unknown()).optional(),
  content: z
    .array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
      }),
    )
    .optional(),
});

export const parseSentryContextFromMcpResult = (
  job: MaintenanceJob,
  rawToolResult: unknown,
): SentryContextEnvelope => {
  const toolResult = McpToolResultSchema.parse(rawToolResult);

  if (toolResult.structuredContent) {
    return SentryContextEnvelopeSchema.parse({
      ...toolResult.structuredContent,
      eventId: job.incident.eventId,
    });
  }

  if (toolResult.content) {
    const textParts = toolResult.content.flatMap((part) => {
      if (part.type !== "text" || typeof part.text !== "string") {
        return [];
      }
      const trimmed = part.text.trim();
      return trimmed ? [trimmed] : [];
    });
    for (const text of textParts) {
      try {
        const parsed = JSON.parse(text);
        return SentryContextEnvelopeSchema.parse({
          ...parsed,
          eventId: job.incident.eventId,
        });
      } catch {
        continue;
      }
    }
  }

  throw new Error(
    "Sentry MCP tool did not return parseable structured content. Expected JSON object matching SentryContextEnvelope.",
  );
};
