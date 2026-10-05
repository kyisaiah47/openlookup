import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { API, MAX_ROWS, get, post, qs, clamp, tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  // ── ScriptProbe ──────────────────────────────────────────────────────────────────────────
  /* An agent runs `npm install` on a name it chose itself, often from training data. This is the
   * check that belongs before that command: what the package runs at install time, whether it
   * reaches the network, and whether the account publishing it just changed.
   *
   * The upstream answer carries the full source of every file a lifecycle script calls (11KB for
   * esbuild alone). That is for a person reading the page. It is dropped here and replaced by a
   * link, because an agent's context is the scarce resource. The 30s timeout is the route's own
   * maxDuration: the check downloads and unpacks the tarball. */
  tool(
    server,
    'check_package_scripts',
    {
      title: 'Check an npm package for install scripts and publisher changes before installing it',
      description:
        'Read ScriptProbe on one npm package before you install it. Returns every lifecycle ' +
        'script the package runs at install time (preinstall, install, postinstall, prepare) ' +
        'with what each one does, whether it reaches the network, spawns a child process or ' +
        'builds native code, the account that published the latest version and whether it ' +
        'differs from the previous ten, and an overall verdict of none / low / medium / high. ' +
        'Use before running `npm install <name>` on a package you have not used in this ' +
        'project, or when asked whether a package is safe to add. A high verdict is a reason ' +
        'to read the script, not proof of malware: esbuild reads high because its postinstall ' +
        'downloads a platform binary. Every answer carries a `checked` receipt.',
      inputSchema: {
        name: z.string().describe('The npm package name, e.g. "esbuild" or "@scope/pkg".'),
        version: z.string().optional().describe('A version or dist-tag. Default: latest.'),
      },
    },
    async ({ name, version }) => {
      const pkg = String(name || '').trim().toLowerCase();
      const d = await post(`${API.scriptprobe}/check`, { name: pkg, version });
      if (d.reachable === false) return { name: pkg, error: d.error || 'The npm registry did not return this package.' };
      const h = d.history || {};
      return {
        name: d.name,
        version: d.version,
        verdict: d.verdict,
        findings: (d.findings || []).slice(0, MAX_ROWS).map((f) => ({
          severity: f.severity,
          category: f.category,
          title: f.title,
          detail: f.detail,
          where: f.where,
        })),
        scripts: (d.scripts || []).map((s) => ({
          script: s.script,
          command: s.command,
          does: s.description,
          network: s.networkReach,
          child_process: s.execChild,
          native_build: s.nativeBuild,
        })),
        has_native_build_file: d.hasNativeBuildFile,
        publisher: {
          latest_version: h.latestVersion ?? null,
          latest_publisher: h.latestPublisher ?? null,
          different_account_than_previous_10: h.differentAccountThanPrevious10 ?? null,
          new_publisher_in_last_90_days: h.newPublisherInLast90Days ?? null,
          maintainers: (h.maintainers || []).map((m) => m.name),
        },
        recent_versions: (d.registry?.ledger || []).slice(0, 5),
        repository: d.registry?.repository ?? null,
        report_url: `https://scriptprobe.thecompound.tech/p/${encodeURIComponent(d.name)}`,
        checked: {
          at: d.checkedAt || d.read_at,
          sources: ['npm registry packument', `npm tarball ${d.registry?.tarball_url || ''}`.trim()],
          via: `${API.scriptprobe}/check`,
          scope:
            'Covers the lifecycle scripts in this one version and the publish history of its ' +
            'last eleven versions. It does not read the package\'s runtime code or its ' +
            'dependencies, so a clean verdict says nothing runs at install, not that the ' +
            'package is safe to execute.',
        },
      };
    },
  );

  return server;
}
