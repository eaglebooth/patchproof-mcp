import { spawn } from 'node:child_process';
import * as path from 'node:path';

import { VerificationError } from '../security/errors.js';
import { redactMessage } from '../security/redact.js';
import type { VerificationResult } from '../types/index.js';

const MAX_OUTPUT_BYTES = 1_048_576;
const ALLOWED_COMMANDS: Readonly<Record<string, ReadonlyArray<string>>> = {
  'npm run typecheck': ['run', 'typecheck'],
  'npm test': ['test'],
  'npm run build': ['run', 'build'],
};

export async function runVerificationPlan(
  repoRoot: string,
  commands: ReadonlyArray<string>,
  timeoutMs = 120_000,
): Promise<ReadonlyArray<VerificationResult>> {
  const uniqueCommands = [...new Set(commands)];
  const results: VerificationResult[] = [];
  for (const command of uniqueCommands) {
    results.push(await runVerificationCommand(repoRoot, command, timeoutMs));
  }
  return results;
}

export function validateVerificationCommand(command: string): ReadonlyArray<string> {
  const args = ALLOWED_COMMANDS[command];
  if (!args) {
    throw new VerificationError('Verification command is not allowlisted', { command });
  }
  return args;
}

async function runVerificationCommand(
  repoRoot: string,
  command: string,
  timeoutMs: number,
): Promise<VerificationResult> {
  const args = validateVerificationCommand(command);
  const invocation = resolveNpmInvocation(args);
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.executable, invocation.args, {
      cwd: repoRoot,
      shell: false,
      env: cleanEnvironment(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let truncatedStdout = false;
    let truncatedStderr = false;
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      const appended = appendBounded(stdout, chunk.toString('utf8'));
      stdout = appended.value;
      truncatedStdout ||= appended.truncated;
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const appended = appendBounded(stderr, chunk.toString('utf8'));
      stderr = appended.value;
      truncatedStderr ||= appended.truncated;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(
        new VerificationError('Failed to start verification command', {
          command,
          error: error.message,
        }),
      );
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        command,
        args,
        exitCode: code ?? (signal ? 124 : 1),
        durationMs: Date.now() - startedAt,
        stdout: redactMessage(stdout),
        stderr: redactMessage(stderr),
        truncatedStdout,
        truncatedStderr,
      });
    });
  });
}

function resolveNpmInvocation(args: ReadonlyArray<string>): {
  readonly executable: string;
  readonly args: ReadonlyArray<string>;
} {
  const npmExecPath = process.env['npm_execpath'];
  if (typeof npmExecPath === 'string' && npmExecPath.length > 0) {
    return { executable: process.execPath, args: [npmExecPath, ...args] };
  }
  if (process.platform === 'win32') {
    const npmCli = path.join(
      path.dirname(process.execPath),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js',
    );
    return { executable: process.execPath, args: [npmCli, ...args] };
  }
  return { executable: 'npm', args };
}

function appendBounded(current: string, next: string): { value: string; truncated: boolean } {
  if (Buffer.byteLength(current) >= MAX_OUTPUT_BYTES) return { value: current, truncated: true };
  const available = MAX_OUTPUT_BYTES - Buffer.byteLength(current);
  const buffer = Buffer.from(next);
  return {
    value: current + buffer.subarray(0, available).toString('utf8'),
    truncated: buffer.byteLength > available,
  };
}

function cleanEnvironment(): NodeJS.ProcessEnv {
  const allowed = ['PATH', 'Path', 'PATHEXT', 'HOME', 'USERPROFILE', 'TMP', 'TEMP', 'SystemRoot'];
  const env: NodeJS.ProcessEnv = { CI: '1', NO_COLOR: '1' };
  for (const key of allowed) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}
