# Claude Code

Configure PatchProof as a local stdio MCP server after `npm run build`:

```json
{
  "mcpServers": {
    "patchproof": {
      "command": "node",
      "args": ["/absolute/path/to/patchproof-mcp/dist/server/index.js", "--transport=stdio"]
    }
  }
}
```

Example task: “Use PatchProof to inventory this npm repository, audit its
dependencies, and summarize the generated evidence without claiming live OSV.”
