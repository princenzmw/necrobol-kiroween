# Requirements: Legacy Curse Exorcist Static Analyzer

## User Stories
- As a modernization lead, I want automated detection of Y2K date hazards, `GO TO` spaghetti jumps, unreachable ghost paragraphs, `ALTER` mutations, numeric overflow risks, and decimal precision loss.
- As a visual reviewer, I want an interactive paragraph call graph showing `PERFORM` edges, `GO TO` jumps, and unreachable ghost paragraphs, plus clickable diagnostics that jump straight to the offending COBOL line.

## Acceptance Criteria
1. Compute deterministic diagnostics covering `CURSE-Y2K`, `CURSE-ALTER`, `CURSE-GOTO`, `CURSE-GHOST-PARA`, `CURSE-OVERFLOW`, and `CURSE-PRECISION`.
2. Build directed paragraph control-flow graph (`edges`) and compute `reachableParagraphs` and `ghostParagraphs` via reachability from the entry paragraph.
3. Score programs from `0` to `100` (`EXORCISED`, `MILDLY HAUNTED`, `CURSED`, `POSSESSED`) with concrete remediation hints per finding.
