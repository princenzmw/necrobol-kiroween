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
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {transpiled.parity.passed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-400" />
            )}
            <div>
              <h2 className="font-mono text-sm font-bold text-zinc-100">
                BYTE-FOR-BYTE PARITY PROOF
              </h2>
              <p className="text-xs text-zinc-400">
                Compares COBOL-85 runtime stdout against independent modern TypeScript execution
              </p>
            </div>
          </div>

          <span
            className={`rounded border px-2.5 py-1 font-mono text-xs font-bold ${
              transpiled.parity.passed
                ? 'border-emerald-700 bg-emerald-950/60 text-emerald-300'
                : 'border-rose-700 bg-rose-950/60 text-rose-300'
            }`}
          >
            {transpiled.parity.matchPct}% MATCH ({transpiled.parity.lineDiffs.length} lines)
          </span>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-black/70">
          <table className="w-full text-left font-mono text-[11px]">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="px-3 py-1.5">#</th>
                <th className="px-3 py-1.5">COBOL-85 STDOUT</th>
                <th className="px-3 py-1.5">MODERN TS STDOUT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
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

      <section className="rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <FileCode2 className={`h-4 w-4 ${tokens.accentText}`} />
            {(['typescript', 'python', 'vitest'] as CodeTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`cursor-pointer rounded px-2.5 py-1 font-mono text-xs transition ${
                  tab === t
                    ? `${tokens.buttonSolid} font-semibold`
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
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
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-200 hover:bg-zinc-800"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-200 hover:bg-zinc-800"
            >
              <Download className="h-3.5 w-3.5" />
              Download .{ext}
            </button>
          </div>
        </div>

        <pre className="max-h-[420px] overflow-auto bg-black/75 p-4 font-mono text-xs leading-5 text-zinc-200">
          {activeCode}
        </pre>
      </section>
    </div>
  );
}
