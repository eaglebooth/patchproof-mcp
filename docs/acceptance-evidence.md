# Acceptance Evidence

Every public claim maps to executable code, a test, and a reproducible artifact
or command.

| Claim                                                     | Source                                                           | Test                                                                     | Artifact or command                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Four MCP tools are registered                             | `src/tools/index.ts`, `src/server/registry.ts`                   | `tests/unit/registry.test.ts`, `tests/unit/http-transport.test.ts`       | `npm test`                                                          |
| Repository scans are bounded                              | `src/scanners/files.ts`, `src/security/resources.ts`             | `tests/unit/resources.test.ts`, `tests/unit/core-tools.test.ts`          | `npm test`                                                          |
| Repository overrides remain inside the authorized root    | `src/scanners/files.ts`, `src/security/paths.ts`                 | `tests/unit/core-tools.test.ts`, `tests/unit/paths.test.ts`              | `npm test`                                                          |
| Partial scans are marked as truncated                     | `src/scanners/files.ts`                                          | `tests/unit/core-tools.test.ts`                                          | `npm test`                                                          |
| SBOM output is deterministic                              | `src/sbom/cyclonedx.ts`                                          | `tests/unit/core-tools.test.ts`                                          | `examples/golden/*/report.json`                                     |
| Dependency auditing has deterministic offline evidence    | `src/osv/audit.ts`                                               | `tests/unit/core-tools.test.ts`                                          | `examples/golden/vulnerable/report.json`                            |
| Live npm vulnerabilities use bounded official OSV queries | `src/osv/live.ts`, `src/osv/cvss.ts`                             | `tests/unit/osv-live.test.ts`                                            | `docs/live-osv-and-reachability.md`                                 |
| Vulnerable imports produce file-line reachability         | `src/reachability/analyzer.ts`                                   | `tests/unit/reachability-remediation.test.ts`                            | `examples/demo-report.json`                                         |
| Remediation reflects reachability and semver distance     | `src/remediation/planner.ts`                                     | `tests/unit/reachability-remediation.test.ts`                            | `examples/demo-report.json`                                         |
| Verification rejects command injection and avoids shells  | `src/verification/runner.ts`                                     | `tests/unit/verification-runner.test.ts`                                 | `docs/live-osv-and-reachability.md`                                 |
| Risk scoring is transparent and deterministic             | `src/risk/scorer.ts`                                             | `tests/unit/risk-scorer.test.ts`, `tests/unit/scenario-evidence.test.ts` | `examples/golden/dev-transitive/report.json`                        |
| Evidence reports combine findings and remediation         | `src/reporting/generator.ts`                                     | `tests/unit/core-tools.test.ts`                                          | `examples/demo-report.{json,html}`                                  |
| Missing and malformed lockfiles produce explicit findings | `src/parsers/lockfile.ts`, `src/reporting/generator.ts`          | `tests/unit/scenario-evidence.test.ts`                                   | `examples/golden/{malformed,missing}/`                              |
| Local and Vercel DELETE behavior follows the MCP SDK      | `src/transport/http.ts`, `api/mcp.ts`                            | `tests/unit/http-transport.test.ts`, `tests/unit/vercel-handler.test.ts` | `npm test`                                                          |
| Agent workflows execute through MCP JSON-RPC              | `scripts/run-agent-workflow.mjs`                                 | CI workflow validation                                                   | `npm run workflow:run -- evidence-review http://127.0.0.1:8765/mcp` |
| CI reproduces committed evidence                          | `.github/workflows/ci.yml`, `scripts/generate-demo-evidence.mjs` | GitHub Actions                                                           | `npm run demo:evidence && git diff --exit-code -- examples`         |

## Verified Quality Gate

The current local verification run contains 82 passing tests. Coverage is
90.97% statements/lines, 81.70% branches, and 94.91% functions.

`vitest.config.ts` enforces 85% statements/lines/functions and 80% branches.
GitHub Actions runs the same `npm run coverage` command before build and
artifact reproducibility checks.
