import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { API, MAX_ROWS, get, post, qs, clamp, tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  // ── ToolDrift ────────────────────────────────────────────────────────────────────────────
  tool(
    server,
    'compare_ai_models',
    {
      title: 'Compare current AI model pricing and rankings',
      description:
        'Read ToolDrift, which tracks AI model pricing and which models the major AI-powered ' +
        'apps actually route to, sampled nightly. Use when asked which model to use, what a ' +
        'model costs now, or what changed recently — model pricing moves faster than any ' +
        'training cutoff, so answering from memory is reliably wrong.',
      inputSchema: {
        board: z
          .string()
          .optional()
          .describe(
            'Which ranking to read, as "scope/key". Budget bands: budget/free, budget/value, ' +
            'budget/balanced, budget/premium. Per-tool routing: tool/claude-code, tool/codex-cli, ' +
            'tool/cline, tool/aider, tool/roo-code, tool/kilo-code. Default overall/all.',
          ),
        limit: z.number().optional().describe('How many models to return, 1-10. Default 10.'),
      },
    },
    async ({ board, limit }) => {
      const d = await get(`${API.tooldrift}/leaderboard`);
      const want = (board || 'overall/all').toLowerCase();
      const boards = d.boards || [];
      const picked = boards.find((b) => `${b.scope}/${b.scope_key}`.toLowerCase() === want) || boards[0];
      if (!picked) return { error: 'leaderboard returned no boards', browse: 'https://tooldrift.thecompound.tech' };
      /* ⛔ THE WHOLE METHOD DOCUMENT WAS RETURNED ON EVERY CALL. Measured live 2026-08-13:
       * `d.method` is a 1,324-byte constant — seven prose fields including the full weighting
       * formula and the per-tool board list — and it was spent on every single invocation of this
       * tool, whatever board was asked for.
       *
       * The two sentences that MUST survive are the two an agent gets wrong without them: this
       * ranks ADOPTION, and it does not measure capability. "Ranked #1" read without those is a
       * far stronger claim than the data supports, which is the same reason `rationale` travels
       * on every row below. Everything else is a document, and a document belongs behind a URL. */
      const m = d.method || null;
      return {
        board: `${picked.scope}/${picked.scope_key}`,
        captured_on: d.captured_on ?? null,
        method_summary: m
          ? `Ranks ${m.measures}. Does not measure ${m.does_not_measure} ${m.price_basis}`
          : null,
        method_url: 'https://tooldrift.thecompound.tech/method',
        available_boards: boards.map((b) => `${b.scope}/${b.scope_key}`),
        models: (picked.rows || []).slice(0, clamp(limit)).map((m) => ({
          rank: m.rank,
          model: m.model_id,
          score: m.score,
          blended_usd_per_mtok: m.price_blended_per_m,
          price_band: m.evidence?.band ?? null,
          // Adoption, not capability — the rationale says so and it should travel with the row,
          // because "ranked #1" read without it is a much stronger claim than the data supports.
          rationale: m.rationale,
        })),
        browse: 'https://tooldrift.thecompound.tech',
      };
    },
  );

  return server;
}
