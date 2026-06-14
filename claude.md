# PatchProof MCP - Agent Operating Standards

This file defines the current, verified contract for AI agents working in this
repository. Historical CyOps plans under `docs/plans/` describe earlier scope;
the executable code and this file define the four-tool MVP.

## Product Contract

PatchProof is a Node.js 20, strict TypeScript, ESM Model Context Protocol
server for deterministic npm repository inspection. It exposes exactly four
tools over stdio and Streamable HTTP:

1. `scan_repository`
2. `generate_sbom`
3. `audit_dependencies`
4. `generate_evidence_report`

The dependency audit uses a local fixture table. It does not claim live OSV,
secret detection, reachability analysis, or command execution.

## Repository Layout

```text
src/server       MCP registry and CLI
src/tools        four public tool definitions
src/scanners     bounded repository traversal
src/parsers      npm lockfile parsing
src/sbom         deterministic CycloneDX-shaped output
src/osv          offline vulnerability matching
src/reporting    JSON and self-contained HTML evidence
src/security     typed errors, path checks, limits, redaction
src/transport    stdio and Streamable HTTP
tests/unit       unit and HTTP integration tests
examples         reproducible reports and agent workflows
```

## Agent Workflow

1. Read `README.md` and the relevant source module before editing.
2. Keep the public surface at four tools unless the human explicitly changes
   the product scope.
3. Keep business logic outside `src/server/registry.ts`.
4. Use structured parsers for JSON and lockfiles.
5. Resolve filesystem input through `safeResolve` and enforce resource limits.
6. Never return plaintext secrets or expose arbitrary server paths.
7. Verify changes with:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   npm run workflow:validate
   ```

8. Keep README claims aligned with executable code and tests.

## Quality Rules

- Preserve `strict`, `noUncheckedIndexedAccess`, and
  `exactOptionalPropertyTypes`.
- Use ESM and Node.js 20-compatible APIs.
- Avoid `any`, shell execution, hidden network access, and unbounded I/O.
- Add tests for behavioral changes.
- Keep generated demo evidence deterministic.

## AI Integration Evidence

- The product itself is an MCP server designed for AI coding agents.
- Machine-readable workflows live in `examples/agent-workflows/*.json`.
- Client-specific setup guides live beside them for Claude, Codex, and GitHub
  Copilot.
- `scripts/run-agent-workflow.mjs` executes those workflows through MCP
  JSON-RPC.
- `docs/cyops-provenance.md` maps CyOps Humanize sessions to retained plans and
  Git history.

## Definition Of Done

- Lint, typecheck, tests, build, and workflow validation pass.
- Documentation describes only implemented behavior.
- No plaintext credentials or arbitrary filesystem access are introduced.
- The change is committed with a focused message.
