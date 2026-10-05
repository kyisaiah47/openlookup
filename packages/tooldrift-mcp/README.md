# tooldrift-mcp

`tooldrift-mcp` is the MCP server for [ToolDrift](https://tooldrift.thecompound.tech), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/tooldrift`

## Tool

| Tool | Answers |
| --- | --- |
| `compare_ai_models(board?, limit?)` | Current AI model pricing and which models the major coding tools actually route to, sampled nightly. Boards by budget band (`budget/free` … `budget/premium`) or by tool (`tool/claude-code`, `tool/codex-cli`, `tool/cline`, `tool/aider`, …). Ranked on adoption, not capability. Each row carries the rationale that says so. |

## Install

```sh
claude mcp add tooldrift -- npx -y tooldrift-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tooldrift": { "command": "npx", "args": ["-y", "tooldrift-mcp"] }
  }
}
```

`tooldrift-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
