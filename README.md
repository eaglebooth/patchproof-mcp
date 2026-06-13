# PatchProof MCP

> **Supply-chain security audit server for AI coding agents.**
> Exposes 8 Model Context Protocol (MCP) tools that walk the chain
> `dependency → vulnerability → reachability → remediation →
> verification → evidence` and return a redacted, verifiable report.

PatchProof MCP is a local-first audit server. It scans a Node.js
repository's `package.json` and `package-lock.json`, queries OSV for
known vulnerabilities, performs an import-graph reachability analysis,
plans remediation without ever writing to disk, runs an allowlisted
verification command set, and emits a self-contained CycloneDX SBOM
plus a JSON + HTML evidence report.

It is designed to be embedded in MCP-aware hosts (Claude Code, GitHub
Copilot, Codex, custom agents) and to be safe to run on untrusted
repositories: no source content leaves the host, no plaintext secrets
appear in any return value, no shell injection is possible, and every
filesystem access is confined to a single authorized root.

---

## Why

Modern agents write code, install dependencies, and run tests. They
need a deterministic, redacted, evidence-producing auditor that can be
called as a tool. PatchProof is that auditor. It is opinionated,
minimal, and reproducible.

## Features (summary)

- 8 MCP tools: `scan_repository`, `generate_sbom`, `audit_dependencies`,
  `detect_secrets`, `analyze_reachability`, `plan_remediation`,
  `verify_remediation`, `generate_evidence_report`.
- CycloneDX 1.5 SBOM with `purl`, declared `licenses`, and integrity
  hashes derived from the lockfile.
- OSV adapter with deterministic mock and live (timeout, bounded
  retry, TTL cache, per-minute rate limit) implementations.
- Reachability classification (`confirmed | possible | unknown`) with
  file:line evidence.
- Remediation planner that never writes to disk and ranks by severity
  × reachability × breaking-change risk.
- Allowlisted verification runner (`npm test`, `npm run lint`,
  `npm run build`, `npm audit --json`) with output redaction and
  size caps.
- Self-contained HTML evidence report (no external assets, inline CSS
  and JS, accessible markup).
- stdio and Streamable HTTP transports. Browser demo SPA with 6
  bundled fixtures.
- 85%+ line/branch/function coverage on `src/`.

## Quickstart

```bash
# 1. Install (Node 20 required)
nvm use        # or: nvm install $(cat .nvmrc)
npm ci

# 2. Build
npm run build

# 3. Run over stdio (for MCP hosts)
npm run start:stdio

# 4. Or run the HTTP transport
npm run start:http

# 5. Or launch the bundled browser demo
npm run demo
# then open http://127.0.0.1:8787/
```

## Verifying the install

```bash
npm run lint           # ESLint (typescript-eslint + prettier)
npm run typecheck      # tsc --noEmit (strict)
npm test               # vitest run
npm run coverage       # vitest run --coverage (≥85% on src/)
npm run build          # tsc -p tsconfig.build.json
npm run audit:secrets  # grep JSON/HTML/snapshots for placeholder secrets
```

All five must exit 0. See `docs/acceptance-evidence.md` for the
1:1 AC-to-command mapping.

## Project layout

```
src/
  server/        — CLI entrypoint, registry, demo API
  tools/         — the 8 MCP tools (one file each)
  scanners/      — file walker, secrets rules
  parsers/       — manifest + lockfile parsing
  sbom/          — CycloneDX 1.5 assembly
  osv/           — typed adapter (interface + live + mock + cache + rate limit)
  reachability/  — import-graph analyzer
  remediation/   — planner (pure functions only)
  verification/  — allowlisted runner
  reporting/     — JSON + self-contained HTML
  security/      — paths, resources, redact, errors
  transport/     — stdio + Streamable HTTP
  schemas/       — Zod input schemas for the 8 tools
  types/         — shared TypeScript types
  utils/         — logger, clock, stable-stringify, etc.
tests/           — mirrors src/
web/             — static SPA demo
bench/           — vitest bench scenarios
examples/        — agent workflow examples
docs/            — architecture, security, limits, evidence
fixtures/        — bundled demo fixtures
```

## Configuration

All configuration is environment-driven; see `.env.example` for the
exhaustive list. The most common toggles:

| Variable | Default | Notes |
|---|---|---|
| `PATCHPROOF_TRANSPORT` | `stdio` | or `http` |
| `PATCHPROOF_HTTP_HOST` | `127.0.0.1` | Set `PATCHPROOF_HTTP_PUBLIC=1` to bind `0.0.0.0` |
| `PATCHPROOF_HTTP_PORT` | `8765` | HTTP transport port |
| `PATCHPROOF_OSV_MODE` | `mock` | `live` queries api.osv.dev |
| `PATCHPROOF_OSV_TIMEOUT_MS` | `5000` | per-request live OSV timeout |
| `PATCHPROOF_OSV_RETRIES` | `2` | max retries for transient live failures |
| `PATCHPROOF_OSV_CACHE_TTL_MS` | `3600000` | in-memory TTL (1h default) |
| `PATCHPROOF_OSV_RATE_PER_MIN` | `60` | sliding-window rate limit |
| `PATCHPROOF_MAX_FILES` | `50000` | ResourceGovernor file cap |
| `PATCHPROOF_MAX_BYTES` | `524288000` | 500 MiB read cap |
| `PATCHPROOF_MAX_DEPTH` | `10` | directory depth cap |
| `PATCHPROOF_SCAN_TIMEOUT_MS` | `60000` | wall-clock cap |
| `PATCHPROOF_VERIFY_TIMEOUT_MS` | `120000` | verification cmd cap |
| `MCP_QUIET` | `0` | set `1` to suppress non-error stderr |

## MCP tools

The 8 tools are documented in `docs/architecture.md` and
`examples/agent-workflows/`. Each tool:

- Accepts a Zod-validated input (malformed input is rejected with a
  typed, redacted error before any business logic runs).
- Returns a deterministic JSON shape (no `Date.now()` in payloads; an
  injected `Clock` is used in tests).
- Is redacted on the way out — no plaintext secrets, no
  unredacted paths from outside the authorized root.

## Browser demo

The `web/` directory is a static SPA. Selecting one of the 6 bundled
fixtures (`safe`, `vulnerable`, `secret-leak`, `malformed-lockfile`,
`missing-lockfile`, `unavailable-osv`) calls the demo API which routes
to the in-process MCP tool registry with a fixed fixture path. The
demo is clearly labeled `FIXTURE / DEMO MODE` and never accepts an
arbitrary filesystem path from the browser.

## Security model

See `docs/security-model.md` for the full threat model, trust
boundaries, and redactors. The short version:

- One authorized repo root per request; everything else is denied.
- `child_process.spawn` with `shell: false` and an arg allowlist.
- OSV is the only outbound network and only sees package coordinates.
- Secret redaction is layered (fingerprinting, path redaction, free-
  form error scrubbing, CI grep audit).
- Resource limits are single-source (`ResourceGovernor`).

## Limitations

See `docs/limitations.md` for known shortfalls, intended boundaries,
and coverage gaps.

## Contributing

See `CONTRIBUTING.md`. The repo is governed by the standards in
`claude.md`.

## License

MIT — see `LICENSE`.

## Security disclosures

See `SECURITY.md`. Do not file public issues for vulnerabilities.
