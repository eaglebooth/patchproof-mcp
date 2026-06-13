/**
 * Structured logger that writes to stderr. MCP hosts expect stdout
 * to carry only the protocol stream, so we never log to stdout.
 *
 * The logger accepts an injected `Clock` and `Writers` so tests can
 * capture output without touching globals.
 */
import { redactMessage } from '../security/redact.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  readonly level: LogLevel;
  readonly ts: string;
  readonly msg: string;
  readonly fields?: Readonly<Record<string, unknown>>;
}

export interface LogSink {
  write(entry: LogEntry): void;
}

export class StderrJsonSink implements LogSink {
  private readonly quiet: boolean;

  constructor(opts: { readonly quiet?: boolean } = {}) {
    this.quiet = opts.quiet ?? false;
  }

  write(entry: LogEntry): void {
    if (this.quiet && entry.level !== 'error') return;
    const safe: LogEntry = {
      level: entry.level,
      ts: entry.ts,
      msg: redactMessage(entry.msg),
      ...(entry.fields !== undefined ? { fields: redactFields(entry.fields) } : {}),
    };
    const line = JSON.stringify(safe, jsonReplacer);
    process.stderr.write(line + '\n');
  }
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: redactMessage(value.message), stack: value.stack };
  }
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function redactFields(fields: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') {
      out[k] = redactMessage(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface Logger {
  debug(msg: string, fields?: Readonly<Record<string, unknown>>): void;
  info(msg: string, fields?: Readonly<Record<string, unknown>>): void;
  warn(msg: string, fields?: Readonly<Record<string, unknown>>): void;
  error(msg: string, fields?: Readonly<Record<string, unknown>>): void;
  child(bindings: Readonly<Record<string, unknown>>): Logger;
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export class LoggerImpl implements Logger {
  private readonly sink: LogSink;
  private readonly minLevel: LogLevel;
  private readonly bindings: Readonly<Record<string, unknown>>;
  private readonly clock: () => Date;

  constructor(opts: {
    readonly sink: LogSink;
    readonly minLevel?: LogLevel;
    readonly bindings?: Readonly<Record<string, unknown>>;
    readonly clock?: () => Date;
  }) {
    this.sink = opts.sink;
    this.minLevel = opts.minLevel ?? 'info';
    this.bindings = opts.bindings ?? {};
    this.clock = opts.clock ?? (() => new Date());
  }

  child(bindings: Readonly<Record<string, unknown>>): Logger {
    return new LoggerImpl({
      sink: this.sink,
      minLevel: this.minLevel,
      bindings: { ...this.bindings, ...bindings },
      clock: this.clock,
    });
  }

  private log(level: LogLevel, msg: string, fields?: Readonly<Record<string, unknown>>): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.minLevel]) return;
    const merged = fields ? { ...this.bindings, ...fields } : this.bindings;
    const entry: LogEntry = {
      level,
      ts: this.clock().toISOString(),
      msg,
      ...(Object.keys(merged).length > 0 ? { fields: merged } : {}),
    };
    this.sink.write(entry);
  }

  debug(msg: string, fields?: Readonly<Record<string, unknown>>): void {
    this.log('debug', msg, fields);
  }
  info(msg: string, fields?: Readonly<Record<string, unknown>>): void {
    this.log('info', msg, fields);
  }
  warn(msg: string, fields?: Readonly<Record<string, unknown>>): void {
    this.log('warn', msg, fields);
  }
  error(msg: string, fields?: Readonly<Record<string, unknown>>): void {
    this.log('error', msg, fields);
  }
}

let defaultLogger: Logger | undefined;

export function getDefaultLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new LoggerImpl({ sink: new StderrJsonSink() });
  }
  return defaultLogger;
}

export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}
