# rulestack-mcp

`rulestack-mcp` is the MCP server for [RuleStack](https://rulestack.thecompound.tech), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/rulestack`

## Tool

| Tool | Answers |
| --- | --- |
| `search_agent_configs(stack?, format?, tag?, min_quality?, limit?)` | Real `AGENTS.md`, `CLAUDE.md`, Cursor, Copilot, Windsurf, GEMINI.md and Cline files from public repositories, scored for quality. Use it to see how maintained projects on a given stack write theirs. |

## Install

```sh
claude mcp add rulestack -- npx -y rulestack-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rulestack": { "command": "npx", "args": ["-y", "rulestack-mcp"] }
  }
}
```

`rulestack-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
