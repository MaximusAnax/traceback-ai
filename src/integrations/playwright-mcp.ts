import { env } from "../config/env.js";
import { callToolViaCursorMcp } from "./mcp/client.js";

export const runPlaywrightVisualCheck = async (args: {
  traceId: string;
  incidentId: string;
  repository: string;
  changeSummary: string;
}) => {
  if (!env.PLAYWRIGHT_MCP_SERVER || !env.PLAYWRIGHT_MCP_VISUAL_TOOL) {
    throw new Error("PLAYWRIGHT_MCP_SERVER and PLAYWRIGHT_MCP_VISUAL_TOOL are not configured.");
  }

  return callToolViaCursorMcp({
    serverName: env.PLAYWRIGHT_MCP_SERVER,
    toolName: env.PLAYWRIGHT_MCP_VISUAL_TOOL,
    args,
  });
};

export const lookupExternalKnowledge = async (args: {
  query: string;
  traceId?: string;
  repository?: string;
}) => {
  if (!env.PLAYWRIGHT_MCP_SERVER || !env.PLAYWRIGHT_MCP_DOCS_TOOL) {
    throw new Error("PLAYWRIGHT_MCP_SERVER and PLAYWRIGHT_MCP_DOCS_TOOL are not configured.");
  }

  return callToolViaCursorMcp({
    serverName: env.PLAYWRIGHT_MCP_SERVER,
    toolName: env.PLAYWRIGHT_MCP_DOCS_TOOL,
    args,
  });
};
