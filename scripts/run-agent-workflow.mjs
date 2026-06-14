#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const allowedTools = new Set([
  'scan_repository',
  'generate_sbom',
  'audit_dependencies',
  'generate_evidence_report',
]);
const workflowName = process.argv[2] ?? 'security-triage';
const endpoint = process.argv[3];
const workflowPath = resolve('examples', 'agent-workflows', `${workflowName}.json`);
const workflow = JSON.parse(await readFile(workflowPath, 'utf8'));

validateWorkflow(workflow);

if (!endpoint) {
  process.stdout.write(`${workflow.name}: ${workflow.steps.length} valid MCP steps\n`);
  process.exit(0);
}

let requestId = 0;
for (const step of workflow.steps) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++requestId,
      method: 'tools/call',
      params: { name: step.tool, arguments: step.arguments ?? {} },
    }),
  });
  if (!response.ok) throw new Error(`${step.tool} failed with HTTP ${response.status}`);
  const payload = await response.json();
  process.stdout.write(
    `${JSON.stringify({ step: step.id, tool: step.tool, response: payload })}\n`,
  );
}

function validateWorkflow(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    !Array.isArray(value.steps) ||
    value.steps.length === 0
  ) {
    throw new Error('Workflow must contain at least one step');
  }
  for (const step of value.steps) {
    if (!step.id || !allowedTools.has(step.tool)) {
      throw new Error(`Invalid workflow step: ${JSON.stringify(step)}`);
    }
  }
}
