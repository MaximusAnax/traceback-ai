import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { env } from "../../config/env.js";

const CursorMcpServerSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const CursorMcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), CursorMcpServerSchema),
});

type CursorMcpServer = z.infer<typeof CursorMcpServerSchema>;

const resolveEnvTemplates = (input: Record<string, string>): Record<string, string> => {
  const templatePattern = /^\$\{([A-Z0-9_]+)\}$/;
  const resolved: Record<string, string> = {};

  for (const [key, value] of Object.entries(input)) {
    const templateMatch = value.match(templatePattern);
    if (!templateMatch) {
      resolved[key] = value;
      continue;
    }

    const envName = templateMatch[1];
    const envValue = process.env[envName];
    if (!envValue) {
      throw new Error(`MCP env template ${value} cannot be resolved: ${envName} is not set.`);
    }
    resolved[key] = envValue;
  }

  return resolved;
};

const readCursorMcpServer = async (serverName: string): Promise<CursorMcpServer> => {
  const cursorMcpPath = path.resolve(process.cwd(), ".cursor/mcp.json");
  const raw = await readFile(cursorMcpPath, "utf8");
  const parsed = CursorMcpConfigSchema.parse(JSON.parse(raw));
  const serverConfig = parsed.mcpServers[serverName];
  if (!serverConfig) {
    throw new Error(
      `MCP server "${serverName}" was not found in .cursor/mcp.json under mcpServers.`,
    );
  }
  return serverConfig;
};

export const callToolViaCursorMcp = async ({
  serverName,
  toolName,
  args,
}: {
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
}) => {
  const server = await readCursorMcpServer(serverName);
  let lastError: unknown;
  const attempts = env.SENTRY_MCP_MAX_RETRIES + 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args ?? [],
      env: server.env ? resolveEnvTemplates(server.env) : undefined,
      cwd: process.cwd(),
      stderr: "pipe",
    });
    const client = new Client({
      name: "traceback-mcp-client",
      version: "1.0.0",
    });

    try {
      await client.connect(transport);
      const timeout = new Promise<never>((_resolve, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `MCP tool call timed out after ${env.SENTRY_MCP_TIMEOUT_MS}ms (${serverName}/${toolName}).`,
            ),
          );
        }, env.SENTRY_MCP_TIMEOUT_MS);
      });
      return await Promise.race([
        client.callTool({
          name: toolName,
          arguments: args,
        }),
        timeout,
      ]);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }
    } finally {
      await transport.close();
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown MCP tool failure.");
};
