import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { SeveritySchema } from "../../contracts/incident.js";
import { ingestQueue } from "../../queue/queues.js";
import { buildMaintenanceJobId } from "../../queue/jobs/maintenance-job.js";

const GitHubRepositorySchema = z.object({
  full_name: z.string().min(1),
  html_url: z.string().url().optional(),
  default_branch: z.string().min(1).default("main"),
  owner: z.object({ login: z.string().min(1) }),
  name: z.string().min(1),
});

const GitHubWebhookSchema = z
  .object({
    action: z.string().optional(),
    repository: GitHubRepositorySchema,
    issue: z
      .object({
        id: z.number().int(),
        number: z.number().int(),
        title: z.string().min(1),
        body: z.string().nullable().optional(),
        html_url: z.string().url().optional(),
        labels: z.array(z.object({ name: z.string() })).default([]),
      })
      .optional(),
    pull_request: z
      .object({
        id: z.number().int(),
        number: z.number().int(),
        title: z.string().min(1),
        body: z.string().nullable().optional(),
        html_url: z.string().url().optional(),
        head: z.object({ ref: z.string().min(1), sha: z.string().min(1) }),
      })
      .optional(),
    check_run: z
      .object({
        id: z.number().int(),
        name: z.string().min(1),
        conclusion: z.string().nullable().optional(),
        html_url: z.string().url().optional(),
        head_sha: z.string().optional(),
        output: z
          .object({
            title: z.string().nullable().optional(),
            summary: z.string().nullable().optional(),
            text: z.string().nullable().optional(),
          })
          .optional(),
      })
      .optional(),
    workflow_run: z
      .object({
        id: z.number().int(),
        name: z.string().min(1),
        conclusion: z.string().nullable().optional(),
        html_url: z.string().url().optional(),
        head_sha: z.string().optional(),
        head_branch: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const severityFromGitHubPayload = (
  payload: z.infer<typeof GitHubWebhookSchema>,
): z.infer<typeof SeveritySchema> => {
  const labels = payload.issue?.labels.map((label) => label.name.toLowerCase()) ?? [];
  if (labels.some((label) => label.includes("critical") || label.includes("sev0"))) return "critical";
  if (labels.some((label) => label.includes("high") || label.includes("sev1"))) return "high";
  if (payload.check_run?.conclusion === "failure" || payload.workflow_run?.conclusion === "failure") {
    return "high";
  }
  return "medium";
};

const verifyGitHubSignature = (rawBody: Buffer, signatureHeader: string): boolean => {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const signature = signatureHeader.slice("sha256=".length);
  const expectedSignature = createHmac("sha256", env.GITHUB_WEBHOOK_SECRET ?? "")
    .update(rawBody)
    .digest("hex");
  const provided = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
};

const describeGitHubIncident = (payload: z.infer<typeof GitHubWebhookSchema>) => {
  if (payload.issue) {
    return {
      eventId: `github-issue-${payload.issue.id}`,
      title: payload.issue.title,
      message: payload.issue.body || payload.issue.title,
      culprit: `issues/${payload.issue.number}`,
      fingerprint: ["github", "issue", String(payload.issue.id)],
      stacktrace: payload.issue.body || payload.issue.title,
      metadata: { url: payload.issue.html_url, number: payload.issue.number },
    };
  }

  if (payload.pull_request) {
    return {
      eventId: `github-pr-${payload.pull_request.id}`,
      title: payload.pull_request.title,
      message: payload.pull_request.body || payload.pull_request.title,
      culprit: `pull/${payload.pull_request.number}`,
      fingerprint: ["github", "pull_request", String(payload.pull_request.id)],
      stacktrace: payload.pull_request.body || payload.pull_request.title,
      metadata: {
        url: payload.pull_request.html_url,
        number: payload.pull_request.number,
        headRef: payload.pull_request.head.ref,
        headSha: payload.pull_request.head.sha,
      },
    };
  }

  if (payload.check_run) {
    const summary = [
      payload.check_run.output?.title,
      payload.check_run.output?.summary,
      payload.check_run.output?.text,
    ]
      .filter(Boolean)
      .join("\n\n");
    return {
      eventId: `github-check-run-${payload.check_run.id}`,
      title: `${payload.check_run.name} check ${payload.check_run.conclusion ?? "completed"}`,
      message: summary || payload.check_run.name,
      culprit: `checks/${payload.check_run.id}`,
      fingerprint: ["github", "check_run", String(payload.check_run.id)],
      stacktrace: summary || payload.check_run.name,
      metadata: {
        url: payload.check_run.html_url,
        headSha: payload.check_run.head_sha,
        conclusion: payload.check_run.conclusion,
      },
    };
  }

  const run = payload.workflow_run;
  return {
    eventId: `github-workflow-run-${run?.id ?? randomUUID()}`,
    title: `${run?.name ?? "workflow"} ${run?.conclusion ?? "completed"}`,
    message: run?.name ?? "GitHub workflow event",
    culprit: `actions/runs/${run?.id ?? "unknown"}`,
    fingerprint: ["github", "workflow_run", String(run?.id ?? "unknown")],
    stacktrace: run?.name ?? "GitHub workflow event",
    metadata: {
      url: run?.html_url,
      headSha: run?.head_sha,
      headBranch: run?.head_branch,
      conclusion: run?.conclusion,
    },
  };
};

export const registerGitHubWebhook = async (app: FastifyInstance): Promise<void> => {
  app.post("/webhooks/github", { config: { rawBody: true } }, async (request, reply) => {
    if (!env.GITHUB_WEBHOOK_SECRET) {
      return reply.code(503).send({ error: "GITHUB_WEBHOOK_SECRET is not configured" });
    }

    const signature = request.headers["x-hub-signature-256"];
    if (typeof signature !== "string") {
      return reply.code(401).send({ error: "missing signature" });
    }

    const rawBody = request.rawBody;
    if (!Buffer.isBuffer(rawBody)) {
      return reply.code(400).send({ error: "raw body unavailable for signature verification" });
    }

    if (!verifyGitHubSignature(rawBody, signature)) {
      return reply.code(401).send({ error: "invalid signature" });
    }

    const payload = GitHubWebhookSchema.parse(request.body);
    const deliveryId =
      typeof request.headers["x-github-delivery"] === "string"
        ? request.headers["x-github-delivery"]
        : undefined;
    const webhookEvent =
      typeof request.headers["x-github-event"] === "string"
        ? request.headers["x-github-event"]
        : "github";
    const incident = describeGitHubIncident(payload);
    const traceId = randomUUID();
    const receivedAt = new Date().toISOString();
    const severity = severityFromGitHubPayload(payload);
    const queueJob = {
      traceId,
      incident: {
        provider: "github" as const,
        eventId: incident.eventId,
        fingerprint: incident.fingerprint,
        title: incident.title,
        message: incident.message,
        culprit: incident.culprit,
        stacktrace: incident.stacktrace,
        breadcrumbs: [],
        tags: {
          githubEvent: webhookEvent,
          action: payload.action ?? "unknown",
        },
        repository: {
          owner: payload.repository.owner.login,
          name: payload.repository.name,
          defaultBranch: payload.repository.default_branch,
          url: payload.repository.html_url,
        },
        severity,
        receivedAt,
        providerMetadata: {
          action: payload.action,
          deliveryId,
          event: webhookEvent,
          ...incident.metadata,
        },
      },
      source: {
        provider: "github" as const,
        webhookEvent,
        deliveryId,
        receivedAt,
      },
      priority: {
        value: severity === "critical" ? 1 : severity === "high" ? 3 : 5,
        reason: `GitHub ${webhookEvent} normalized as ${severity}.`,
      },
    };

    await ingestQueue.add("maintenance", queueJob, {
      jobId: buildMaintenanceJobId(incident.eventId, incident.fingerprint),
      priority: queueJob.priority.value,
    });

    return reply.code(202).send({ accepted: true, traceId });
  });
};
