# skillworks-mcp

`skillworks-mcp` is the MCP server for [SkillWorks](https://skillworks.thecompound.tech), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/skillworks`

## Tool

| Tool | Answers |
| --- | --- |
| `search_agent_skills(q, kind?, limit?)` | Published Claude Code skills, plugins and marketplaces, ranked by installs. Returns the install command for each result. |

## Install

```sh
claude mcp add skillworks -- npx -y skillworks-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "skillworks": { "command": "npx", "args": ["-y", "skillworks-mcp"] }
  }
}
```

`skillworks-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
