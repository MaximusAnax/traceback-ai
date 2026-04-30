import { Agent } from "@cursor/sdk";
import { env } from "../config/env.js";
import { CursorRunEnvelope, CursorRunEnvelopeSchema } from "../contracts/run-envelope.js";

export const runCursorPrompt = async (args: {
  role: "maestro" | "surgeon" | "verifier";
  prompt: string;
  modelId: string;
  cwd: string;
  agentName: string;
}): Promise<CursorRunEnvelope> => {
  const createOptions =
    env.CURSOR_RUNTIME === "cloud" && env.CURSOR_CLOUD_REPO_URL
      ? {
          apiKey: env.CURSOR_API_KEY,
          model: { id: args.modelId },
          cloud: {
            repos: [{ url: env.CURSOR_CLOUD_REPO_URL, startingRef: env.CURSOR_CLOUD_REPO_REF }],
          },
          name: args.agentName,
        }
      : {
          apiKey: env.CURSOR_API_KEY,
          model: { id: args.modelId },
          local: { cwd: args.cwd },
          name: args.agentName,
        };

  const agent = await Agent.create(createOptions);

  try {
    const run = await agent.send(args.prompt);
    const result = await run.wait();
    const outputText = result.result ?? "Agent completed without a textual result.";
    const tokenEstimate = Math.ceil((args.prompt.length + outputText.length) / 4);
    const estimatedUsd = Number((tokenEstimate * 0.0000025).toFixed(6));
    return CursorRunEnvelopeSchema.parse({
      role: args.role,
      runtime: env.CURSOR_RUNTIME,
      modelId: args.modelId,
      runId: result.id,
      agentId: run.agentId,
      status: result.status,
      outputText,
      durationMs: result.durationMs ?? 0,
      tokenEstimate,
      estimatedUsd,
      generatedAt: new Date().toISOString(),
    });
  } finally {
    agent.close();
  }
};
