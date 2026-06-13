# PatchProof MCP

PatchProof is a focused Model Context Protocol server for local npm
supply-chain inspection. The MVP exposes four tools with deterministic,
offline-friendly behavior.

## Current Status

The complete public tool set is implemented and covered by focused tests:

- `scan_repository`: bounded repository file and byte counting.
- `generate_sbom`: deterministic CycloneDX-shaped SBOM generation from
  `package-lock.json`.
- `audit_dependencies`: dependency extraction with a deterministic mock
  vulnerability table.
- `generate_evidence_report`: JSON evidence metadata and a self-contained HTML
  preview.

Important limitations:

- Only npm `package-lock.json` repositories are supported.
- `audit_dependencies` does not yet query the live OSV API. Selecting `live`
  currently uses the same deterministic mock data.
- `scan_repository` currently returns repository statistics; vulnerability and
  secret findings are not yet integrated into its result.
- Evidence reports currently contain metadata and limitations, not a complete
  end-to-end audit.
- There is no browser demo, Docker image, deployment, CI workflow, or published
  coverage claim in this revision.
- Streamable HTTP is scaffolded and should not yet be treated as a verified
  production transport.

## Requirements

- Node.js 20
- npm 10

## Install And Verify

```bash
npm ci
npm run typecheck
npm test
npm run build
```

The focused core-tool test suite creates a temporary npm repository and calls
the four implemented tools directly.

## Run

Build first, then start the stdio MCP server:

```bash
npm run build
npm run start:stdio
```

## Tool Summary

### `scan_repository`

Input:

```json
{
  "repoRoot": "/authorized/repository",
  "includeHidden": false,
  "followSymlinks": false
}
```

Returns the resolved repository root, files scanned, bytes read, duration,
ignored directories, and the current findings array.

### `generate_sbom`

Input:

```json
{
  "repoRoot": "/authorized/repository",
  "format": "cyclonedx"
}
```

Returns a deterministic CycloneDX 1.5-shaped component list derived from
`package-lock.json`.

### `audit_dependencies`

Input:

```json
{
  "repoRoot": "/authorized/repository",
  "osvMode": "mock",
  "ecosystem": "npm"
}
```

Returns parsed dependencies and matching entries from the local deterministic
mock vulnerability table.

### `generate_evidence_report`

Input:

```json
{
  "repoRoot": "/authorized/repository",
  "format": "both"
}
```

Returns evidence metadata as JSON and, for `html` or `both`, a self-contained
HTML preview.

## Architecture

```text
src/server       MCP registration and CLI
src/tools        four public MCP tool definitions
src/scanners     bounded repository traversal
src/parsers      npm lockfile parsing
src/sbom         deterministic SBOM assembly
src/osv          deterministic mock dependency audit
src/reporting    JSON and HTML evidence metadata
src/security     path, resource, error, and redaction utilities
src/transport    stdio and HTTP transport scaffolding
tests/unit       infrastructure and focused core-tool tests
```

Business logic is kept outside the MCP registry so it can be tested directly.

## Security Notes

- Callers must provide or authorize a repository root.
- Repository traversal is bounded by file, byte, depth, and time limits.
- Common generated directories such as `.git`, `node_modules`, `dist`,
  `build`, and `coverage` are ignored.
- The implemented dependency audit is local and deterministic.

This is an MVP, not a completed security product. Do not rely on it as the sole
source for vulnerability or secret detection.

## CyOps Arena

The repository was scaffolded and iterated with CyOps Humanize using MiniMax
M3. The Git history and planning documents retain the generated implementation
evidence. Manual verification confirmed:

- strict TypeScript typecheck passes;
- the Vitest suite passes;
- the production TypeScript build passes.

## License

MIT. See `LICENSE`.
