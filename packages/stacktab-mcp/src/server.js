import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { API, MAX_ROWS, get, post, qs, clamp, tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  // ── StackTab ─────────────────────────────────────────────────────────────────────────────
  tool(
    server,
    'lookup_service_pricing',
    {
      title: 'Look up current published pricing for a SaaS service',
      description:
        'Read StackTab, which re-checks the published pricing of the services a product runs ' +
        /* Four categories, not six. StackTab's live catalogue (fetched 2026-08-13) serves 29
         * services across auth, database, hosting and payments — there is no email category and
         * no analytics category, so an agent asking for either got an empty result that reads as
         * "this service has no pricing" rather than "we do not cover that". */
        'on (auth, database, hosting, payments) and records when each plan ' +
        'was last verified against the vendor\'s own page. Use when asked what something costs ' +
        'or what its free tier includes. Prices and free-tier limits change often enough that a ' +
        'remembered figure is a guess; each plan here carries the date it was last checked.',
      inputSchema: {
        category: z.string().optional().describe('Filter by category: "auth", "database", "hosting" or "payments".'),
        /* `resend` was the documented example and is not in the catalogue — the example a reader
         * copies first has to be one that returns something. */
        service: z.string().optional().describe('A specific service slug or name, e.g. "clerk", "neon", "stripe".'),
      },
    },
    async ({ category, service }) => {
      const d = await get(`${API.stacktab}/catalogue`);
      const needle = String(service || '').toLowerCase();
      const rows = (d.services || []).filter(
        (s) =>
          (!category || s.category?.toLowerCase() === category.toLowerCase()) &&
          (!needle || s.slug?.toLowerCase().includes(needle) || s.name?.toLowerCase().includes(needle)),
      );
      return {
        filters: { category: category || null, service: service || null },
        categories: [...new Set((d.services || []).map((s) => s.category))].sort(),
        services: rows.slice(0, MAX_ROWS).map((s) => ({
          service: s.slug,
          name: s.name,
          category: s.category,
          tagline: s.tagline,
          pricing_url: s.pricing_url,
          plans: (s.plans || []).map((p) => ({
            plan: p.name,
            base_monthly_usd: p.base_monthly_usd,
            included: p.included,
            notes: p.notes,
            // `price_status` distinguishes a published number from an inferred one, and
            // `verified_at` is when a human-visible pricing page last agreed with it. Both
            // travel with the price or the price is just a number with a date on it.
            price_status: p.price_status,
            verified_at: p.verified_at,
          })),
        })),
        browse: 'https://stacktab.thecompound.tech',
      };
    },
  );

  tool(
    server,
    'estimate_stack_cost',
    {
      title: 'Estimate the monthly bill for a named stack at a given scale',
      description:
        'Price a whole stack at a chosen user count using StackTab\'s verified plan data. ' +
        'Returns the plan each service lands on and an itemised bill — which lines are included ' +
        'in the base fee and which are metered overages. Use when someone asks "what will this ' +
        'cost at N users" instead of estimating from memory.',
      inputSchema: {
        stack: z.string().describe('Comma-separated service slugs, e.g. "supabase,clerk,polar,vercel". Look them up with lookup_service_pricing.'),
        users: z.number().optional().describe('Monthly active users to price at. Default 10,000.'),
      },
    },
    async ({ stack, users }) => {
      const d = await get(`${API.stacktab}/estimate?${qs({ stack, users })}`);
      if (d.error) return { error: d.error, browse: 'https://stacktab.thecompound.tech' };
      const picks = d.at?.picks || [];
      /* ⛔ THIS RECOMPUTED A TOTAL THE API HAD DELIBERATELY REFUSED TO GIVE.
       *
       * StackTab's own estimator (src/lib/estimate.ts:362-364) is explicit:
       *
       *     const unpriced = picks.filter((e) => e.total === null).map((e) => e.serviceName);
       *     const total = unpriced.length ? null : round(picks.reduce(...));
       *
       * A service whose every plan is blocked at this usage comes back with `total: null`, and the
       * stack total is then `null` ON PURPOSE — a bill missing one of its lines is not a smaller
       * bill, it is not a bill. StackTab's own UI says so out loud: "No total: X publishes no rate
       * at this usage."
       *
       * This handler ignored `d.at.total` and summed the picks itself with `p.total || 0`, which
       * turns that deliberate null into a ZERO. The unpriced service silently contributed nothing
       * and the agent received a confident number that was too low, with no field anywhere in the
       * response hinting a line was missing — `unpriced` was dropped entirely.
       *
       * ⚠️ TODAY'S CATALOGUE DOES NOT TRIGGER IT. Checked live 2026-08-13 across several stacks up
       * to 100M users: every pick priced, `unpriced` empty, so the two numbers agree and the bug
       * is invisible. That is what makes it worth fixing now rather than when someone notices —
       * it is one capped plan away from shipping a wrong bill, and nothing would fail. */
      return {
        stack: d.stack,
        unknown_services: d.unknown_services,
        users: d.at?.users,
        monthly_total_usd: d.at?.total ?? null,
        // Present and empty on a clean estimate; naming the services is the whole point when it
        // is not, because `monthly_total_usd: null` on its own does not say which line is missing.
        unpriced_services: d.at?.unpriced ?? [],
        services: picks.map((p) => ({
          service: p.serviceName || p.service,
          plan: p.planName || p.plan,
          monthly_usd: p.total,
          lines: (p.lines || []).map((l) => ({ label: l.label, detail: l.detail, usd: l.amount })),
        })),
        browse: 'https://stacktab.thecompound.tech',
      };
    },
  );

  return server;
}
