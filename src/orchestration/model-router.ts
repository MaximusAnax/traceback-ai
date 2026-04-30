import { env } from "../config/env.js";
import { MaintenanceJob } from "../queue/jobs/maintenance-job.js";

export type AgentRole = "maestro" | "surgeon" | "verifier";

export type RoutingDecision = {
  modelId: string;
  maxUsd: number;
  maxTokens: number;
  reason: string;
};

export const chooseModelForRole = (role: AgentRole, job: MaintenanceJob): RoutingDecision => {
  if (role === "maestro") {
    return {
      modelId: env.CURSOR_MAESTRO_MODEL,
      maxUsd: job.incident.severity === "critical" ? 5.0 : 2.0,
      maxTokens: job.incident.severity === "critical" ? 90000 : 50000,
      reason: "Planner prioritizes high reasoning quality for root-cause decomposition.",
    };
  }

  if (role === "surgeon") {
    return {
      modelId: env.CURSOR_SURGEON_MODEL,
      maxUsd: job.incident.severity === "critical" ? 8.0 : 4.0,
      maxTokens: 80000,
      reason: "Codex-class model selected for surgical code edits.",
    };
  }

  return {
    modelId: env.CURSOR_VERIFIER_MODEL,
    maxUsd: 1.5,
    maxTokens: 30000,
    reason: "Verifier favors lower-cost model for repeatable gate checks.",
  };
};
