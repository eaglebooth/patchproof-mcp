# GitHub Copilot

Add a workspace MCP server that runs:

```text
node /absolute/path/to/patchproof-mcp/dist/server/index.js --transport=stdio
```

Suggested task: “Before proposing dependency changes, call `generate_sbom`,
`audit_dependencies`, and `generate_evidence_report`; cite tool output in the
pull-request summary.”
