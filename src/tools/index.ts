/**
 * Tools barrel. The four public MCP tools are registered here so
 * `src/server/registry.ts` can pick them up in a single import.
 *
 * Each tool is a self-contained module:
 *   - a Zod input schema (validated by the SDK before the handler runs)
 *   - a `ToolDefinition` (name, description, inputSchema, run)
 *   - delegated business logic in `src/{scanners,sbom,osv,reporting}/*`
 */
import { auditDependenciesTool } from './audit_dependencies.js';
import { generateEvidenceReportTool } from './generate_evidence_report.js';
import { generateSbomTool } from './generate_sbom.js';
import { scanRepositoryTool } from './scan_repository.js';
import type { ToolDefinition } from './types.js';

export type { ToolContext, ToolDefinition } from './types.js';

/**
 * The exhaustive list of registered MCP tools. The order here is
 * the order returned by `tools/list`. A reviewer can confirm
 * coverage by checking the length and names against the README.
 */
export const TOOL_NAMES = [
  'scan_repository',
  'generate_sbom',
  'audit_dependencies',
  'generate_evidence_report',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const tools: ReadonlyArray<ToolDefinition> = [
  scanRepositoryTool,
  generateSbomTool,
  auditDependenciesTool,
  generateEvidenceReportTool,
];
