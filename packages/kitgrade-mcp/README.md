# kitgrade-mcp

`kitgrade-mcp` is the MCP server for [KitGrade](https://kitgrade.thecompound.tech), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/kitgrade`

## Tool

| Tool | Answers |
| --- | --- |
| `grade_starter_kit(q?, limit?)` | Starter kits and boilerplates, graded by installing them: what is actually wired up versus what only appears in the README. |

## Install

```sh
claude mcp add kitgrade -- npx -y kitgrade-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kitgrade": { "command": "npx", "args": ["-y", "kitgrade-mcp"] }
  }
}
```

`kitgrade-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
