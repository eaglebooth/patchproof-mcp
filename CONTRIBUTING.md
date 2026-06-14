# Contributing to PatchProof MCP

Thanks for your interest in improving PatchProof. This document covers
how to file issues, send changes, and the local workflow.

## Ground rules

1. **One acceptance criterion per change.** Open one PR per AC; this
   keeps the review surface tight and the history honest.
2. **No silent plan drift.** If the implementation diverges from the
   plan, write the change in the goal tracker's Plan Evolution Log
   before the code lands.
3. **No plaintext secrets in any committed file.** Verify with
   `bash scripts/audit-secrets.sh`. The audit will fail the build.
4. **Strict TypeScript, ESM, no `any`.** See `claude.md` for the
   full standards.
5. **Tests are required for new logic.** If you add a function, add
   a test in the mirror path under `tests/`.

## Local development

```bash
nvm install            # installs the version pinned in .nvmrc (Node 20)
npm ci
npm run lint && npm run typecheck && npm test
```

Run the demo locally:

```bash
npm run build
npm run demo
# then open http://127.0.0.1:8787/
```

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/).
Prefix with the AC id when the change is tied to one:

```
feat(tools): AC-3 register 8 MCP tools with Zod schemas
fix(security): AC-12 reject symlink escape in safeResolve
chore(deps): bump @modelcontextprotocol/sdk to 1.0.4
```

## Pull request checklist

- [ ] `npm run lint` is clean
- [ ] `npm run typecheck` is clean
- [ ] `npm test` is green
- [ ] `npm run coverage` stays ≥ 85% (or shortfall documented in
      `docs/limitations.md`)
- [ ] `npm run audit:secrets` is clean
- [ ] `docs/acceptance-evidence.md` row added or updated
- [ ] README.md, docs/\*.md updated if user-facing behavior changed
- [ ] One AC per PR; PR title references the AC

## Reporting security issues

See `SECURITY.md`. **Do not** file public issues for security bugs.
