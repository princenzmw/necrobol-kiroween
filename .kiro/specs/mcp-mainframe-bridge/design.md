# Design: Stdio MCP Server

- `vite.mcp.config.ts` compiles `src/engine/index.ts` as an ESM library (`mcp-server/engine-bundle.mjs`).
- `mcp-server/server.mjs` reads newline-delimited JSON-RPC 2.0 messages on `process.stdin`, validates tool parameters, runs the engine functions, and writes structured JSON-RPC 2.0 responses (`content: [{ type: 'text', text }]`) to `process.stdout`.
- Registered in `.kiro/settings/mcp.json` under `necrobol-mainframe`.
