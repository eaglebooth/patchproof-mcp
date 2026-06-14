#!/usr/bin/env node
import { startHttp } from '../dist/transport/http.js';

const host = process.env['HTTP_HOST'] ?? '127.0.0.1';
const port = Number(process.env['HTTP_PORT'] ?? 8765);
const running = await startHttp({ host, port });

process.stderr.write(`PatchProof MCP is running at ${running.url}\n`);
process.stderr.write('Press Ctrl+C to stop.\n');

async function shutdown() {
  await running.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
