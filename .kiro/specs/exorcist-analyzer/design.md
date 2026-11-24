# Design: Exorcist Analyzer & Call Graph

## Static Analysis Passes
1. **Storage Pass:** Scans `dataItems` for 2-digit year fields (`YEAR|YR|YY` with `intDigits <= 2`) -> `CURSE-Y2K`.
2. **Statement Pass:** Flags `ALTER` (`CRITICAL`), `GO TO` (`HIGH`), unguarded `ADD`/`MULTIPLY`/`COMPUTE` missing `ON SIZE ERROR` (`MEDIUM`), and precision/width narrowing on `MOVE` or `COMPUTE` (`HIGH`).
3. **Graph Reachability Pass:** Runs BFS starting from `paragraphs[0]` across `PERFORM` and `GO TO` targets plus linear fall-through where no terminating transfer (`STOP RUN` or unconditional `GO TO`) precedes the next paragraph; unvisited paragraphs become `ghostParagraphs` (`CURSE-GHOST-PARA`).
