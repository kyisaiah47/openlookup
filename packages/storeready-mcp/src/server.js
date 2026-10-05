import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { API, MAX_ROWS, get, post, qs, clamp, tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  // ── StoreReady ───────────────────────────────────────────────────────────────────────────
  /* ⛔ THE ONLY STOREFRONT THIS PRODUCT CAN ENTER. StoreReady is a sourced comparison of the AI
   * mobile-app builders on one question — can the app it hands you clear Apple App Store review.
   * It has no installable artifact and no ecommerce surface, so there is nothing to submit to an
   * app store of its own. Its buyers are people mid-decision about a builder, and increasingly
   * they ask an agent. This tool is that shelf.
   *
   * The corpus is the reason it is worth a tool at all: every verdict is attached to a URL that
   * was opened and read, with the date, and an unsettled question comes back `unknown` rather
   * than guessed — which is exactly the failure mode a model has on this topic, where the
   * builders launch and change faster than any training cutoff. */
  tool(
    server,
    'compare_app_builders',
    {
      title: 'Compare AI app builders on whether their output clears App Store review',
      description:
        'Read StoreReady, a sourced comparison of the AI mobile-app builders (Rork, Vibecode, ' +
        'a0.dev, Replit, Bolt and the rest) on one question: can the app it hands you go up on ' +
        'your own Apple Developer account and survive review. Returns what each builder ' +
        'outputs, whether you can export the source, who submits the binary, the App Store ' +
        'guidelines in play, and a verdict of ships / ships-with-caveats / blocked / unknown. ' +
        'Use when asked which AI app builder to pick, or whether one can actually ship to the ' +
        'App Store — the answer changes as builders launch and change, and every verdict here ' +
        'is attached to a source that was read on a stated date.',
      inputSchema: {
        builder: z
          .string()
          .optional()
          .describe('One builder slug or name for the full record with its evidence, e.g. "rork", "vibecode", "bolt".'),
        verdict: z
          .string()
          .optional()
          .describe('Filter the list: ships, ships-with-caveats, blocked, unknown.'),
        limit: z.number().optional().describe('How many to return, 1-10. Default 10.'),
      },
    },
    async ({ builder, verdict, limit }) => {
      /* `submits_for_you: "builder-submits"` is a RISK MARKER, not a feature — App Store
       * guideline 4.2.6 rejects apps submitted by a generation service on a client's behalf.
       * The field travels with its own note so an agent cannot read it as a convenience. */
      const row = (b) => ({
        builder: b.name,
        slug: b.slug,
        verdict: b.review_verdict,
        why: b.review_summary,
        output: b.output_type,
        exports_source: b.exports_source,
        who_submits: b.submits_for_you,
        app_store_guidelines_in_play: b.risk_guidelines,
        free_tier: b.price_free,
        price_from_usd: b.price_from_usd,
        updated_at: b.updated_at,
      });

      if (builder) {
        const slug = String(builder).trim().toLowerCase().replace(/\s+/g, '-');
        const d = await get(`${API.storeready}/builders/${encodeURIComponent(slug)}`);
        return {
          ...row(d.builder),
          detail: {
            output: d.builder.output_detail,
            exports_source: d.builder.exports_source_detail,
            pricing: d.builder.price_note,
          },
          // Every claim carries the source that settles it and the date it was read. An agent
          // repeating a verdict without them is repeating an opinion.
          evidence: (d.evidence || []).slice(0, MAX_ROWS).map((e) => ({
            supports: e.supports,
            claim: e.claim,
            kind: e.kind,
            source: e.source_url,
            source_title: e.source_title,
            read_on: e.source_date,
            link_status: e.link_status,
          })),
          report_url: `https://storeready.thecompound.tech/builder/${d.builder.slug}`,
        };
      }

      const d = await get(`${API.storeready}/builders`);
      let rows = d.builders || [];
      if (verdict) rows = rows.filter((b) => b.review_verdict === String(verdict).trim());
      return {
        total: d.count ?? rows.length,
        // "unknown" means no citable source was found — unproven, NOT failed. Naming the
        // vocabulary in the response is what stops an agent collapsing it into "blocked".
        verdict_vocabulary: {
          ships: 'A documented path to a submitted binary on your own Apple Developer account.',
          'ships-with-caveats':
            'Reaches the App Store, but the last mile happens outside the tool or a named guideline is in play.',
          blocked: 'Does not produce something submittable to the App Store at all.',
          unknown: 'No source found that settles it. Unproven, not failed.',
        },
        builders: rows.slice(0, clamp(limit ?? MAX_ROWS)).map(row),
        browse: 'https://storeready.thecompound.tech',
      };
    },
  );

  return server;
}
