# goodstanding-mcp

`goodstanding-mcp` is the MCP server for [GoodStanding](https://goodstanding.thecompound.tech), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/goodstanding`

## Tool

| Tool | Answers |
| --- | --- |
| `lookup_nonprofit_status(ein)` | Whether a US nonprofit's EIN is on the IRS auto-revocation list or the California Registry of Charities delinquency and suspension lists. Returns revocation and reinstatement dates, whether the 15-month streamlined reinstatement window is still open, and whether AB 488 requires fundraising platforms to block donations. |

A `clear: true` result means the EIN is on none of the tracked lists. Every answer carries a `checked` receipt that records when the lookup ran, which lists it read, and what those lists cover.

## Install

```sh
claude mcp add goodstanding -- npx -y goodstanding-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "goodstanding": { "command": "npx", "args": ["-y", "goodstanding-mcp"] }
  }
}
```

`goodstanding-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
