import { afterEach, describe, expect, it } from 'vitest';

import { startHttp, type RunningHttpServer } from '../../src/transport/http.js';
import { LoggerImpl, StderrJsonSink } from '../../src/utils/logger.js';

describe('Streamable HTTP transport', () => {
  let running: RunningHttpServer | undefined;

  afterEach(async () => {
    await running?.close();
  });

  it('serves the four-tool MCP surface over HTTP', async () => {
    running = await startHttp({
      host: '127.0.0.1',
      port: 0,
      logger: new LoggerImpl({ sink: new StderrJsonSink({ quiet: true }) }),
    });

    const response = await fetch(running.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const payload = (await response.json()) as {
      result?: { tools?: ReadonlyArray<{ name: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.result?.tools?.map((tool) => tool.name)).toEqual([
      'scan_repository',
      'generate_sbom',
      'audit_dependencies',
      'generate_evidence_report',
    ]);

    const callResponse = await fetch(running.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'generate_evidence_report', arguments: {} },
      }),
    });
    const callPayload = (await callResponse.json()) as {
      result?: { content?: ReadonlyArray<{ text?: string }> };
    };
    const reportText = callPayload.result?.content?.[0]?.text ?? '';

    expect(callResponse.status).toBe(200);
    expect(reportText).toContain('PatchProof');
    expect(reportText).toContain('"findings"');
  });

  it('returns explicit HTTP errors for unsupported routes and methods', async () => {
    running = await startHttp({ host: '127.0.0.1', port: 0 });
    const origin = new URL(running.url).origin;

    const missing = await fetch(`${origin}/missing`);
    const method = await fetch(running.url);
    const removed = await fetch(running.url, { method: 'DELETE' });

    expect(missing.status).toBe(404);
    expect(method.status).toBe(405);
    expect(method.headers.get('allow')).toBe('POST, DELETE');
    expect(removed.status).toBe(200);
  });

  it('returns JSON-RPC error output for malformed JSON', async () => {
    running = await startHttp({ host: '127.0.0.1', port: 0 });
    const response = await fetch(running.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{broken',
    });
    const body = (await response.json()) as { error?: { code?: number } };

    expect(response.status).toBe(500);
    expect(body.error?.code).toBe(-32603);
  });
});
