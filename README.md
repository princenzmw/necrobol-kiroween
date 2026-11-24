# NecroBOL: COBOL-85 Resurrection & 3270 Exorcist Workbench

Built for **Kiroween 2026 (Resurrection Category)** with full Kiro `.kiro/` spec-driven development, persistent steering documents, automated save hooks, and a stdio Model Context Protocol (MCP) server.

**Live Workbench:** [https://necrobol-kiroween-2026.web.app](https://necrobol-kiroween-2026.web.app)

NecroBOL brings 1980s mainframe COBOL batch kernels back to life inside an authentic IBM 3270 phosphor workbench running natively in the browser and exposed directly to AI agents via MCP.

---

## Resurrection Architecture

```text
[COBOL-85 Source (.CBL)]
        |
        +---> [Lexer & AST Parser] (strips cols 1-6 seq numbers, parses PIC & PROCEDURE DIVISION)
        |
        +---> [3270 Time-Travel Interpreter] (fixed-point PIC wrapping, ON SIZE ERROR, ExecutionStep[])
        |
        +---> [Exorcist Static Analyzer] (Y2K rollover, GO TO, ALTER, overflow, precision, ghost graph)
        |
        +---> [Deterministic Modernizer] (TypeScript + Python 3 + Vitest parity proof, zero eval())
        |
        +---> [Kiro MCP Server] (stdio JSON-RPC 2.0 sharing compiled src/engine/ bundle)
```

---

## Kiro `.kiro/` Workflow Integration
Every feature in this repository was specified, steered, and verified inside `.kiro/`:
- **Steering (`.kiro/steering/`):** `product.md`, `tech.md`, and `structure.md` enforce zero-mock engine semantics, zero `eval()`, strict TypeScript boundaries, and IBM 3270 UX.
- **Specs (`.kiro/specs/`):** Separate `requirements.md`, `design.md`, and `tasks.md` specs for `cobol-interpreter`, `exorcist-analyzer`, `modernizer-transpiler`, and `mcp-mainframe-bridge`.
- **Agent Hooks (`.kiro/hooks/`):** PostFileSave triggers automatically run engine tests, rebuild & test the MCP stdio bridge, and run `tsc --noEmit && npm run lint`.
- **MCP Config (`.kiro/settings/mcp.json`):** Registers `necrobol-mainframe` (`node mcp-server/server.mjs`) exposing `list_legacy_samples`, `analyze_cobol`, `execute_cobol`, and `transpile_cobol`.

---

## Local Development & Verification

```bash
npm install
npm run build:mcp
npm run test
npx tsc --noEmit
npm run lint
npm run build
```

### Run the MCP Server Directly
```bash
npm run build:mcp
node mcp-server/server.mjs
```

---

## License
MIT License - see [LICENSE](LICENSE).
