# Requirements: COBOL-85 Lexer, Parser & Time-Travel Interpreter

## User Stories
- As a legacy systems engineer, I want to paste fixed-format or free-format COBOL-85 code and run it directly in the browser without installing GnuCOBOL or Docker.
- As an auditor diagnosing subtle mainframe failures, I want to scrub step by step through execution (`ExecutionStep[]`) to observe which paragraph ran, which `WORKING-STORAGE` variable changed, and where fixed-point `PIC` truncation occurred.

## Acceptance Criteria
1. Strip optional 6-digit sequence numbers (cols 1-6) and fixed/free comment lines (`*` in col 7 or `*>`).
2. Parse `IDENTIFICATION DIVISION` (`PROGRAM-ID`), `DATA DIVISION` (`WORKING-STORAGE SECTION` `PIC 9/S9/X` + `VALUE`), and `PROCEDURE DIVISION` paragraphs and statements.
3. Support `DISPLAY`, `MOVE`, `ADD`, `SUBTRACT`, `MULTIPLY`, `DIVIDE`, `COMPUTE` (with optional `ON SIZE ERROR`), `IF ... ELSE ... END-IF`, `PERFORM`, `PERFORM N TIMES`, `PERFORM UNTIL`, `GO TO`, `ALTER`, `EXIT`, and `STOP RUN`.
4. Enforce declared `PIC` digit bounds (for example wrapping `99 + 2 = 01` on 2-digit Y2K year fields while recording a truncation warning) and enforce `maxSteps = 2000`.
