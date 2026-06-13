/**
 * CLI entrypoint. Parses argv, picks a transport, and starts the
 * server. Logging goes to stderr; stdout is reserved for the MCP
 * protocol stream when the transport is stdio.
 */
import { loadConfig, type Config } from '../config.js';
import { getDefaultLogger, type Logger } from '../utils/logger.js';
import { startStdio } from '../transport/stdio.js';
import { startHttp } from '../transport/http.js';

export interface RunOptions {
  readonly argv?: ReadonlyArray<string>;
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: Logger;
}

export async function run(opts: RunOptions = {}): Promise<void> {
  const config: Config = loadConfig(opts.env, opts.argv ? [...opts.argv] : process.argv);
  const logger: Logger = opts.logger ?? getDefaultLogger();
  logger.info('starting patchproof-mcp', {
    transport: config.transport,
    osvMode: config.osvMode,
    quiet: config.quiet,
  });

  if (config.transport === 'stdio') {
    await startStdio({ logger });
    return;
  }
  await startHttp({ host: config.httpHost, port: config.httpPort, logger });
}
