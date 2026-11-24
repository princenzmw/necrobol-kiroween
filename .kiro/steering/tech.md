---
inclusion: always
---

# Technical Steering: Architecture & Constraints

## Stack
- **Frontend:** React 19, TypeScript (strict `erasableSyntaxOnly`, no `enum`), Tailwind CSS v4, Vite, Lucide icons.
- **Engine (`src/engine/`):** Pure TypeScript with zero DOM or Node dependencies so identical code powers both browser execution and `mcp-server/server.mjs`.
- **Testing & Quality:** Vitest (`npm run test`), `tsc -b` + `tsc --noEmit`, `oxlint` (`npm run lint`).
- **MCP Bridge (`mcp-server/server.mjs`):** Dependency-free Node ESM stdio JSON-RPC 2.0 server consuming a built engine bundle (`npm run build:mcp`).

## Security & Determinism Boundaries
- Never execute user-supplied strings with `eval()`, `new Function()`, DOM injection, or shell spawning.
- Modern parity execution must run via a sandboxed deterministic interpreter/evaluator operating strictly on parsed AST nodes and isolated variable maps with an explicit `maxSteps = 2000` loop guard.
- Keep `src/engine/` modules deterministic, single-purpose, and covered by unit + stdio MCP integration tests.
