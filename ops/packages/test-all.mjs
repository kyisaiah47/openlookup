#!/usr/bin/env node
// test-all.mjs: run every per-product server's live smoke test, then the lib.js drift check.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let failed = 0;
for (const dir of fs.readdirSync(path.join(ROOT, 'packages')).filter((d) => d.endsWith('-mcp'))) {
  console.log(`\n== ${dir}`);
  const r = spawnSync('node', ['test/smoke.mjs'], { cwd: path.join(ROOT, 'packages', dir), stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
const s = spawnSync('node', [path.join(ROOT, 'ops/packages/sync.mjs'), '--check'], { stdio: 'inherit' });
if (s.status !== 0) failed++;
console.log(failed ? `\n${failed} failed` : '\nevery product server passed');
process.exit(failed ? 1 : 0);
