# scriptprobe-mcp

`scriptprobe-mcp` is the MCP server for [ScriptProbe](https://scriptprobe.thecompound.tech), from [Compound Labs](https://thecompound.tech). It needs no API key and no signup.

`mcp-name: tech.thecompound/scriptprobe`

## Tool

| Tool | Answers |
| --- | --- |
| `check_package_scripts(name, version?)` | The install-time scripts an npm package runs, whether each one reaches the network or spawns a process, and whether the account that published the latest version differs from the previous ten. Run it before `npm install` on a package you have not used. |

A high verdict means you should read the script. It does not prove the package is malware. esbuild reads high because its postinstall downloads a platform binary.

## Install

```sh
claude mcp add scriptprobe -- npx -y scriptprobe-mcp
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "scriptprobe": { "command": "npx", "args": ["-y", "scriptprobe-mcp"] }
  }
}
```

`scriptprobe-mcp --http 8974` serves streamable HTTP on `http://127.0.0.1:8974/mcp`.

## License

MIT
