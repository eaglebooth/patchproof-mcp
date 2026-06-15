# Live OSV And Reachability

PatchProof keeps one four-tool MCP surface while implementing a complete
evidence pipeline inside `audit_dependencies` and
`generate_evidence_report`.

## Live OSV contract

`osvMode=live` posts one bounded query per unique npm dependency to the official
OSV `/v1/query` endpoint. The outbound body contains only:

```json
{
  "package": { "ecosystem": "npm", "name": "lodash" },
  "version": "4.17.20"
}
```

Repository paths and source contents never cross the network boundary. The
client enforces timeout, bounded retry, bounded concurrency, and an in-memory
TTL cache. `source` distinguishes `live`, `mock`, and `mock-fallback`, so a
network failure is never presented as live evidence.

OSV often returns CVSS vectors. `src/osv/cvss.ts` implements the CVSS v3.0/v3.1
base-score formula so risk scoring does not silently discard severity.

## Reachability contract

`src/reachability/analyzer.ts` scans bounded JavaScript and TypeScript source
files for static imports, exports, CommonJS `require`, and dynamic `import`.
Each vulnerable package is classified:

- `confirmed`: an import specifier equals the package or one of its subpaths;
- `possible`: the package appears in an import-bearing source line but cannot
  be resolved exactly;
- `unknown`: no source reference was found.

Evidence includes repository-relative file, line, and a capped source snippet.
This is static reachability evidence, not proof that a runtime path executes.

## Remediation and verification

Remediation combines fixed versions with reachability evidence and semantic
version distance. A major-version upgrade is marked high risk, a minor upgrade
medium risk, and a patch upgrade low risk.

When `verify=true`, the report runner accepts exactly:

- `npm run typecheck`
- `npm test`
- `npm run build`

It invokes npm with `shell: false`, a minimal environment, time and output
caps, and boundary redaction. Every other command is rejected.
