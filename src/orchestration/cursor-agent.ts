import { Agent } from "@cursor/sdk";
import { env } from "../config/env.js";

export const runCursorPrompt = async (args: {
  prompt: string;
  modelId: string;
  cwd: string;
  agentName: string;
}): Promise<string> => {
  const agent = await Agent.create({
    apiKey: env.CURSOR_API_KEY,
    model: { id: args.modelId },
    local: { cwd: args.cwd },
    name: args.agentName,
  });

  try {
    const run = await agent.send(args.prompt);
    const result = await run.wait();
    return result.result ?? "Agent completed without a textual result.";
  } finally {
    agent.close();
  }
};
