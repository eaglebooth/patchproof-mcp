/**
 * Shared tool types. A `ToolDefinition` is the contract between
 * `src/tools/*` and `src/server/registry.ts`. Each tool module
 * exports one of these.
 *
 * The shape is intentionally non-generic: the MCP SDK validates
 * the input against `inputSchema` before calling `run`, and the
 * registry iterates over a heterogeneous `ReadonlyArray<ToolDefinition>`,
 * which is much cleaner with a uniform element type. Per-tool
 * input/output types live next to the Zod schema in each module
 * (`export type XInput = z.infer<typeof xInputSchema>`) and the
 * tool body uses a single `as` cast on the `run` input.
 */
import type { z } from 'zod';

export interface ToolContext {
  /** Authorized repo root for this request. */
  readonly repoRoot: string;
  /** Abort signal, propagated from the MCP host. */
  readonly signal: AbortSignal;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodTypeAny;
  readonly run: (ctx: ToolContext, input: unknown) => Promise<unknown>;
}
