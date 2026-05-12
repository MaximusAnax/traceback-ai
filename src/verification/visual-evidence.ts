import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { VisualEvidencePacket, VisualEvidencePacketSchema } from "../contracts/visual-evidence-packet.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { ChangeSetPacket } from "../contracts/changeset-packet.js";
import { env } from "../config/env.js";
import { runPlaywrightVisualCheck } from "../integrations/playwright-mcp.js";

const artifactPath = (traceId: string, fileName: string) =>
  path.resolve(process.cwd(), env.TRACEBACK_ARTIFACTS_ROOT, traceId, fileName);

export const recordVisualEvidence = async (args: {
  job: MaintenanceJob;
  changeSet: ChangeSetPacket;
}): Promise<VisualEvidencePacket> => {
  const folder = path.resolve(process.cwd(), env.TRACEBACK_ARTIFACTS_ROOT, args.job.traceId);
  await mkdir(folder, { recursive: true });
  const videoDemoUri = artifactPath(args.job.traceId, "video-demo.json");
  const visualRegressionUri = artifactPath(args.job.traceId, "visual-regression.json");
  let packet: VisualEvidencePacket;

  if (env.CURSOR_RUNTIME !== "cloud") {
    packet = VisualEvidencePacketSchema.parse({
      status: "SKIP",
      runtime: "none",
      videoDemoUri,
      visualRegressionUri,
      summary: "Visual evidence skipped because Cursor Cloud runtime is not configured.",
      details: ["Set CURSOR_RUNTIME=cloud and configure Playwright MCP to capture browser evidence."],
    });
  } else {
    try {
      const result = await runPlaywrightVisualCheck({
        traceId: args.job.traceId,
        incidentId: args.job.incident.eventId,
        repository: `${args.job.incident.repository.owner}/${args.job.incident.repository.name}`,
        changeSummary: args.changeSet.diffSummary,
      });
      packet = VisualEvidencePacketSchema.parse({
        status: "PASS",
        runtime: "cursor-cloud",
        videoDemoUri,
        visualRegressionUri,
        summary: "Playwright MCP visual verification completed.",
        details: [JSON.stringify(result)],
      });
    } catch (error) {
      packet = VisualEvidencePacketSchema.parse({
        status: "FAIL",
        runtime: "cursor-cloud",
        videoDemoUri,
        visualRegressionUri,
        summary: "Playwright MCP visual verification failed.",
        details: [error instanceof Error ? error.message : "unknown visual verification error"],
      });
    }
  }

  await writeFile(videoDemoUri, JSON.stringify({ kind: "video-demo", packet }, null, 2), "utf8");
  await writeFile(
    visualRegressionUri,
    JSON.stringify({ kind: "visual-regression", packet }, null, 2),
    "utf8",
  );
  return packet;
};
