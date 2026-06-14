# Security Policy

PatchProof is a security tool. The maintainers take reports about
vulnerabilities in the tool itself seriously.

## Supported versions

| Version                      | Supported               |
| ---------------------------- | ----------------------- |
| `main` (current development) | ✅                      |
| Tagged releases              | ✅ best-effort, 90 days |

## Reporting a vulnerability

**Please do not file public issues for security bugs.**

Email `security@patchproof.example` (placeholder — see the homepage
or your fork's settings for the real address) with:

- A description of the vulnerability
- Reproduction steps (a minimal fixture is ideal)
- The commit hash or release tag affected
- Whether you intend to disclose publicly and on what timeline

You should receive an acknowledgement within 3 business days. We aim
to triage within 7 days and ship a fix within 30 days for high-
severity issues.

## Threat model summary

PatchProof operates on a single authorized repository root per
request. Its trust boundaries are:

- **Inbound**: MCP tool calls (Zod-validated) and CLI args
  (`--transport`, `--port`, `--mode`).
- **Outbound**: OSV API only, with package coordinates (no source
  content) and an allowlisted network policy.
- **Local**: `child_process.spawn` with `shell: false` and an arg
  allowlist; every filesystem access goes through `safeResolve` which
  rejects traversal, symlink escape, and paths outside the root.

The detailed threat model — including what is and is not in scope —
is in `docs/security-model.md`.

## What is in scope

- Path traversal (`..`, symlink escape, absolute paths outside root)
- Command injection in the verification runner
- Plaintext secret leakage in any return value, log, snapshot, or
  built artifact
- Unbounded resource consumption (file count, byte count, depth,
  wall-clock)
- Unsafe transport handling (stdio framing, HTTP body limits, request
  id propagation, CORS)
- OSV adapter abuse (cache poisoning, rate-limit bypass, unbounded
  retry)

## What is out of scope

- Vulnerabilities in the OSV service itself
- Vulnerabilities introduced by user-supplied fixtures
- Bugs in upstream dependencies that don't affect PatchProof's
  hardening (please report them upstream)
- Issues that require a malicious, root-level local user

## Secret redaction policy

`detect_secrets` and every other tool's output is run through
`src/security/redact.ts` before leaving the process. The only places
where canonical placeholder secrets (`AKIAIOSFODNN7EXAMPLE`,
`ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, `xoxb-…`) are allowed to
appear in the source tree are:

- `scripts/audit-secrets.sh` (the audit)
- `tests/fixtures/_canonicals.ts` (the test fixtures)

Any other occurrence fails the CI audit.

## Hall of fame

We will acknowledge reporters (with their permission) in release
notes once a fix ships.
