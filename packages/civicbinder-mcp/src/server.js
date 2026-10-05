import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { tool } from './lib.js';

/* The version a client reads in `initialize` is package.json, never a typed literal. */
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const CB_SITE = 'https://civicbinder.org';
export const SB_URL = 'https://xowekqdsttxwbhfxvusa.supabase.co';
// Supabase publishable key — designed to ship in public clients; RLS scopes reads.
export const SB_KEY = 'sb_publishable_9GvEPSkV3gyuyN02ZZJcig_gWo1j9LK';

const ADA_COLUMNS = [
  'domain', 'entity_name', 'entity_type', 'state', 'city', 'population', 'deadline',
  'url_scanned', 'scanned_at', 'axe_version', 'pages_scanned',
  'violations_total', 'violations_serious', 'violations_critical', 'top_rules', 'grade',
].join(',');

const GRADE_EXPLANATION = {
  A: 'no serious or critical failures detected',
  B: 'no critical failures and at most 2 serious ones',
  C: '10 or fewer serious-or-critical failures',
  D: 'between 11 and 25 serious-or-critical failures',
  F: 'more than 25 serious-or-critical failures',
};

const DEADLINE_LABEL = {
  '2027-04-26': 'April 26, 2027 (communities of 50,000+)',
  '2028-04-26': 'April 26, 2028 (smaller communities and special districts)',
};

const DOMAIN_RE = /^[a-z0-9][a-z0-9.-]{1,250}$/;

/** Strip protocol / www / path from whatever the caller pasted. */
function normalizeDomain(input) {
  let d = String(input || '').trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
  d = d.split(/[/?#]/)[0];
  return d;
}

/** Every request gets a deadline. An `await fetch` with no `signal` never settles when the socket
 *  dies — the MCP client then hangs with no error and the agent stalls mid-turn, which is the worst
 *  possible failure for a tool an agent is waiting on. */
const TIMEOUT_MS = Number(process.env.COMPOUND_MCP_TIMEOUT_MS || 10_000);

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`upstream ${res.status}: ${body}`);
  }
  return res.json();
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

const ADA_RECEIPT = () =>
  receipt(
    ['CivicBinder Municipal Web Accessibility Index (axe-core, WCAG 2.1 AA)'],
    `${SB_URL}/rest/v1/cb_ada_scans`,
    'Covers US local-government websites that the index has scanned. The grade describes the ' +
      'pages listed in pages_scanned as they were on scanned_at, not the site as it stands now, ' +
      'and an automated scan cannot establish WCAG conformance on its own.',
  );

async function lookupAdaReport(rawDomain) {
  const domain = normalizeDomain(rawDomain);
  if (!DOMAIN_RE.test(domain)) {
    return { found: false, error: `"${rawDomain}" does not look like a domain name.` };
  }
  const rows = await fetchJson(
    `${SB_URL}/rest/v1/cb_ada_scans?status=eq.scanned&domain=eq.${encodeURIComponent(domain)}&select=${ADA_COLUMNS}&limit=1`,
    { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  );
  const row = rows[0];
  if (!row) {
    return {
      found: false,
      domain,
      message:
        `${domain} is not in the CivicBinder Municipal Web Accessibility Index yet. ` +
        `The index covers scanned US local-government .gov websites. ` +
        `Browse the full index at ${CB_SITE}/ada or the open dataset at ${CB_SITE}/ada/dataset.json.`,
      checked: ADA_RECEIPT(),
    };
  }
  return {
    found: true,
    domain: row.domain,
    entity_name: row.entity_name,
    entity_type: row.entity_type,
    city: row.city,
    state: row.state,
    population: row.population,
    grade: row.grade,
    grade_meaning: GRADE_EXPLANATION[row.grade] || null,
    violations_total: row.violations_total,
    violations_serious: row.violations_serious,
    violations_critical: row.violations_critical,
    top_rules: row.top_rules,
    ada_title_ii_deadline: row.deadline,
    deadline_label: DEADLINE_LABEL[row.deadline] || row.deadline,
    url_scanned: row.url_scanned,
    scanned_at: row.scanned_at,
    axe_version: row.axe_version,
    pages_scanned: row.pages_scanned,
    report_url: `${CB_SITE}/ada/${row.domain}`,
    checked: ADA_RECEIPT(),
  };
}

/** Build the McpServer with every tool registered. One instance per connection. */
export function buildServer() {
  const server = new McpServer({ name: PKG.name, version: PKG.version });

  tool(
    server,
    'lookup_ada_report',
    {
      title: 'Look up an ADA Title II website accessibility report',
      description:
        'Look up a US local-government (.gov) domain in the CivicBinder Municipal Web ' +
        'Accessibility Index. Returns the accessibility grade (A-F), WCAG 2.1 AA violation ' +
        'counts from an axe-core scan, the failing rules, the entity\'s ADA Title II ' +
        'compliance deadline (April 2027 or April 2028), and a link to the full public ' +
        'report page. Use for questions like "is cityofx.gov ADA compliant" or "how ' +
        'accessible is this county website". Every answer carries a `checked` receipt: when ' +
        'the lookup ran, which index was consulted, and what that index does and does not ' +
        'cover, so the check can be cited later without being re-run.',
      inputSchema: {
        domain: z
          .string()
          .describe('The .gov domain to look up, e.g. "denvergov.org" or "cityofmadison.com". Protocol and paths are stripped automatically.'),
      },
    },
    ({ domain }) => lookupAdaReport(domain),
  );

  return server;
}
