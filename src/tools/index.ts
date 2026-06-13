/**
 * Tools barrel. The 8 MCP tools are registered here so
 * `src/server/registry.ts` can pick them up in a single import.
 *
 * Each tool is a self-contained module:
 *   - a Zod input schema (validated by the SDK before the handler runs)
 *   - a `ToolDefinition` (name, description, inputSchema, run)
 *   - delegated business logic in `src/{scanners,sbom,osv,reachability,
 *     remediation,verification,reporting}/*`
 */
import { auditDependenciesTool } from './audit_dependencies.js';
import { analyzeReachabilityTool } from './analyze_reachability.js';
import { detectSecretsTool } from './detect_secrets.js';
import { generateEvidenceReportTool } from './generate_evidence_report.js';
import { generateSbomTool } from './generate_sbom.js';
import { planRemediationTool } from './plan_remediation.js';
import { scanRepositoryTool } from './scan_repository.js';
import { verifyRemediationTool } from './verify_remediation.js';
import type { ToolDefinition } from './types.js';

export type { ToolContext, ToolDefinition } from './types.js';

/**
 * The exhaustive list of registered MCP tools. The order here is
 * the order returned by `tools/list`. A reviewer can confirm
 * coverage by checking the length and the names against
 * `docs/acceptance-evidence.md` AC-2.
 */
export const TOOL_NAMES = [
  'scan_repository',
  'generate_sbom',
  'audit_dependencies',
  'detect_secrets',
  'analyze_reachability',
  'plan_remediation',
  'verify_remediation',
  'generate_evidence_report',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const tools: ReadonlyArray<ToolDefinition> = [
  scanRepositoryTool,
  generateSbomTool,
  auditDependenciesTool,
  detectSecretsTool,
  analyzeReachabilityTool,
  planRemediationTool,
  verifyRemediationTool,
  generateEvidenceReportTool,
];

/**
 * Backwards-compatible alias for the AC-1 `toolStubs` import path.
 * The registry now uses the real `tools` array.
 */
export const toolStubs: ReadonlyArray<ToolDefinition> = tools;
