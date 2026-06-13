/**
 * Process entrypoint. Imported by the `dist/server/index.js` binary.
 * Only invokes `run()` when run directly; importing this module
 * does not start a server (so tests and the demo API can import it
 * safely).
 */
import { run } from './cli.js';
import { isMainModule } from './is-main.js';

if (isMainModule(import.meta.url)) {
  run().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`fatal: ${msg}\n`);
    process.exitCode = 1;
  });
}
