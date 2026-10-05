# civicbinder-mcp

`civicbinder-mcp` is the MCP server for [CivicBinder](https://civicbinder.org), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/civicbinder`

## Tool

| Tool | Answers |
| --- | --- |
| `lookup_ada_report(domain)` | The CivicBinder Municipal Web Accessibility Index entry for a US local-government domain: the A–F grade against WCAG 2.1 AA, violation counts (total, serious, critical), the top failing rules, the ADA Title II deadline, and the public report page. |

The index applies the April 26, 2027 ADA Title II deadline to communities of 50,000 or more and the April 26, 2028 deadline to smaller communities and special districts. Every answer carries a `checked` receipt that records when the lookup ran, which index it read, and what that index covers.

## Install

```sh
claude mcp add civicbinder -- npx -y civicbinder-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "civicbinder": { "command": "npx", "args": ["-y", "civicbinder-mcp"] }
  }
}
```

`civicbinder-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
