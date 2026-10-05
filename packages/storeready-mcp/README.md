# storeready-mcp

`storeready-mcp` is the MCP server for [StoreReady](https://storeready.thecompound.tech), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/storeready`

## Tool

| Tool | Answers |
| --- | --- |
| `compare_app_builders(builder?, verdict?, limit?)` | Whether the app an AI mobile-app builder hands you clears Apple App Store review: what it outputs, whether you can export the source, who submits the binary, and which guidelines are in play. Every verdict carries the source that settles it and the date it was read. An unsettled question comes back `unknown`. |

## Install

```sh
claude mcp add storeready -- npx -y storeready-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "storeready": { "command": "npx", "args": ["-y", "storeready-mcp"] }
  }
}
```

`storeready-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
