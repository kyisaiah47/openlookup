# stacktab-mcp

`stacktab-mcp` is the MCP server for [StackTab](https://stacktab.thecompound.tech), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/stacktab`

## Tools

| Tool | Answers |
| --- | --- |
| `lookup_service_pricing(category?, service?)` | Published pricing and free-tier limits for auth, database, payments, email and hosting services. Each plan carries the date its published price was last verified against the vendor's own page. |
| `estimate_stack_cost(stack, users?)` | An itemised monthly bill for a named stack at a chosen user count, showing which lines are included in the base fee and which are metered. |

## Install

```sh
claude mcp add stacktab -- npx -y stacktab-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stacktab": { "command": "npx", "args": ["-y", "stacktab-mcp"] }
  }
}
```

`stacktab-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
