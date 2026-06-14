import { createServer } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import handler from '../../api/mcp.js';

describe('Vercel MCP handler', () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeServer?.();
    closeServer = undefined;
  });

  it('delegates DELETE to the MCP SDK contract', async () => {
    const server = createServer((request, response) => {
      void handler(request, response);
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    closeServer = () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/mcp`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(200);
  });
});
