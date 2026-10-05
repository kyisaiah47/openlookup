import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { API, MAX_ROWS, get, post, qs, clamp, tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  // ── KitGrade ─────────────────────────────────────────────────────────────────────────────
  tool(
    server,
    'grade_starter_kit',
    {
      title: 'Look up a graded SaaS/Next.js starter kit',
      description:
        'Read KitGrade, which installs and grades public starter kits and boilerplates — what ' +
        'is actually wired up (auth, billing, email, tests), what only appears in the README, ' +
        'and how fresh the dependencies are. Use when someone asks which starter to build on.',
      inputSchema: {
        q: z.string().optional().describe('Kit name to look up. Omit for the top-graded kits.'),
        limit: z.number().optional().describe('How many to return, 1-10. Default 5.'),
      },
    },
    async ({ q, limit }) => {
      /* ⛔ KITGRADE'S LIST ENDPOINT IGNORES `q`. Verified 2026-08-13 with q, search, slug and
       * name: all four return total 34 and the identical top five, so asking for "shipfast"
       * answered with Bullet Train — a confidently wrong answer, which for an agent tool is worse
       * than an empty one. The per-slug route does work (`/api/kits/shipfast` returns ShipFast),
       * so a named request goes there first and falls back to the list when the slug is unknown. */
      const slug = String(q || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let rows = [];
      if (slug) {
        try {
          const one = await get(`${API.kitgrade}/kits/${encodeURIComponent(slug)}`);
          const kit = one.kit || one;
          if (kit && (kit.slug || kit.name)) rows = [kit];
        } catch {
          /* unknown slug — fall through to the list, which is still a useful answer */
        }
      }
      if (!rows.length) {
        const d = await get(`${API.kitgrade}/kits?${qs({ q, limit: clamp(limit) })}`);
        rows = d.kits || d.rows || (Array.isArray(d) ? d : []);
      }
      return {
        query: q || '(top graded)',
        /* ⛔ SAME CLASS: a tool named grade_starter_kit returned no grade. KitGrade's row (keys
         * read off /api/kits on 2026-08-13) has `evidence_level`, `coverage`, `repo` and
         * `homepage` — there is no `grade`, no `verified_features` and no `url`, so three of the
         * six fields resolved to undefined and vanished. `evidence_level` is the real grade: it
         * says whether the kit was installed and run or only read. */
        kits: rows.slice(0, clamp(limit)).map((k) => ({
          name: k.name || k.slug,
          grade: k.evidence_level,
          score: k.score,
          stack: k.stack,
          coverage: k.coverage,
          price: k.price_label,
          url: k.homepage || (k.repo ? `https://github.com/${k.repo}` : null),
        })),
        browse: 'https://kitgrade.thecompound.tech',
      };
    },
  );

  return server;
}
