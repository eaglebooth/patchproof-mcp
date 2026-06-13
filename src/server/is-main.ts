/**
 * Detect "this file is the process entrypoint". Using
 * `require.main === module` works in CJS, but we run ESM and Node
 * does not expose `require.main` reliably from ESM entrypoints; the
 * canonical workaround is to compare `import.meta.url` to
 * `process.argv[1]` resolved to a file URL.
 */
import { pathToFileURL } from 'node:url';

export function isMainModule(importUrl: string): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return pathToFileURL(arg).href === importUrl;
  } catch {
    return false;
  }
}
