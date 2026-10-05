import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { API, MAX_ROWS, get, post, qs, clamp, tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  // ── SkillWorks ───────────────────────────────────────────────────────────────────────────
  tool(
    server,
    'search_agent_skills',
    {
      title: 'Search published Claude Code skills, plugins and marketplaces',
      description:
        'Search SkillWorks, an index of publicly published agent skills, plugins and skill ' +
        'marketplaces, ranked by installs and repository signal. Use before writing a skill ' +
        'from scratch to check whether one already exists, or when a user asks "is there a ' +
        'skill for X" / "what should I install for Y". Returns the install command for each ' +
        'result, so the answer is directly actionable.',
      inputSchema: {
        q: z.string().describe('What the skill should do, in plain words. e.g. "pdf generation", "code review", "terraform".'),
        // ⛔ `subagent` WAS MISSING FROM THIS LIST and it is one of the four kinds SkillWorks
        // indexes — 112,215 listings of it. A model reads this string as the vocabulary, so an
        // omission here is a filter nothing can ask for.
        kind: z.string().optional().describe('Filter to one of: skill, subagent, plugin, marketplace.'),
        limit: z.number().optional().describe('How many to return, 1-10. Default 5.'),
      },
    },
    async ({ q, kind, limit }) => {
      /* ⛔ `q` REACHED THIS ENDPOINT AND WAS DROPPED ON THE FLOOR UNTIL 2026-09-01. skillworks
       * /api/list was written for the browse grid and never read the parameter, so every call
       * here — for any query — came back with the same top five of the score order
       * (skill-creator, ui-ux-pro-max, turborepo, systematic-debugging, writing-skills). It
       * returned 200 the whole time, which is why nothing caught it. Fixed in that route; the
       * response now echoes `q`, so the assertion below is checkable rather than assumed. */
      const d = await get(`${API.skillworks}/list?${qs({ q, kind, limit: clamp(limit) })}`);
      if (d && d.q === null) {
        return {
          error: 'skillworks did not apply the query — the directory returned an unranked listing',
          browse: `https://skillworks.thecompound.tech/search?q=${encodeURIComponent(q)}`,
        };
      }
      return {
        query: q,
        results: (d.rows || []).map((r) => ({
          name: r.name,
          kind: r.kind,
          repo: r.repo_full_name,
          description: r.description,
          install: r.install_command,
          installs: r.installs,
          stars: r.stars,
          score: r.score,
          /* How many repositories carry a listing of this name. The corpus is 697,793 listings
           * over 304,731 distinct names because people commit their vendored .claude/skills, so
           * this is the adoption signal that exists for every row — `installs` is present on
           * 4,439 of them. A result carrying `copies: 840` is the canonical copy of something
           * widely used; `copies: 1` is one person's. */
          copies: r.copies,
          url: r.url,
        })),
        browse: 'https://skillworks.thecompound.tech',
      };
    },
  );

  return server;
}
