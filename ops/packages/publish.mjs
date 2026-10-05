#!/usr/bin/env node
// publish.mjs: publish every per-product server under packages/ to npm, then to the MCP registry.
//
//   node ops/packages/publish.mjs            # publish what is not live yet
//   node ops/packages/publish.mjs --dry-run  # report what would go out
//
// A package is skipped on npm when name@version is already live, and skipped on the registry
// when that version is already listed, so a run that stopped halfway is finished by running it
// again. npm goes first: the MCP registry validates a server by reading `mcpName` out of the
// published npm package, so a registry publish ahead of npm is refused.
//
// The npm account's second factor is a security key. `npm publish` prints a URL for it when the
// session token needs one; stdio is inherited so that prompt reaches whoever runs this. A dead
// npm session exits 75 before anything is published.
import { execFileSync, spawnSync } from 'node:child_process';
import { createPrivateKey } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DRY = process.argv.includes('--dry-run');
const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });

const sync = sh('node', [path.join(ROOT, 'ops/packages/sync.mjs'), '--check'], { stdio: 'inherit' });
if (sync.status !== 0) process.exit(1);

const who = sh('npm', ['whoami']);
if (who.status !== 0) {
  console.error('✗ npm session is dead (npm whoami failed). Run `npm login`, then run this again.');
  process.exit(75);
}
console.log(`npm: signed in as ${who.stdout.trim()}`);

// The MCP registry signs in with the DNS key for the tech.thecompound namespace, exactly as
// ops/npm/publish.mjs does. The key goes only to mcp-publisher and is never printed.
function registryKeyHex() {
  try {
    const v = execFileSync(path.join(os.homedir(), 'bin', 'compound-secret'), ['MCP_REGISTRY_DNS_KEY_2_THECOMPOUND'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^[0-9a-f]{64}$/.test(v)) return v;
  } catch {}
  const pem = path.join(os.homedir(), '.config/compound-mcp/thecompound-tech-mcp-ed25519.pem');
  if (!fs.existsSync(pem)) return null;
  return createPrivateKey(fs.readFileSync(pem)).export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('hex');
}

// The registry JWT that `mcp-publisher login` caches expires within minutes: on 2026-10-05 the
// first three servers listed and the next three were refused 401 "token is expired" while npm
// was still publishing. So the sign-in runs again right before every registry publish.
const REGISTRY_KEY = DRY ? null : registryKeyHex();
if (!DRY && !REGISTRY_KEY) {
  console.error('✗ no MCP registry key');
  process.exit(1);
}
function registryLogin() {
  const r = sh('mcp-publisher', ['login', 'dns', '--domain', 'thecompound.tech', '--private-key', REGISTRY_KEY]);
  if (r.status !== 0) console.error(`✗ MCP registry sign-in failed: ${(r.stderr || '').trim().split('\n').pop()}`);
  return r.status === 0;
}
if (!DRY && !registryLogin()) process.exit(1);

let failed = 0;
for (const dir of fs.readdirSync(path.join(ROOT, 'packages')).filter((d) => d.endsWith('-mcp'))) {
  const cwd = path.join(ROOT, 'packages', dir);
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  const server = JSON.parse(fs.readFileSync(path.join(cwd, 'server.json'), 'utf8'));
  const id = `${pkg.name}@${pkg.version}`;

  const onNpm = sh('npm', ['view', id, 'version']).stdout.trim() === pkg.version;
  if (onNpm) console.log(`= ${id} already on npm`);
  else if (DRY) console.log(`would publish ${id} to npm`);
  else {
    console.log(`→ npm publish ${id}`);
    const r = sh('npm', ['publish', '--access', 'public'], { cwd, stdio: 'inherit' });
    if (r.status !== 0) {
      failed++;
      console.error(`✗ npm publish ${id} failed; its registry entry is skipped`);
      continue;
    }
  }

  const listed = sh('curl', ['-s', `https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(server.name)}`]);
  let live = false;
  try {
    live = JSON.parse(listed.stdout).servers.some((s) => s.server.name === server.name && s.server.version === server.version);
  } catch {}
  if (live) console.log(`= ${server.name} ${server.version} already in the MCP registry`);
  else if (DRY) console.log(`would publish ${server.name} ${server.version} to the MCP registry`);
  else {
    const r = registryLogin()
      ? sh('mcp-publisher', ['publish'], { cwd, stdio: ['ignore', 'inherit', 'inherit'] })
      : { status: 1 };
    if (r.status !== 0) {
      failed++;
      console.error(`✗ MCP registry publish ${server.name} failed`);
    }
  }
}
console.log(failed ? `\n${failed} step(s) failed` : '\nevery package is live');
process.exit(failed ? 1 : 0);
