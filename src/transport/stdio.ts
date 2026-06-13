/**
 * stdio transport. Wraps the stdio driver from the MCP SDK and
 * connects it to the server built by `buildServer`.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { buildServer } from '../server/registry.js';
import { getDefaultLogger, type Logger } from '../utils/logger.js';

export async function startStdio(opts: { readonly logger?: Logger } = {}): Promise<void> {
  const logger: Logger = opts.logger ?? getDefaultLogger();
  const server = buildServer({ logger });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('stdio transport started');
}
