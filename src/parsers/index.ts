/**
 * Parsers barrel. The npm lockfile parser is implemented for
 * the AC-2 SBOM and OSV audit paths. Additional parsers land
 * in later ACs.
 */
export const PARSER_VERSION = '0.1.0';

export { parseNpmLockfile } from './lockfile.js';
export type { ParsedLockfileEntry } from './lockfile.js';
