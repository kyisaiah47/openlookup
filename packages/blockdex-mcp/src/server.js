import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { API, MAX_ROWS, get, post, qs, clamp, tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  // ── BlockDex ─────────────────────────────────────────────────────────────────────────────
  tool(
    server,
    'search_component_registries',
    {
      title: 'Search shadcn-style component registries',
      description:
        'Search BlockDex, a cross-registry index of shadcn-compatible components, blocks, hooks ' +
        'and libraries from dozens of public registries. Use when a user wants a UI component ' +
        'and you would otherwise hand-write it — "is there a date range picker block", "which ' +
        'registries have a kanban board". Returns the registry, the item type and its ' +
        'dependencies so you can judge the cost of pulling it in.',
      inputSchema: {
        q: z.string().describe('What the component does. e.g. "data table", "auth form", "kanban".'),
        /* ⛔ "ui" IS NOT A KIND AND NEVER WAS. BlockDex's kinds are the seven below; `registry:ui`
         * is the raw registry TYPE, a different field. /api/search validates kind against its own
         * enum and silently drops anything else rather than failing, so `kind: "ui"` did not error
         * — it returned the whole unfiltered corpus. Measured 2026-09-01: `q=data table&kind=ui`
         * came back `filters.kind: null` with total 487, against 241 for `kind=component`. Every
         * filtered component search this tool ran was unfiltered and reported as filtered. */
        kind: z
          .string()
          .optional()
          .describe('Filter by item kind: component, block, hook, example, lib, theme, other.'),
        access: z
          .string()
          .optional()
          .describe('Filter by whether the item is free to install: free, paid, unknown.'),
        limit: z.number().optional().describe('How many to return, 1-10. Default 5.'),
      },
    },
    async ({ q, kind, access, limit }) => {
      const d = await get(`${API.blockdex}/search?${qs({ q, kind, access, limit: clamp(limit) })}`);
      /* A kind the API did not accept comes back as `filters.kind: null` over the whole corpus.
       * Say so rather than presenting an unfiltered answer as a filtered one. */
      const dropped = kind && d.filters && d.filters.kind === null ? kind : null;
      return {
        query: q,
        total: d.total,
        ...(dropped
          ? { warning: `kind "${dropped}" is not one of component, block, hook, example, lib, theme, other — these results are UNFILTERED` }
          : {}),
        items: (d.items || []).map((i) => ({
          name: i.name,
          title: i.title,
          registry: i.registry_name,
          type: i.type,
          description: i.description,
          dependencies: i.dependencies?.slice(0, 8),
          files: i.file_count,
          /* ⛔ THE THREE FIELDS THAT MAKE THE ANSWER ACTIONABLE, AND ALL THREE WERE DROPPED.
           * BlockDex's own API.md says of install_cmd: "It is the single thing most visitors came
           * for." An agent that gets a component name and no install command has to guess the
           * registry's URL shape, which is exactly the guess this index exists to remove. And
           * `access` is, in that document's words, the first question a person asks — `unknown`
           * is a third answer meaning the registry serves no item endpoint we could probe, and
           * it must never be presented as if it were free. */
          install: i.install_cmd,
          access: i.access,
          docs: i.docs_url || i.preview_url || null,
        })),
        browse: 'https://blockdex.thecompound.tech',
      };
    },
  );

  return server;
}
