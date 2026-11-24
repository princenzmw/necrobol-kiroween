export interface CobolSample {
  id: string;
  title: string;
  era: string;
  summary: string;
  source: string;
}

export const COBOL_SAMPLES: CobolSample[] = [
  {
    id: 'bank-y2k-1994',
    title: 'BANK-Y2K-1994 (Maturity Rollover Bug)',
    era: '1994 Mainframe Batch',
    summary: 'Demonstrates silent 2-digit Y2K year rollover (99 + 2 = 01), unguarded overflow, and an unreachable ghost paragraph.',
    source: `000100 IDENTIFICATION DIVISION.
000200 PROGRAM-ID. BANK-Y2K-1994.
000300 DATA DIVISION.
000400 WORKING-STORAGE SECTION.
000500 01 WS-OPEN-YEAR    PIC 99     VALUE 99.
000600 01 WS-TERM-YEARS   PIC 99     VALUE 2.
000700 01 WS-MATURE-YEAR  PIC 99     VALUE 0.
000800 01 WS-PRINCIPAL    PIC 9(4)   VALUE 8500.
000900 01 WS-INTEREST     PIC 9(4)   VALUE 0.
001000 01 WS-STATUS       PIC X(20)  VALUE "ACTIVE-ACCOUNT".
001100 PROCEDURE DIVISION.
001200 MAIN-BATCH.
001300     DISPLAY "=== NAIROBI TRUST MAINFRAME BATCH ===".
001400     ADD WS-OPEN-YEAR WS-TERM-YEARS GIVING WS-MATURE-YEAR.
001500     COMPUTE WS-INTEREST = WS-PRINCIPAL * 0.085.
001600     IF WS-MATURE-YEAR < WS-OPEN-YEAR
001700         MOVE "Y2K-EXPIRED-ERR" TO WS-STATUS
001800     ELSE
001900         MOVE "TERM-VALIDATED" TO WS-STATUS
002000     END-IF.
002100     DISPLAY "OPEN YEAR: 19" WS-OPEN-YEAR.
002200     DISPLAY "MATURITY YEAR: " WS-MATURE-YEAR.
002300     DISPLAY "STATUS: " WS-STATUS.
002400     DISPLAY "INTEREST CREDITED: " WS-INTEREST.
002500     STOP RUN.
002600 GHOST-AUDIT-LOG.
002700     DISPLAY "ORPHAN AUDIT TRAIL NEVER REACHED".
002800     EXIT.`,
  },
  {
    id: 'payroll-crypt-1987',
    title: 'PAYROLL-CRYPT-1987 (GO TO & Truncation)',
    era: '1987 Payroll Kernel',
    summary: 'Uses PERFORM TIMES loop, an unstructured GO TO overtime jump, and decimal-to-integer truncation.',
    source: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. PAYROLL-CRYPT-1987.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 WS-DAYS          PIC 99    VALUE 0.
       01 WS-BASE-PAY      PIC 9(4)  VALUE 420.
       01 WS-TOTAL-PAY     PIC 9(4)  VALUE 0.
       01 WS-BONUS         PIC 9(4)  VALUE 0.
       PROCEDURE DIVISION.
       PAY-DRIVER.
           PERFORM ACCUMULATE-SHIFT 3 TIMES.
           COMPUTE WS-BONUS = WS-TOTAL-PAY * 0.125.
           IF WS-DAYS > 2
               GO TO OVERTIME-GATE
           END-IF.
           DISPLAY "STANDARD PAY: " WS-TOTAL-PAY.
           STOP RUN.
       ACCUMULATE-SHIFT.
           ADD 1 TO WS-DAYS.
           ADD WS-BASE-PAY TO WS-TOTAL-PAY.
       OVERTIME-GATE.
           ADD WS-BONUS TO WS-TOTAL-PAY.
           DISPLAY "DAYS WORKED: " WS-DAYS.
           DISPLAY "BONUS TRUNCATED INT: " WS-BONUS.
           DISPLAY "FINAL PAYOUT: " WS-TOTAL-PAY.
           STOP RUN.`,
  },
  {
    id: 'inventory-1989',
    title: 'INVENTORY-1989 (Warehouse Loop)',
    era: '1989 Depot Ledger',
    summary: 'Drains warehouse stock with PERFORM UNTIL and guards restock math.',
    source: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. INVENTORY-1989.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 WS-STOCK-QTY     PIC 9(3)  VALUE 45.
       01 WS-BATCH-SIZE    PIC 99    VALUE 12.
       01 WS-ORDERS-FILLED PIC 99    VALUE 0.
       01 WS-REORDER-FLAG  PIC X(12) VALUE "OK".
       PROCEDURE DIVISION.
       WAREHOUSE-CYCLE.
           PERFORM DISPATCH-CRATE UNTIL WS-STOCK-QTY < 15.
           IF WS-STOCK-QTY < 15
               MOVE "REORDER-NOW" TO WS-REORDER-FLAG
           END-IF.
           DISPLAY "ORDERS DISPATCHED: " WS-ORDERS-FILLED.
           DISPLAY "REMAINING CRATES: " WS-STOCK-QTY.
           DISPLAY "DEPOT FLAG: " WS-REORDER-FLAG.
           STOP RUN.
       DISPATCH-CRATE.
           SUBTRACT WS-BATCH-SIZE FROM WS-STOCK-QTY.
           ADD 1 TO WS-ORDERS-FILLED.`,
  },
  {
    id: 'ledger-exorcised-2026',
    title: 'LEDGER-EXORCISED-2026 (Clean Modernized COBOL)',
    era: '2026 Exorcised Baseline',
    summary: 'Clean 4-digit year, guarded ON SIZE ERROR, full decimal precision, zero GO TO, zero ghost paragraphs (Score 0).',
    source: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. LEDGER-EXORCISED-2026.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 WS-SETTLE-YEAR   PIC 9(4)    VALUE 2026.
       01 WS-NEXT-YEAR     PIC 9(4)    VALUE 0.
       01 WS-PRINCIPAL     PIC 9(6)V99 VALUE 8500.00.
       01 WS-INTEREST      PIC 9(6)V99 VALUE 0.00.
       01 WS-STATUS        PIC X(16)   VALUE "VERIFIED-CLEAN".
       PROCEDURE DIVISION.
       CLEAN-SETTLEMENT.
           PERFORM COMPUTE-ACCRUAL.
           PERFORM PRINT-REPORT.
           STOP RUN.
       COMPUTE-ACCRUAL.
           ADD WS-SETTLE-YEAR 1 GIVING WS-NEXT-YEAR
               ON SIZE ERROR
                   MOVE "OVERFLOW-ALERT" TO WS-STATUS
           END-ADD.
           COMPUTE WS-INTEREST = WS-PRINCIPAL * 0.08
               ON SIZE ERROR
                   MOVE "OVERFLOW-ALERT" TO WS-STATUS
           END-COMPUTE.
       PRINT-REPORT.
           DISPLAY "SETTLEMENT YEAR: " WS-SETTLE-YEAR.
           DISPLAY "MATURITY YEAR: " WS-NEXT-YEAR.
           DISPLAY "EXACT INTEREST: " WS-INTEREST.
           DISPLAY "AUDIT STATUS: " WS-STATUS.`,
  },
];
