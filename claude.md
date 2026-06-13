# PatchProof MCP — Agent Operating Standards

This file governs the behavior of Claude (and any other agent) working in
this repository. It is the single source of truth for project conventions;
if any of these rules conflict with an ad-hoc instruction, this file wins
unless the human override is explicit.

## 1. Project shape (one-line summary)

PatchProof MCP is a Node.js 20 / TypeScript / ESM Model Context Protocol
server that audits a software repository's supply-chain posture across the
chain `dependency → vulnerability → reachability → remediation →
verification → evidence` and exposes 8 MCP tools (`scan_repository`,
`generate_sbom`, `audit_dependencies`, `detect_secrets`,
`analyze_reachability`, `plan_remediation`, `verify_remediation`,
`generate_evidence_report`) over stdio and Streamable HTTP.

## 2. Code style and quality bar

- **Language**: TypeScript with `strict: true`, `noUncheckedIndexedAccess`,
  and `exactOptionalPropertyTypes` — these are non-negotiable. Any code
  that requires loosening them must justify the exception in this file
  before being merged.
- **Modules**: ESM only. No CommonJS. The build emits `.js` files with
  `.d.ts` and source maps in `dist/`.
- **Runtime**: Node.js 20 LTS. CI runs on `node:20`. The `.nvmrc` is
  authoritative for the patch version.
- **Linting/formatting**: ESLint (typescript-eslint + prettier) and
  Prettier. Run `npm run lint` and `npm run format:check` before
  declaring a slice done. No hand-rolled whitespace.
- **Coverage**: ≥85% lines/branches/functions on `src/`. The threshold
  is enforced in `vitest.config.ts`. Shortfalls are allowed only when
  accompanied by `/* c8 ignore next */` and a justification comment.
- **Testing**: Vitest. Tests mirror `src/` in `tests/{unit,integration,
  security,transport,demo,smoke}`. No real network. All OSV calls go
  through `MockOSVClient` in tests.
- **Deps**: keep the dependency surface small. Each new dep must be
  justified in the commit message and approved by the maintainer.
- **No `any`**, no `as` casts unless the type system is provably
  unsound, no `!` non-null assertions outside tests.

## 3. Security defaults (read this before touching I/O)

- **Path safety**: every filesystem entry point goes through
  `src/security/paths.ts::safeResolve`. Never use `path.join` to read
  user-influenced paths.
- **Process safety**: only allowlisted commands may be spawned by
  `src/verification/runner.ts` (`npm test`, `npm run lint`,
  `npm run build`, `npm audit --json`). All other invocations are
  rejected. The runner uses `child_process.spawn` with `shell: false`.
- **Secret handling**: `detect_secrets` MUST never return plaintext
  secrets. The output of any tool that touches a file is passed through
  the redactor at `src/security/redact.ts`. CI runs
  `scripts/audit-secrets.sh` and fails on any hit.
- **Resource limits**: any scan must go through `ResourceGovernor`
  (50k files, 500 MiB, depth 10, 60s wall-clock). Exceeding any limit
  raises a typed `ResourceLimitError` with a redacted message.
- **OSV adapter**: the live client must use a timeout, bounded retry
  with exponential backoff and jitter, in-memory TTL cache, and
  per-minute rate limit. The mock client must be deterministic and
  fixture-backed.
- **No source egress**: outbound HTTP is allowed only to OSV and only
  with `{package:{name,ecosystem}, version}` payloads. Source content
  is never serialized outbound.

## 4. Repository layout (do not rearrange)

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
tests/
  unit/          — focused unit tests
  integration/   — multi-module tests
  security/      — path traversal, injection, symlink escape
  transport/     — stdio + HTTP smoke
  demo/          — demo API + fixtures
  smoke/         — spawn the built binary
  fixtures/      — safe/vulnerable/secret-leak/etc.
web/             — static SPA demo
bench/           — vitest bench scenarios
scripts/         — audit:secrets, demo launcher, coverage report
examples/
  agent-workflows/  — github-copilot.md, claude-code.md, codex.md
docs/            — architecture, security-model, limitations, benchmarks, acceptance-evidence
fixtures/        — bundled demo fixtures (safe/vulnerable/...)
```

## 5. Workflow for AI agents

1. **Read the plan** at `.humanize/rlcr/<run>/plan.md` and the goal
   tracker at `.humanize/rlcr/<run>/goal-tracker.md` before doing
   anything substantive.
2. **One AC at a time**. Advance the current target AC; do not
   speculatively implement later ACs.
3. **Verify narrowly**. After each change, run the smallest meaningful
   subset of `npm run lint && npm run typecheck && npm test`. A
   downstream Reviewer will run exhaustive validation.
4. **No silent plan drift**. If the implementation requires a different
   path than the plan, write the change in the goal tracker's
   "Plan Evolution Log" before the code lands.
5. **No untracked secrets in any output**. If you need a fixture with
   a real-looking secret, use a *redacted fingerprint*, never the raw
   string. The audit script `scripts/audit-secrets.sh` enforces this
   in CI; the only allowed source of the canonical placeholder strings
   is the audit script itself and `tests/fixtures/_canonicals.ts`.
6. **Commit often** with conventional-commit messages scoped to a
   single AC. A failing test must never be left in `main`.

## 6. Forbidden patterns

- Regex-based dependency extraction. Use `jsonc-parser` for manifests
  and `lockfileVersion`-aware parsing for lockfiles.
- `child_process.exec` / `execSync` anywhere. Use `spawn` with
  `shell: false` and an arg allowlist.
- Returning `Buffer` or raw `string` from `detect_secrets`. The output
  shape is fixed: `{fingerprint, file, startLine, endLine, ruleId,
  category, confidence}`.
- Importing `node:*` modules from `web/`. The browser demo is a pure
  static SPA.
- Modifying `node_modules` in place. If a fix is needed, patch the
  upstream or vendor.
- `console.log` in production code paths (use `src/utils/logger.ts`).
  Tests may use it for assertion messages.

## 7. Definition of done for any AC

- [ ] Implementing file(s) exist and compile under `tsc --noEmit`.
- [ ] Test file(s) exist and pass under `vitest run`.
- [ ] `docs/acceptance-evidence.md` row added (or updated) with
      file + test + one-line reproducible command.
- [ ] No `any` introduced. No lint or typecheck warnings.
- [ ] No plaintext secret strings added to any committed file (verify
      with `bash scripts/audit-secrets.sh`).
- [ ] Commit message references the AC id, e.g. `feat(tools): AC-3
      register 8 MCP tools with Zod schemas`.
