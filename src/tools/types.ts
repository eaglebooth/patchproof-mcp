/**
 * Shared tool types. A `ToolDefinition` is the contract between
 * `src/tools/*` and `src/server/registry.ts`. Each tool module
 * exports one or more of these.
 */
import type { z } from 'zod';

export interface ToolContext {
  /** Authorized repo root for this request. */
  readonly repoRoot: string;
  /** Abort signal, propagated from the MCP host. */
  readonly signal: AbortSignal;
}

export interface ToolDefinition<I = unknown, O = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<I>;
  readonly run: (ctx: ToolContext, input: I) => Promise<O>;
}
