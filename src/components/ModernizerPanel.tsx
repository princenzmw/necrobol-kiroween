import { useState } from 'react';
import { Check, CheckCircle2, Copy, Download, FileCode2, XCircle } from 'lucide-react';
import type { PhosphorTheme, TranspileResult } from '../engine/types';
import { PHOSPHOR_THEMES } from './theme';

interface ModernizerPanelProps {
  transpiled: TranspileResult;
  theme: PhosphorTheme;
}

type CodeTab = 'typescript' | 'python' | 'vitest';

export function ModernizerPanel({ transpiled, theme }: ModernizerPanelProps) {
  const tokens = PHOSPHOR_THEMES[theme];
  const [tab, setTab] = useState<CodeTab>('typescript');
  const [copied, setCopied] = useState(false);

  const activeCode =
    tab === 'typescript'
      ? transpiled.typescriptCode
      : tab === 'python'
        ? transpiled.pythonCode
        : transpiled.vitestSnippet;

  const ext = tab === 'python' ? 'py' : tab === 'vitest' ? 'test.ts' : 'ts';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable in non-secure contexts.
    }
  }

  function handleDownload() {
    const slug = transpiled.programId.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const blob = new Blob([activeCode], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <section className="hardware-panel rounded-xs p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {transpiled.parity.passed ? (
              <CheckCircle2 className="h-5 w-5 text-[#34F585]" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-400" />
            )}
            <div>
              <h2 className="font-hardware text-sm font-bold text-zinc-100">
                Byte-for-Byte Parity Proof
              </h2>
              <p className="text-xs text-zinc-400">
                Compares COBOL-85 runtime stdout against independent modern TypeScript execution
              </p>
            </div>
          </div>

          <span
            className={`rounded-xs border px-2.5 py-1 font-mono text-xs font-bold ${
              transpiled.parity.passed
                ? 'border-emerald-700 bg-[#04130B] text-[#34F585]'
                : 'border-rose-700 bg-rose-950/60 text-rose-300'
            }`}
          >
            {transpiled.parity.matchPct}% MATCH ({transpiled.parity.lineDiffs.length} lines)
          </span>
        </div>

        <div className="crt-glass mt-3 overflow-x-auto rounded-xs border border-[#2B313B] bg-[#050907]">
          <table className="w-full text-left font-mono text-[11px]">
            <thead>
              <tr className="border-b border-[#1E242C] text-zinc-400">
                <th className="px-3 py-1.5">#</th>
                <th className="px-3 py-1.5">COBOL-85 STDOUT</th>
                <th className="px-3 py-1.5">MODERN TS STDOUT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151A22]">
              {transpiled.parity.lineDiffs.map((row) => (
                <tr key={row.lineIndex}>
                  <td className="px-3 py-1.5 text-zinc-500">{row.lineIndex}</td>
                  <td className="px-3 py-1.5 text-zinc-200">{row.cobolLine ?? '(missing)'}</td>
                  <td className={`px-3 py-1.5 ${row.matches ? tokens.accentText : 'text-rose-300'}`}>
                    {row.modernLine ?? '(missing)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="hardware-panel rounded-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2B313B] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <FileCode2 className={`h-4 w-4 ${tokens.accentText}`} />
            {(['typescript', 'python', 'vitest'] as CodeTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`cursor-pointer rounded-xs px-2.5 py-1 font-mono text-xs transition ${
                  tab === t
                    ? `${tokens.buttonSolid} font-semibold`
                    : 'text-zinc-400 hover:bg-[#111418] hover:text-zinc-100'
                }`}
              >
                {t === 'typescript' ? 'TypeScript' : t === 'python' ? 'Python 3' : 'Vitest Parity'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="pf-keycap inline-flex cursor-pointer items-center gap-1 rounded-xs border border-[#38404D] bg-[#222730] px-2.5 py-1 font-mono text-xs text-zinc-200 hover:bg-[#2A303B]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[#34F585]" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="pf-keycap inline-flex cursor-pointer items-center gap-1 rounded-xs border border-[#38404D] bg-[#222730] px-2.5 py-1 font-mono text-xs text-zinc-200 hover:bg-[#2A303B]"
            >
              <Download className="h-3.5 w-3.5" />
              Download .{ext}
            </button>
          </div>
        </div>

        <pre className="crt-glass m-2 max-h-[420px] overflow-auto rounded-xs border border-[#2B313B] bg-[#050907] p-4 font-mono text-xs leading-5 text-zinc-200">
          {activeCode}
        </pre>
      </section>
    </div>
  );
}
