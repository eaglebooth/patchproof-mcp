/**
 * MCP server registry. Aggregates the 8 tool definitions from
 * `src/tools/*` and wires them onto a `McpServer` instance.
 *
 * The actual transport selection lives in `src/transport/*`; this
 * module is transport-agnostic.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getDefaultLogger, type Logger } from '../utils/logger.js';
import { SCHEMA_VERSION } from '../schemas/index.js';
import { tools, type ToolDefinition } from '../tools/index.js';
import { redactMessage } from '../security/redact.js';
import { safeResolve } from '../security/paths.js';
import { InvalidInputError, isPatchProofError } from '../security/errors.js';

export interface BuildServerOptions {
  readonly logger?: Logger | undefined;
  readonly name?: string | undefined;
  readonly version?: string | undefined;
  /** Default repo root used when a tool call does not supply one. */
  readonly repoRoot?: string | undefined;
}

export function buildServer(opts: BuildServerOptions = {}): McpServer {
  const logger: Logger = opts.logger ?? getDefaultLogger();
  const server = new McpServer({
    name: opts.name ?? 'patchproof-mcp',
    version: opts.version ?? '0.1.0',
  });

  const defaultRepoRoot = resolveDefaultRepoRoot(opts.repoRoot);

  for (const tool of tools) {
    registerTool(server, tool, logger, defaultRepoRoot);
  }

  logger.debug('mcp server built', { schemaVersion: SCHEMA_VERSION, toolCount: tools.length });
  return server;
}

function resolveDefaultRepoRoot(repoRoot: string | undefined): string {
  if (typeof repoRoot === 'string' && repoRoot.length > 0) {
    return safeResolve(repoRoot, '.');
  }
  return safeResolve(process.cwd(), '.');
}

function registerTool(
  server: McpServer,
  tool: ToolDefinition,
  logger: Logger,
  defaultRepoRoot: string,
): void {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
    },
    async (parsed: unknown, _extra: unknown) => {
      const started = Date.now();
      try {
        const out = await tool.run(
          { repoRoot: defaultRepoRoot, signal: new AbortController().signal },
          parsed,
        );
        logger.debug('tool ok', { tool: tool.name, durationMs: Date.now() - started });
        return { content: [{ type: 'text', text: JSON.stringify(out) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isPatchProofError(err) && err instanceof InvalidInputError) {
          // Re-throw with the redacted message; the SDK surfaces
          // this as a tool error to the MCP host.
          logger.error('tool rejected input', { tool: tool.name, code: err.code });
          throw new InvalidInputError(redactMessage(msg), { ...err.details, code: err.code });
        }
        logger.error('tool failed', { tool: tool.name, message: redactMessage(msg) });
        throw err;
      }
    },
  );
}
