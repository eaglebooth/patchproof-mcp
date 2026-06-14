import { describe, expect, it, vi } from 'vitest';

import {
  LoggerImpl,
  setDefaultLogger,
  getDefaultLogger,
  StderrJsonSink,
  type LogEntry,
  type LogSink,
} from '../../src/utils/logger.js';

class CapturingSink implements LogSink {
  readonly entries: LogEntry[] = [];
  write(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

describe('structured logger', () => {
  it('filters levels and merges child bindings', () => {
    const sink = new CapturingSink();
    const logger = new LoggerImpl({
      sink,
      minLevel: 'info',
      bindings: { service: 'patchproof' },
      clock: () => new Date('2026-06-14T00:00:00.000Z'),
    });

    logger.debug('hidden');
    logger.child({ workflow: 'audit' }).info('visible', { count: 2 });

    expect(sink.entries).toEqual([
      {
        level: 'info',
        ts: '2026-06-14T00:00:00.000Z',
        msg: 'visible',
        fields: { service: 'patchproof', workflow: 'audit', count: 2 },
      },
    ]);
  });

  it('writes redacted JSON and serializes errors and bigint', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const sink = new StderrJsonSink();
    sink.write({
      level: 'error',
      ts: '2026-06-14T00:00:00.000Z',
      msg: 'token AKIAIOSFODNN7EXAMPLE',
      fields: { error: new Error('ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'), count: 2n },
    });
    const output = String(spy.mock.calls[0]?.[0] ?? '');

    expect(output).toContain('[REDACTED]');
    expect(output).toContain('"count":"2"');
    expect(output).not.toContain('AKIAIOSFODNN7EXAMPLE');
    spy.mockRestore();
  });

  it('quiet sink emits only errors', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const sink = new StderrJsonSink({ quiet: true });
    sink.write({ level: 'info', ts: 'x', msg: 'hidden' });
    sink.write({ level: 'error', ts: 'x', msg: 'shown' });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('supports all log methods and injected default logger', () => {
    const sink = new CapturingSink();
    const logger = new LoggerImpl({ sink, minLevel: 'debug' });
    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');
    setDefaultLogger(logger);

    expect(getDefaultLogger()).toBe(logger);
    expect(sink.entries.map((entry) => entry.level)).toEqual(['debug', 'info', 'warn', 'error']);
  });
});
