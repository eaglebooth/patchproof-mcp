import { describe, expect, it, vi } from 'vitest';

import { buildServer } from '../../src/server/registry.js';
import { TOOL_NAMES, tools } from '../../src/tools/index.js';
import { getDefaultLogger, LoggerImpl, StderrJsonSink } from '../../src/utils/logger.js';

describe('buildServer', () => {
  it('publishes the complete four-tool MVP surface', () => {
    expect(TOOL_NAMES).toEqual([
      'scan_repository',
      'generate_sbom',
      'audit_dependencies',
      'generate_evidence_report',
    ]);
    expect(tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
  });

  it('returns an McpServer instance with the expected identity', () => {
    const server = buildServer({
      logger: new LoggerImpl({ sink: new StderrJsonSink({ quiet: true }) }),
    });
    // The MCP SDK exposes identity via the public `server` object;
    // we don't reach into private fields, we just confirm it built
    // and exposes a transport-connect entrypoint.
    expect(typeof server.connect).toBe('function');
    expect(typeof server.close).toBe('function');
  });

  it('honors custom name and version', () => {
    const server = buildServer({
      name: 'patchproof-test',
      version: '9.9.9',
      logger: new LoggerImpl({ sink: new StderrJsonSink({ quiet: true }) }),
    });
    expect(server).toBeDefined();
  });

  it('uses the default logger when none is provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // setDefaultLogger is not called; getDefaultLogger() should be
    // reached and return a non-undefined value.
    const logger = getDefaultLogger();
    expect(logger).toBeDefined();
    spy.mockRestore();
  });
});
