/**
 * Streamable HTTP transport. The actual `McpServer` ↔ HTTP wiring
 * is finalized in AC-15; this stub keeps the file present and
 * typechecked so the build is green at the scaffold stage.
 */
import { buildServer } from '../server/registry.js';
import type { Logger } from '../utils/logger.js';

export interface StartHttpOptions {
  readonly host: string;
  readonly port: number;
  readonly logger?: Logger | undefined;
}

export interface RunningHttpServer {
  close(): Promise<void>;
  readonly url: string;
}

export function startHttp(opts: StartHttpOptions): Promise<RunningHttpServer> {
  const server = buildServer({ logger: opts.logger });
  // Real HTTP wiring lands in AC-15. The scaffold returns a noop
  // server so callers can already typecheck the lifecycle.
  const url = `http://${opts.host}:${opts.port}/mcp`;
  return Promise.resolve({
    url,
    async close(): Promise<void> {
      await server.close();
    },
  });
}
