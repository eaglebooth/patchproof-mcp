import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { VerificationError } from '../../src/security/errors.js';
import { runVerificationPlan, validateVerificationCommand } from '../../src/verification/runner.js';

describe('verification allowlist', () => {
  it('maps approved commands to shell-free npm arguments', () => {
    expect(validateVerificationCommand('npm run typecheck')).toEqual(['run', 'typecheck']);
    expect(validateVerificationCommand('npm test')).toEqual(['test']);
    expect(validateVerificationCommand('npm run build')).toEqual(['run', 'build']);
  });

  it.each([
    'npm test && curl attacker',
    'npm test | tee output',
    'npm test > result.txt',
    'npm run arbitrary',
    'node -e "process.exit()"',
  ])('rejects non-allowlisted command %s', (command) => {
    expect(() => validateVerificationCommand(command)).toThrow(VerificationError);
  });

  it('executes an allowlisted command without a shell and captures evidence', async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'patchproof-verify-'));
    try {
      await fs.writeFile(
        path.join(repoRoot, 'package.json'),
        JSON.stringify({
          name: 'verification-fixture',
          version: '1.0.0',
          scripts: { build: 'node -e "process.stdout.write(\'verified\')"' },
        }),
      );

      const results = await runVerificationPlan(
        repoRoot,
        ['npm run build', 'npm run build'],
        10_000,
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.exitCode).toBe(0);
      expect(results[0]?.stdout).toContain('verified');
      expect(results[0]?.args).toEqual(['run', 'build']);
      expect(results[0]?.truncatedStdout).toBe(false);
    } finally {
      await fs.rm(repoRoot, { recursive: true, force: true });
    }
  });
});
