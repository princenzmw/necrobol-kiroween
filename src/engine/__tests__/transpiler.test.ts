import { describe, expect, it } from 'vitest';
import { COBOL_SAMPLES } from '../samples';
import { transpileCobolSource } from '../transpiler';

describe('NecroBOL deterministic modernizer & parity proof', () => {
  it('achieves 100% byte-for-byte stdout parity across all archival COBOL samples', () => {
    for (const sample of COBOL_SAMPLES) {
      const result = transpileCobolSource(sample.source);
      expect(result.parity.passed, `Parity failed for ${sample.id}`).toBe(true);
      expect(result.parity.matchPct).toBe(100);
      expect(result.parity.cobolOutput.length).toBeGreaterThan(0);
      expect(result.typescriptCode).toContain('export function run');
      expect(result.pythonCode).toContain('def run_');
      expect(result.vitestSnippet).toContain('describe(');
    }
  });
});
