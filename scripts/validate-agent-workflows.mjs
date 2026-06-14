import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('examples', 'agent-workflows');
const files = (await readdir(root)).filter((file) => file.endsWith('.json')).sort();
if (files.length !== 3) throw new Error(`Expected 3 workflow definitions, found ${files.length}`);

for (const file of files) {
  const workflow = JSON.parse(await readFile(resolve(root, file), 'utf8'));
  if (!workflow.name || !Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    throw new Error(`${file} is not a valid workflow`);
  }
}

process.stdout.write(`Validated ${files.length} agent workflows\n`);
