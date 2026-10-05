import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { API, MAX_ROWS, get, post, qs, clamp, tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  // ── RuleStack ────────────────────────────────────────────────────────────────────────────
  tool(
    server,
    'search_agent_configs',
    {
      title: 'Search real AGENTS.md / CLAUDE.md files from public repositories',
      description:
        'Search RuleStack, an index of real agent instruction files (AGENTS.md, CLAUDE.md, ' +
        'Cursor rules, Copilot instructions, Windsurf, GEMINI.md, Cline) harvested from public ' +
        'GitHub repositories and scored for quality. Use when writing or reviewing an agent ' +
        'config and you want to see how well-maintained projects with a given stack actually ' +
        'write theirs — "show me CLAUDE.md files from Next.js repos", "what do good AGENTS.md ' +
        'files put in their build section".',
      inputSchema: {
        stack: z.string().optional().describe('Comma-separated stack slugs, ANDed. e.g. "nextjs,typescript".'),
        format: z.string().optional().describe('Comma-separated format slugs: agents-md, claude-md, cursor-rules, copilot-instructions, windsurf-rules, gemini-md, cline-rules.'),
        tag: z.string().optional().describe('Comma-separated section tags, ANDed: build, test, security, code-style, architecture, git-pr, do-not, docs.'),
        min_quality: z.number().optional().describe('Minimum quality score, 0-100.'),
        limit: z.number().optional().describe('How many to return, 1-10. Default 5.'),
      },
    },
    async ({ stack, format, tag, min_quality, limit }) => {
      const d = await get(`${API.rulestack}/configs?${qs({ stack, format, tag, min_quality, limit: clamp(limit), sort: 'quality' })}`);
      return {
        total: d.pagination?.total ?? d.configs?.length ?? 0,
        configs: (d.configs || []).map((c) => ({
          repo: c.repo_full_name,
          format: c.format,
          path: c.path,
          url: c.html_url,
          quality: c.quality,
          words: c.body_words,
          covers: c.section_tags,
          stacks: c.stacks?.slice(0, 8),
          commands: c.commands?.slice(0, 6),
        })),
        browse: 'https://rulestack.thecompound.tech/configs',
      };
    },
  );

  return server;
}
