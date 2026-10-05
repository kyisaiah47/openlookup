import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const GS_API = 'https://goodstanding.thecompound.tech/api/lookup';

/** Every request gets a deadline. An `await fetch` with no `signal` never settles when the socket
 *  dies — the MCP client then hangs with no error and the agent stalls mid-turn, which is the worst
 *  possible failure for a tool an agent is waiting on. */
const TIMEOUT_MS = Number(process.env.COMPOUND_MCP_TIMEOUT_MS || 10_000);

/** ⛔ NDJSON, NOT JSON. GoodStanding's /api/lookup streams progress and finishes with the answer:
 *
 *    content-type: application/x-ndjson; charset=utf-8
 *    {"stage":"read","state":"running"}
 *    {"stage":"read","state":"done","ms":0}
 *    …
 *    {"result":{"query":"…","clear":true,"results":[]}}
 *
 *  `res.json()` dies on line 2, so lookup_nonprofit_status returned an MCP protocol error —
 *  "Unexpected non-whitespace character after JSON at position 35" — for EVERY input it has ever
 *  received, including the default EIN in its own smoke test. Verified against the live endpoint
 *  2026-08-13; the header above is copied from that response.
 *
 *  The answer is also NESTED under `result`, so reading `data.clear` off the parsed line would
 *  report a clean nonprofit as delinquent — a worse bug than the crash, because it looks like an
 *  answer. Both are handled here. */
async function fetchNdjsonResult(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`upstream ${res.status}: ${body}`);
  }
  const text = await res.text();
  const lines = text.trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj && Object.prototype.hasOwnProperty.call(obj, 'result')) return obj.result;
    } catch {
      /* a progress line that is not the terminal frame */
    }
  }
  throw new Error('upstream returned no result frame');
}

/* ⛔ THE LOOKUP AND THE OUTCOME ARE TWO DIFFERENT FACTS, AND ONLY ONE OF THEM WAS EVER
 * RETURNED.
 *
 * Asked for by @jithox.bsky.social on 2026-09-18: "For compliance workflows, I would also
 * keep capability lookup separate from the actual outcome and retain a dated receipt so an
 * agent can explain what was checked and when."
 *
 * Measured against the live endpoint on 2026-09-20, lookup_nonprofit_status returned
 * `{ ein, clear: true, message, lookup_url }` and nothing else. The OUTCOME was there. What
 * was CHECKED, and when, existed only inside an English sentence in `message`, which an agent
 * cannot cite, cannot compare against a later run, and cannot put in a file. So an agent that
 * had done a real check could not say what it had done, and an agent that had done nothing
 * could produce the same sentence.
 *
 * `checked` is that receipt. It is deliberately separate from the verdict: `clear` is what
 * came back, `checked` is what was consulted to get it, and a reader can disagree with the
 * second without doubting the first.
 *
 * `scope` is the part that matters most and is the easiest to leave out. A nonprofit absent
 * from these lists is not a nonprofit in good standing everywhere, it is a nonprofit absent
 * from THESE lists. Stating the boundary is what makes the receipt safe to quote, and leaving
 * it implicit is how a narrow check gets cited as a broad one.
 *
 * `at` is when the LOOKUP ran. Where the underlying record carries its own date, the ADA scan
 * does with `scanned_at`, that stays on the row and is a different fact: one is when the
 * evidence was gathered, the other is when it was consulted. A compliance answer needs both,
 * and collapsing them is how a 2026 answer gets quoted off a 2025 scan.
 *
 * No error branch gets a receipt. A rejected domain or a malformed EIN means nothing was
 * checked, and a receipt for a check that did not happen is worse than no receipt at all. */
function receipt(sources, via, scope) {
  return { at: new Date().toISOString(), sources, via, scope };
}

const GS_RECEIPT = () =>
  receipt(
    [
      'IRS Automatic Revocation of Exemption List',
      'California Attorney General Registry of Charities and Fundraisers',
    ],
    GS_API,
    'Covers only the two lists named above, as GoodStanding retains them. A clear result means ' +
      'the EIN is absent from those lists. It is not a statement that the organization was ' +
      'never revoked, and no other state registry is consulted.',
  );

async function lookupNonprofitStatus(rawEin) {
  const digits = String(rawEin || '').replace(/\D/g, '');
  if (digits.length !== 9) {
    return { error: `"${rawEin}" is not a valid EIN. An EIN has 9 digits, e.g. 12-3456789.` };
  }
  const data = await fetchNdjsonResult(`${GS_API}?q=${digits}`);
  if (data.clear) {
    return {
      ein: digits,
      clear: true,
      message:
        `EIN ${digits} does not appear on the IRS auto-revocation list or the ` +
        `California registry delinquency/suspension lists that GoodStanding tracks. ` +
        `On those lists, this organization reads as in good standing. ` +
        `Full check: https://goodstanding.thecompound.tech/#lookup`,
      checked: GS_RECEIPT(),
    };
  }
  return {
    ein: digits,
    clear: false,
    results: data.results,
    lookup_url: 'https://goodstanding.thecompound.tech/#lookup',
    checked: GS_RECEIPT(),
  };
}

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  tool(
    server,
    'lookup_nonprofit_status',
    {
      title: 'Look up nonprofit IRS / California good standing by EIN',
      description:
        'Check a US nonprofit\'s standing by EIN against the IRS auto-revocation list ' +
        '(tax-exempt status revoked for three consecutive missed Form 990 filings) and ' +
        'California Registry of Charities delinquency/suspension lists. Returns revocation ' +
        'and reinstatement dates, whether the streamlined 15-month reinstatement window is ' +
        'still open, and whether AB 488 requires fundraising platforms to block donations. ' +
        'A "clear" result means the EIN is on none of the tracked lists. The verdict and the ' +
        'lookup are separate fields: `clear` is the outcome, and the `checked` receipt records ' +
        'when the lookup ran, which lists were consulted, and the limits of that coverage.',
      inputSchema: {
        ein: z
          .string()
          .describe('The organization\'s 9-digit EIN, with or without a dash, e.g. "12-3456789".'),
      },
    },
    ({ ein }) => lookupNonprofitStatus(ein),
  );

  return server;
}
