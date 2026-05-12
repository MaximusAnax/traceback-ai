import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ChangeSetPacket } from "../contracts/changeset-packet.js";
import {
  RuleAuditFindingSchema,
  RuleAuditPacket,
  RuleAuditPacketSchema,
} from "../contracts/rule-audit-packet.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";
import { env } from "../config/env.js";

const rulesDir = path.resolve(process.cwd(), ".cursor/rules");

const readRuleFiles = async (): Promise<Array<{ name: string; content: string }>> => {
  try {
    const entries = await readdir(rulesDir);
    const ruleFiles = entries.filter((entry) => entry.endsWith(".mdc"));
    return Promise.all(
      ruleFiles.map(async (name) => ({
        name,
        content: await readFile(path.join(rulesDir, name), "utf8"),
      })),
    );
  } catch {
    return [];
  }
};

export const runRuleAudit = async (args: {
  job: MaintenanceJob;
  changeSet: ChangeSetPacket;
  artifactUris: string[];
}): Promise<RuleAuditPacket> => {
  const rules = await readRuleFiles();
  const findings = rules.map((rule) =>
    RuleAuditFindingSchema.parse({
      rule: rule.name,
      status: "PASS",
      summary: `Rule file ${rule.name} was included in the audit context.`,
    }),
  );
  const securityFindings: string[] = [];

  if (args.changeSet.filesModified.some((file) => file.includes(".env"))) {
    securityFindings.push("ChangeSet references .env or secret-bearing configuration files.");
    findings.push({
      rule: "agentic-loop-protocol.mdc",
      status: "FAIL",
      summary: "Agents must not modify .env or configuration secrets without explicit authorization.",
    });
  }

  if (args.changeSet.knownLimitations.some((item) => item.includes("fallback"))) {
    findings.push({
      rule: "agentic-loop-protocol.mdc",
      status: "WARN",
      summary: "A fallback path was used; human review should verify the patch was actually applied.",
    });
  }

  const status = findings.some((finding) => finding.status === "FAIL")
    ? "FAIL"
    : findings.some((finding) => finding.status === "WARN")
      ? "WARN"
      : "PASS";

  const packet = RuleAuditPacketSchema.parse({
    status,
    rulesChecked: rules.map((rule) => rule.name),
    findings,
    securityFindings,
    artifactUris: args.artifactUris,
  });

  const folder = path.resolve(process.cwd(), env.TRACEBACK_ARTIFACTS_ROOT, args.job.traceId);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "rule-audit.json"), JSON.stringify(packet, null, 2), "utf8");
  return packet;
};
