# stillshipping-mcp

`stillshipping-mcp` is the MCP server for [StillShipping](https://stillshipping.thecompound.tech), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/stillshipping`

## Tool

| Tool | Answers |
| --- | --- |
| `check_project_maintenance(q?, limit?)` | Whether a developer tool is still shipping: last release, last commit, whether it reads as dead. Run it before recommending a dependency. |

## Install

```sh
claude mcp add stillshipping -- npx -y stillshipping-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stillshipping": { "command": "npx", "args": ["-y", "stillshipping-mcp"] }
  }
}
```

`stillshipping-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
