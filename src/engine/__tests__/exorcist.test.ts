import { describe, expect, it } from 'vitest';
import { analyzeCobolSource } from '../exorcist';
import { COBOL_SAMPLES } from '../samples';

describe('NecroBOL Exorcist static analyzer', () => {
  it('detects Y2K year wrap, precision loss, overflow risk, and ghost paragraph in BANK-Y2K-1994', () => {
    const report = analyzeCobolSource(COBOL_SAMPLES[0].source);
    const codes = new Set(report.curses.map((c) => c.code));

    expect(report.hauntingScore).toBeGreaterThan(40);
    expect(codes.has('CURSE-Y2K')).toBe(true);
    expect(codes.has('CURSE-PRECISION')).toBe(true);
    expect(codes.has('CURSE-OVERFLOW')).toBe(true);
    expect(codes.has('CURSE-GHOST-PARA')).toBe(true);
    expect(report.ghostParagraphs).toEqual(['GHOST-AUDIT-LOG']);
  });

  it('detects unstructured GO TO in PAYROLL-CRYPT-1987', () => {
    const report = analyzeCobolSource(COBOL_SAMPLES[1].source);
    expect(report.curses.some((c) => c.code === 'CURSE-GOTO')).toBe(true);
    expect(report.edges.some((e) => e.kind === 'GOTO' && e.to === 'OVERTIME-GATE')).toBe(true);
  });

  it('detects self-modifying ALTER as CRITICAL severity', () => {
    const src = `
      IDENTIFICATION DIVISION.
      PROGRAM-ID. ALTER-HAUNT.
      PROCEDURE DIVISION.
      START-NODE.
          ALTER JUMP-NODE TO PROCEED TO SAFE-NODE.
          GO TO JUMP-NODE.
      JUMP-NODE.
          STOP RUN.
      SAFE-NODE.
          DISPLAY "REDIRECTED".
          STOP RUN.
    `;
    const report = analyzeCobolSource(src);
    const alterCurse = report.curses.find((c) => c.code === 'CURSE-ALTER');
    expect(alterCurse?.severity).toBe('CRITICAL');
  });

  it('gives EXORCISED grade (score 0) to clean LEDGER-EXORCISED-2026', () => {
    const report = analyzeCobolSource(COBOL_SAMPLES[3].source);
    expect(report.hauntingScore).toBe(0);
    expect(report.grade).toBe('EXORCISED');
    expect(report.curses).toHaveLength(0);
    expect(report.ghostParagraphs).toHaveLength(0);
  });
});
