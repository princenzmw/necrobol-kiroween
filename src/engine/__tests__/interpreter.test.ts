import { describe, expect, it } from 'vitest';
import { executeCobolSource } from '../interpreter';
import { COBOL_SAMPLES } from '../samples';

describe('COBOL-85 interpreter & time-travel trace', () => {
  it('reproduces Y2K 2-digit year rollover and fractional rounding on BANK-Y2K-1994', () => {
    const res = executeCobolSource(COBOL_SAMPLES[0].source);
    expect(res.haltedReason).toBe('STOP_RUN');
    expect(res.parseErrors).toHaveLength(0);
    expect(res.output).toEqual([
      '=== NAIROBI TRUST MAINFRAME BATCH ===',
      'OPEN YEAR: 1999',
      'MATURITY YEAR: 01',
      'STATUS: Y2K-EXPIRED-ERR',
      'INTEREST CREDITED: 0723',
    ]);
    expect(res.warnings.length).toBeGreaterThanOrEqual(1);
    expect(res.steps.length).toBeGreaterThan(5);
  });

  it('executes PERFORM N TIMES and GO TO transfer in PAYROLL-CRYPT-1987', () => {
    const res = executeCobolSource(COBOL_SAMPLES[1].source);
    expect(res.haltedReason).toBe('STOP_RUN');
    expect(res.output).toEqual([
      'DAYS WORKED: 03',
      'BONUS TRUNCATED INT: 0158',
      'FINAL PAYOUT: 1418',
    ]);
  });

  it('executes PERFORM UNTIL loop cleanly on INVENTORY-1989', () => {
    const res = executeCobolSource(COBOL_SAMPLES[2].source);
    expect(res.haltedReason).toBe('STOP_RUN');
    expect(res.output).toEqual([
      'ORDERS DISPATCHED: 03',
      'REMAINING CRATES: 009',
      'DEPOT FLAG: REORDER-NOW',
    ]);
  });

  it('triggers ON SIZE ERROR handler instead of silent wrap when guarded', () => {
    const src = `
      IDENTIFICATION DIVISION.
      PROGRAM-ID. SIZE-GUARD.
      DATA DIVISION.
      WORKING-STORAGE SECTION.
      01 WS-VAL PIC 99 VALUE 95.
      01 WS-ERR PIC X(10) VALUE "OK".
      PROCEDURE DIVISION.
      MAIN-RUN.
          ADD 10 TO WS-VAL
              ON SIZE ERROR
                  MOVE "OVERFLOW" TO WS-ERR
          END-ADD.
          DISPLAY WS-ERR.
          DISPLAY WS-VAL.
          STOP RUN.
    `;
    const res = executeCobolSource(src);
    expect(res.output).toEqual(['OVERFLOW', '95']);
  });
});
