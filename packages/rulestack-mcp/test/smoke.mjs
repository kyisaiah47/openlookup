// Live smoke test: spawn the stdio server as an MCP client would, list its tools, call each one
// against production and fail on an error or an empty answer. An upstream shape drift returns 200
// with nothing in it, and only a live call shows that.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const CASES = [{"name": "search_agent_configs", "args": {"stack": "nextjs", "limit": 2}}];

const client = new Client({ name: 'rulestack-mcp-smoke', version: '0.0.0' });
await client.connect(new StdioClientTransport({
  command: 'node',
  args: [new URL('../bin/rulestack-mcp.js', import.meta.url).pathname],
}));

const { tools } = await client.listTools();
const listed = tools.map((t) => t.name).sort().join(',');
const expected = CASES.map((c) => c.name).sort().join(',');
let failed = listed === expected ? 0 : 1;
console.log(`${failed ? '✗' : '✓'} tools/list: ${listed}`);

for (const c of CASES) {
  const res = await client.callTool({ name: c.name, arguments: c.args });
  const data = JSON.parse(res.content[0].text);
  const bad = data.error ? `ERROR ${data.error}` : Object.keys(data).length < 2 ? 'empty answer' : '';
  if (bad) failed++;
  console.log(`${bad ? '✗' : '✓'} ${c.name} ${bad || `${Object.keys(data).length} fields`}`);
}

await client.close();
process.exit(failed ? 1 : 0);
