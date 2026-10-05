// lib.js: the code every Compound Labs product MCP server shares. Source of truth is
// packages/shared/lib.js; `node ops/packages/sync.mjs` copies it into each package.
//
// Every tool is a read-only request against an endpoint that already serves the product's own
// pages, with no key and no signup. Responses are trimmed before they leave the server, because
// an agent's context is the scarce resource.

import { z } from 'zod';

export const API = {
  rulestack: 'https://rulestack.thecompound.tech/api',
  skillworks: 'https://skillworks.thecompound.tech/api',
  blockdex: 'https://blockdex.thecompound.tech/api',
  tooldrift: 'https://tooldrift.thecompound.tech/api',
  stillshipping: 'https://stillshipping.thecompound.tech/api',
  kitgrade: 'https://kitgrade.thecompound.tech/api',
  stacktab: 'https://stacktab.thecompound.tech/api',
  storeready: 'https://storeready.thecompound.tech/api',
  scriptprobe: 'https://scriptprobe.thecompound.tech/api',
};

/** Cap on rows returned to a caller. Above this the answer stops being an answer. */
export const MAX_ROWS = 10;

/** ⛔ EVERY REQUEST GETS A DEADLINE. An `await fetch` with no `signal` never settles when the
 *  socket dies, and all eight directory tools sit behind this one call — so a single dead upstream
 *  would hang the MCP client with no error and stall the agent mid-turn, which is the worst
 *  failure available to a tool something is waiting on. Same class as the three shared libraries
 *  this estate fixed on 2026-08-13. The rejection lands in the tool() wrapper below, which already
 *  turns an upstream failure into a readable `{ error }` rather than a protocol error. */
export const TIMEOUT_MS = Number(process.env.COMPOUND_MCP_TIMEOUT_MS || 10_000);

export async function get(url) {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`upstream ${res.status} for ${url}`);
  return res.json();
}

/** ScriptProbe's check is a POST with a JSON body. It still only reads: the endpoint fetches the
 *  public npm packument and tarball and stores nothing, so the read-only hints stay true. */
export async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Math.max(TIMEOUT_MS, 30_000)),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `upstream ${res.status} for ${url}`);
  return data;
}

export const qs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

export const clamp = (n) => Math.min(Math.max(Number(n) || 5, 1), MAX_ROWS);

/**
 * ⛔ ANNOTATIONS ARE NOT OPTIONAL, AND THEY BELONG HERE RATHER THAN ON EACH TOOL.
 *
 * Anthropic's connector review criteria: "Every tool must include a `title` and the applicable
 * hint" and missing annotations are the single largest cause of rejection. Every tool this
 * package ships is an unauthenticated GET against a public endpoint: it reads, it never writes,
 * it never deletes, and calling it twice returns the same answer. So the hints are the same for
 * every tool, and stamping them in the shared registrar means a tool added next month gets them
 * by being registered the normal way, instead of by somebody remembering a line. `title` is
 * lifted off the config that already carries it, so the two can never disagree.
 *
 * `openWorldHint: true` because the answer comes from a live upstream, not from a closed set.
 */
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

/**
 * Register a tool whose handler returns a plain object.
 *
 * Every tool returns both `content` (the text an older client reads) and `structuredContent`
 * (what a client that supports it parses), and every one catches its own upstream failure and
 * returns it as data. A tool that throws makes the whole call look broken to the agent; a tool
 * that returns `{ error }` lets it try something else, which for a directory lookup is almost
 * always the right outcome.
 */
export function tool(server, name, config, handler) {
  server.registerTool(name, { ...config, annotations: { title: config.title, ...READ_ONLY, ...config.annotations } }, async (args) => {
    let result;
    try {
      result = await handler(args);
    } catch (e) {
      result = { error: String(e?.message || e) };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  });
}
