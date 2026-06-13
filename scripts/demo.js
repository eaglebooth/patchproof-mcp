#!/usr/bin/env node
/**
 * Demo launcher. Builds and starts the bundled browser demo.
 * Real implementation lands in AC-19; this stub keeps the script
 * callable from `npm run demo` and prints a friendly message until
 * then.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distServer = join(__dirname, '..', 'dist', 'server', 'index.js');

if (!existsSync(distServer)) {
  process.stderr.write(
    'patchproof demo: dist/ is missing. Run `npm run build` first.\n',
  );
  process.exit(1);
}

process.stderr.write(
  'patchproof demo: AC-19 is not yet implemented. ' +
    'For now, run `npm run start:http` and visit http://127.0.0.1:8765/mcp.\n',
);
