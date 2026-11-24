# Requirements: Kiro MCP Mainframe Bridge

## User Stories
- As a developer inside Kiro IDE, I want an MCP server exposing NecroBOL's COBOL analyzer, time-travel executor, and modernizer directly to AI coding agents over stdio JSON-RPC 2.0.

## Acceptance Criteria
1. Implement JSON-RPC 2.0 `initialize`, `notifications/initialized`, `tools/list`, and `tools/call` over standard input/output without polluting stdout with debug logs.
2. Expose four tools: `list_legacy_samples`, `analyze_cobol`, `execute_cobol`, and `transpile_cobol`.
3. Reuse the exact same `src/engine/` bundle via `npm run build:mcp` so IDE results match browser results identically.
