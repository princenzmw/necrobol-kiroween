# Design: COBOL-85 Engine

## Data Flow
`source: string` -> `tokenizeCobol(source)` -> `parseCobol(tokens)` -> `executeCobolProgram(program)`

## Fixed-Point Storage Model
- Numeric fields store exact numeric values normalized against `intDigits`, `decDigits`, and `signed`.
- Assigning a value wider than `10^intDigits` wraps modulo `10^intDigits` (reproducing authentic mainframe overflow and Y2K 2-digit date wrap) unless guarded by `ON SIZE ERROR`, and marks `truncated = true`.
- Each executed statement appends a frozen variable snapshot and stdout snapshot to `ExecutionStep[]` so the UI supports instant time-travel scrubbing (`Step k / N`).
