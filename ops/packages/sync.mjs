#!/usr/bin/env node
// sync.mjs: copy packages/shared/lib.js into every per-product server under packages/.
//
//   node ops/packages/sync.mjs           # copy
//   node ops/packages/sync.mjs --check   # exit 1 if any package's lib.js differs from shared
//
// Each product server publishes to npm on its own, so each needs its own copy of the shared
// code. A copy edited by hand drifts, so the copy is made here and the test checks it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHARED = fs.readFileSync(path.join(ROOT, 'packages/shared/lib.js'), 'utf8');
const CHECK = process.argv.includes('--check');
let drift = 0;
for (const dir of fs.readdirSync(path.join(ROOT, 'packages'))) {
  if (!dir.endsWith('-mcp')) continue;
  const target = path.join(ROOT, 'packages', dir, 'src/lib.js');
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === SHARED;
  if (same) continue;
  if (CHECK) {
    drift++;
    console.log(`✗ ${dir}/src/lib.js differs from packages/shared/lib.js`);
  } else {
    fs.writeFileSync(target, SHARED);
    console.log(`synced ${dir}`);
  }
}
if (CHECK) console.log(drift ? `${drift} package(s) drifted` : 'every package carries packages/shared/lib.js');
process.exit(drift ? 1 : 0);
