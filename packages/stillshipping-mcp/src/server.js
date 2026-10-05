import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { API, MAX_ROWS, get, post, qs, clamp, tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  // ── StillShipping ────────────────────────────────────────────────────────────────────────
  tool(
    server,
    'check_project_maintenance',
    {
      title: 'Check whether a developer tool is still maintained',
      description:
        'Read StillShipping, which tracks whether developer tools and libraries are still ' +
        'actively shipping — last release, last commit, and whether the project reads as dead. ' +
        'Use before recommending a dependency. A library that was healthy at training time may ' +
        'have been abandoned since, and this is the check that catches it.',
      inputSchema: {
        q: z.string().optional().describe('Tool or library name to look up. Omit to list recently-declared-dead projects.'),
        limit: z.number().optional().describe('How many to return, 1-10. Default 5.'),
      },
    },
    async ({ q, limit }) => {
      const d = await get(`${API.stillshipping}/${q ? 'tools' : 'dead'}?${qs({ q, limit: clamp(limit) })}`);
      const rows = d.tools || d.rows || d.dead || (Array.isArray(d) ? d : []);
      return {
        query: q || '(recently declared dead)',
        /* ⛔ THESE KEYS DID NOT EXIST UPSTREAM, so JSON.stringify dropped them and the tool
         * answered with less than its description promised. The row StillShipping actually
         * serves (keys read off /api/tools on 2026-08-13) carries `verdict`, `pushed_at`,
         * `homepage` and `repo_full_name` — not status / last_commit / url. So the field this
         * tool exists for, the dead-or-alive VERDICT, was the one silently missing. */
        results: rows.slice(0, clamp(limit)).map((t) => ({
          name: t.name || t.slug,
          status: t.verdict,
          last_release: t.last_release_at,
          last_commit: t.pushed_at,
          stars: t.stars,
          url: t.homepage || (t.repo_full_name ? `https://github.com/${t.repo_full_name}` : null),
        })),
        browse: 'https://stillshipping.thecompound.tech',
      };
    },
  );

  return server;
}
