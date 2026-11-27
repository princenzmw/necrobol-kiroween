import { useMemo } from 'react';
import { Code2 } from 'lucide-react';
import type { CurseDiagnostic, PhosphorTheme } from '../engine/types';
import { PHOSPHOR_THEMES } from './theme';

interface CobolEditorProps {
  source: string;
  onChangeSource: (next: string) => void;
  activeLine: number | null;
  highlightedLine: number | null;
  curses: CurseDiagnostic[];
  programId: string;
  paragraphCount: number;
  fieldCount: number;
  theme: PhosphorTheme;
}

export function CobolEditor({
  source,
  onChangeSource,
  activeLine,
  highlightedLine,
  curses,
  programId,
  paragraphCount,
  fieldCount,
  theme,
}: CobolEditorProps) {
  const tokens = PHOSPHOR_THEMES[theme];
  const lines = useMemo(() => source.split(/\r?\n/), [source]);

  const curseByLine = useMemo(() => {
    const map = new Map<number, CurseDiagnostic>();
    for (const c of curses) {
      if (!map.has(c.line)) {
        map.set(c.line, c);
      }
    }
    return map;
  }, [curses]);

  return (
    <section className={`hardware-panel rounded-xs ${tokens.glowShadow}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2B313B] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Code2 className={`h-4 w-4 ${tokens.accentText}`} />
          <span className="font-hardware text-sm font-semibold text-zinc-100">
            Source Listing
          </span>
          <span className="rounded-xs border border-[#2B313B] bg-[#111418] px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
            {programId}.CBL
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
          <span>{lines.length} lines</span>
          <span>{fieldCount} working-storage</span>
          <span>{paragraphCount} paragraphs</span>
        </div>
      </div>

      <div className="crt-glass m-2 overflow-hidden rounded-xs border border-[#2B313B] bg-[#050907]">
        <div className="grid grid-cols-[64px_1fr] border-b border-[#1E242C] bg-[#0B0E12] font-mono text-[10px] text-zinc-400">
          <div className="border-r border-[#1E242C] px-2 py-1 text-right text-zinc-500">
            LINE
          </div>
          <div className="flex items-center gap-3 overflow-hidden px-3 py-1 whitespace-nowrap">
            <span className="text-zinc-500">SEQ 01-06</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500">IND 07</span>
            <span className="text-zinc-600">|</span>
            <span className={tokens.accentText}>AREA A 08-11</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-300">AREA B 12-72 (FIXED-FORMAT COBOL-85)</span>
          </div>
        </div>

        <div className="grid max-h-[540px] grid-cols-[64px_1fr] overflow-auto font-mono text-xs leading-6">
          <div className="select-none border-r border-[#1E242C] bg-[#0B0E12]/70 py-3 text-right">
            {lines.map((_, idx) => {
              const lineNum = idx + 1;
              const curse = curseByLine.get(lineNum);
              const isExec = activeLine === lineNum;
              const isJump = highlightedLine === lineNum;
              return (
                <div
                  key={lineNum}
                  title={curse ? `${curse.code}: ${curse.title}` : undefined}
                  className={`flex items-center justify-end gap-1.5 px-2 ${
                    isExec
                      ? `${tokens.accentBg} ${tokens.accentText} font-bold`
                      : isJump
                        ? 'bg-rose-950/65 text-rose-300 font-bold'
                        : 'text-zinc-500'
                  }`}
                >
                  {curse && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        curse.severity === 'CRITICAL'
                          ? 'bg-red-500'
                          : curse.severity === 'HIGH'
                            ? 'bg-amber-400'
                            : 'bg-violet-400'
                      }`}
                    />
                  )}
                  <span>{String(lineNum).padStart(3, '0')}</span>
                </div>
              );
            })}
          </div>

          <textarea
            aria-label="COBOL-85 source editor"
            spellCheck={false}
            value={source}
            onChange={(e) => onChangeSource(e.target.value)}
            rows={Math.max(22, lines.length)}
            className={`w-full resize-none bg-transparent p-3 font-mono text-xs leading-6 ${tokens.accentText} focus:outline-none`}
          />
        </div>
      </div>
    </section>
  );
}
