import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

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

export async function startHttp(opts: StartHttpOptions): Promise<RunningHttpServer> {
  const httpServer = createServer((req, res) => {
    void handleRequest(req, res, opts.logger);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(opts.port, opts.host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : opts.port;
  const url = `http://${opts.host}:${port}/mcp`;
  opts.logger?.info('http transport started', { url });

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  logger: Logger | undefined,
): Promise<void> {
  if (req.url !== '/mcp') {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST, DELETE');
    res.end('Method Not Allowed');
    return;
  }

  const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
  const server = buildServer({ logger });
  try {
    const body = req.method === 'POST' ? await readJsonBody(req) : undefined;
    await server.connect(transport as unknown as Transport);
    await transport.handleRequest(req, res, body);
  } catch (error: unknown) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal server error',
          },
        }),
      );
    }
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 1_048_576) {
      throw new Error('Request body exceeds 1 MiB');
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
