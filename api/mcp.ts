import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import { buildServer } from '../src/server/registry.js';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

const demoRepoRoot = path.join(process.cwd(), 'fixtures', 'demo-repository');

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  if (req.method === 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST, DELETE');
    res.end('Use POST /api/mcp for MCP JSON-RPC requests.');
    return;
  }

  if (req.method === 'DELETE') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST, DELETE');
    res.end('Method Not Allowed');
    return;
  }

  const body = lockToolCallToDemoFixture(req.body);
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  const server = buildServer({ repoRoot: demoRepoRoot });

  try {
    // SDK 1.29's Node wrapper and base Transport declarations disagree only
    // under exactOptionalPropertyTypes; their runtime contract is identical.
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

function lockToolCallToDemoFixture(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  const message = body as Record<string, unknown>;
  if (message['method'] !== 'tools/call') return body;

  const params = message['params'];
  if (!params || typeof params !== 'object' || Array.isArray(params)) return body;

  const paramsRecord = params as Record<string, unknown>;
  const args =
    paramsRecord['arguments'] &&
    typeof paramsRecord['arguments'] === 'object' &&
    !Array.isArray(paramsRecord['arguments'])
      ? (paramsRecord['arguments'] as Record<string, unknown>)
      : {};

  return {
    ...message,
    params: {
      ...paramsRecord,
      arguments: {
        ...args,
        repoRoot: demoRepoRoot,
      },
    },
  };
}
