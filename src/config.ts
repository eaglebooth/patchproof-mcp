/**
 * Centralised environment-driven configuration.
 *
 * No `process.env` reads should appear outside this file; everything
 * else consumes a `Config` object so tests can pass in a fixed
 * snapshot.
 */
import { z } from 'zod';

const Port = z
  .string()
  .regex(/^\d+$/u, 'must be a non-negative integer')
  .transform((s) => Number.parseInt(s, 10))
  .pipe(z.number().int().min(0).max(65535))
  .default('8765');

const TransportSchema = z.enum(['stdio', 'http']);
const OsvModeSchema = z.literal('mock');

const ConfigSchema = z
  .object({
    transport: TransportSchema.default('stdio'),
    httpHost: z.string().default('127.0.0.1'),
    httpPort: Port,
    httpPublic: z
      .union([z.literal('0'), z.literal('1')])
      .default('0')
      .transform((v) => v === '1'),
    demoPort: Port.default('8787'),

    osvMode: OsvModeSchema.default('mock'),
    osvTimeoutMs: z
      .string()
      .regex(/^\d+$/u)
      .default('5000')
      .transform((s) => Number.parseInt(s, 10))
      .pipe(z.number().int().positive()),
    osvRetries: z
      .string()
      .regex(/^\d+$/u)
      .default('2')
      .transform((s) => Number.parseInt(s, 10))
      .pipe(z.number().int().min(0).max(10)),
    osvCacheTtlMs: z
      .string()
      .regex(/^\d+$/u)
      .default('3600000')
      .transform((s) => Number.parseInt(s, 10))
      .pipe(z.number().int().positive()),
    osvRatePerMin: z
      .string()
      .regex(/^\d+$/u)
      .default('60')
      .transform((s) => Number.parseInt(s, 10))
      .pipe(z.number().int().positive()),

    maxFiles: z
      .string()
      .regex(/^\d+$/u)
      .default('50000')
      .transform((s) => Number.parseInt(s, 10))
      .pipe(z.number().int().positive()),
    maxBytes: z
      .string()
      .regex(/^\d+$/u)
      .default('524288000')
      .transform((s) => Number.parseInt(s, 10))
      .pipe(z.number().int().positive()),
    maxDepth: z
      .string()
      .regex(/^\d+$/u)
      .default('10')
      .transform((s) => Number.parseInt(s, 10))
      .pipe(z.number().int().positive()),
    scanTimeoutMs: z
      .string()
      .regex(/^\d+$/u)
      .default('60000')
      .transform((s) => Number.parseInt(s, 10))
      .pipe(z.number().int().positive()),
    verifyTimeoutMs: z
      .string()
      .regex(/^\d+$/u)
      .default('120000')
      .transform((s) => Number.parseInt(s, 10))
      .pipe(z.number().int().positive()),

    quiet: z
      .union([z.literal('0'), z.literal('1')])
      .default('0')
      .transform((v) => v === '1'),
  })
  .strict();

export type Transport = z.infer<typeof TransportSchema>;
export type OsvMode = z.infer<typeof OsvModeSchema>;

export interface Config {
  readonly transport: Transport;
  readonly httpHost: string;
  readonly httpPort: number;
  readonly httpPublic: boolean;
  readonly demoPort: number;
  readonly osvMode: OsvMode;
  readonly osvTimeoutMs: number;
  readonly osvRetries: number;
  readonly osvCacheTtlMs: number;
  readonly osvRatePerMin: number;
  readonly maxFiles: number;
  readonly maxBytes: number;
  readonly maxDepth: number;
  readonly scanTimeoutMs: number;
  readonly verifyTimeoutMs: number;
  readonly quiet: boolean;
}

const PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['transport', 'PATCHPROOF_TRANSPORT'],
  ['httpHost', 'PATCHPROOF_HTTP_HOST'],
  ['httpPort', 'PATCHPROOF_HTTP_PORT'],
  ['httpPublic', 'PATCHPROOF_HTTP_PUBLIC'],
  ['demoPort', 'PATCHPROOF_DEMO_PORT'],
  ['osvMode', 'PATCHPROOF_OSV_MODE'],
  ['osvTimeoutMs', 'PATCHPROOF_OSV_TIMEOUT_MS'],
  ['osvRetries', 'PATCHPROOF_OSV_RETRIES'],
  ['osvCacheTtlMs', 'PATCHPROOF_OSV_CACHE_TTL_MS'],
  ['osvRatePerMin', 'PATCHPROOF_OSV_RATE_PER_MIN'],
  ['maxFiles', 'PATCHPROOF_MAX_FILES'],
  ['maxBytes', 'PATCHPROOF_MAX_BYTES'],
  ['maxDepth', 'PATCHPROOF_MAX_DEPTH'],
  ['scanTimeoutMs', 'PATCHPROOF_SCAN_TIMEOUT_MS'],
  ['verifyTimeoutMs', 'PATCHPROOF_VERIFY_TIMEOUT_MS'],
  ['quiet', 'MCP_QUIET'],
];

/**
 * Build a `Config` from the process environment plus a small
 * CLI-args override layer.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv,
): Config {
  const raw: Record<string, string> = {};
  for (const [key, envName] of PREFIXES) {
    const v = env[envName];
    if (typeof v === 'string' && v.length > 0) {
      raw[key] = v;
    }
  }
  // CLI overrides — only a few common flags, never anything that
  // could swallow a secret or path-like value.
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--transport' && i + 1 < argv.length) {
      const v = argv[i + 1];
      if (v === 'stdio' || v === 'http') raw['transport'] = v;
    } else if (a === '--port' && i + 1 < argv.length) {
      const v = argv[i + 1];
      if (typeof v === 'string' && /^\d+$/u.test(v)) raw['httpPort'] = v;
    } else if (a === '--mode' && i + 1 < argv.length) {
      const v = argv[i + 1];
      if (v === 'mock') raw['osvMode'] = v;
    } else if (a === '--host' && i + 1 < argv.length) {
      const v = argv[i + 1];
      if (typeof v === 'string' && v.length > 0) raw['httpHost'] = v;
    }
  }
  return ConfigSchema.parse(raw);
}
