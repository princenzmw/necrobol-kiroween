---
inclusion: always
---

# Workspace Structure

```text
necrobol-kiroween/
├── .kiro/
│   ├── hooks/          # Automated PostFileSave verification hooks
│   ├── settings/       # MCP server definition (mcp.json)
│   ├── specs/          # Spec-driven requirements, design, and task breakdowns
│   └── steering/       # Persistent Kiro product, tech, and layout context
├── mcp-server/         # Stdio JSON-RPC 2.0 MCP server + compiled engine bundle
├── src/
│   ├── engine/         # Pure COBOL-85 lexer, parser, interpreter, exorcist, transpiler, samples
│   └── components/     # 3270 terminal debugger, editor, call graph, parity UI, Kiro inspector
├── index.html
├── package.json
└── firebase.json
```

Keep pure compiler/runtime code inside `src/engine/` and UI rendering inside `src/components/`.
