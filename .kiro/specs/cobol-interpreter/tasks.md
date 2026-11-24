# Tasks: COBOL-85 Lexer, Parser & Interpreter

- [x] Define core AST, `PicSpec`, execution trace, and diagnostic types in `src/engine/types.ts`
- [x] Implement sequence-number stripping and token scanner in `src/engine/lexer.ts`
- [x] Implement recursive COBOL-85 division/paragraph/statement parser in `src/engine/parser.ts`
- [x] Implement `applyPicConstraint`, `ON SIZE ERROR`, control flow, and `ExecutionStep[]` recorder in `src/engine/interpreter.ts`
- [x] Create 4 runnable archival COBOL sample programs in `src/engine/samples.ts`
- [x] Add automated unit tests in `src/engine/__tests__/interpreter.test.ts`
