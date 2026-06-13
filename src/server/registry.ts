/**
 * MCP server registry. Aggregates tool definitions from
 * `src/tools/*` and wires them onto a `McpServer` instance.
 *
 * The actual transport selection lives in `src/transport/*`; this
 * module is transport-agnostic.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getDefaultLogger, type Logger } from '../utils/logger.js';
import { SCHEMA_VERSION } from '../schemas/index.js';
import { toolStubs } from '../tools/index.js';
import type { ToolDefinition } from '../tools/types.js';

export interface BuildServerOptions {
  readonly logger?: Logger | undefined;
  readonly name?: string | undefined;
  readonly version?: string | undefined;
}

export function buildServer(opts: BuildServerOptions = {}): McpServer {
  const logger: Logger = opts.logger ?? getDefaultLogger();
  const server = new McpServer({
    name: opts.name ?? 'patchproof-mcp',
    version: opts.version ?? '0.1.0',
  });

  // Tools are added by AC-2. Until then, the registry exports the
  // current (empty) list and the server still answers `tools/list`.
  for (const tool of toolStubs) {
    registerTool(server, tool, logger);
  }

  logger.debug('mcp server built', { schemaVersion: SCHEMA_VERSION, toolCount: toolStubs.length });
  return server;
}

function registerTool<I, O>(server: McpServer, tool: ToolDefinition<I, O>, logger: Logger): void {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
    },
    async (parsed, _extra) => {
      const started = Date.now();
      try {
        const out = await tool.run(
          { repoRoot: process.cwd(), signal: new AbortController().signal },
          parsed,
        );
        logger.debug('tool ok', { tool: tool.name, durationMs: Date.now() - started });
        return { content: [{ type: 'text', text: JSON.stringify(out) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('tool failed', { tool: tool.name, message: msg });
        throw err;
      }
    },
  );
}
