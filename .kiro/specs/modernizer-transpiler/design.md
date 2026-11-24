# Design: Modernizer Transpiler & Parity Verifier

## Deterministic Code Generation
- Translates parsed `WORKING-STORAGE` into typed state objects initialized with COBOL values.
- Emits structured functions per paragraph with explicit `applyPic(...)` helper calls so numeric widths remain faithful during migration, annotated with `// CURSE CHECK` comments where legacy hazards exist.
- `verifyParity(source)` compares line-by-line stdout arrays from `executeCobolSource(source)` and an independent pure TypeScript statement runner, producing `matchPct` (`0` to `100`) and structured `lineDiffs`.
