# blockdex-mcp

`blockdex-mcp` is the MCP server for [BlockDex](https://blockdex.thecompound.tech), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/blockdex`

## Tool

| Tool | Answers |
| --- | --- |
| `search_component_registries(q, kind?, access?, limit?)` | shadcn-compatible components, blocks and hooks across dozens of public registries, with the dependencies each one pulls in. |

## Install

```sh
claude mcp add blockdex -- npx -y blockdex-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "blockdex": { "command": "npx", "args": ["-y", "blockdex-mcp"] }
  }
}
```

`blockdex-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
