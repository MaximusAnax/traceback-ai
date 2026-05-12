import { Agent } from "@cursor/sdk";
import { env } from "../config/env.js";
import { CursorRunEnvelope, CursorRunEnvelopeSchema } from "../contracts/run-envelope.js";

const fallbackModelsFor = (modelId: string): string[] => {
  if (modelId === "gpt-5.4-codex") return [modelId, "gpt-5.3-codex"];
  return [modelId];
};

export const runCursorPrompt = async (args: {
  role: "maestro" | "surgeon" | "verifier";
  prompt: string;
  modelId: string;
  cwd: string;
  agentName: string;
}): Promise<CursorRunEnvelope> => {
  let lastError: unknown;
  const modelCandidates = fallbackModelsFor(args.modelId);
  for (const modelId of modelCandidates) {
    const createOptions =
      env.CURSOR_RUNTIME === "cloud" && env.CURSOR_CLOUD_REPO_URL
        ? {
            apiKey: env.CURSOR_API_KEY,
            model: { id: modelId },
            cloud: {
              repos: [{ url: env.CURSOR_CLOUD_REPO_URL, startingRef: env.CURSOR_CLOUD_REPO_REF }],
            },
            name: args.agentName,
          }
        : {
            apiKey: env.CURSOR_API_KEY,
            model: { id: modelId },
            local: { cwd: args.cwd },
            name: args.agentName,
          };

    let agent: Awaited<ReturnType<typeof Agent.create>> | undefined;

    try {
      agent = await Agent.create(createOptions);
      const run = await agent.send(args.prompt);
      const result = await run.wait();
      const outputText = result.result ?? "Agent completed without a textual result.";
      const tokenEstimate = Math.ceil((args.prompt.length + outputText.length) / 4);
      const estimatedUsd = Number((tokenEstimate * 0.0000025).toFixed(6));
      return CursorRunEnvelopeSchema.parse({
        role: args.role,
        runtime: env.CURSOR_RUNTIME,
        modelId,
        runId: result.id,
        agentId: run.agentId,
        status: result.status,
        outputText,
        durationMs: result.durationMs ?? 0,
        tokenEstimate,
        estimatedUsd,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      lastError = error;
      if (modelId === modelCandidates.at(-1)) throw error;
    } finally {
      agent?.close();
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Cursor SDK execution failed.");
};
