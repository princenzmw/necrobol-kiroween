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
    <section className={`rounded-xl border ${tokens.accentBorder} bg-zinc-950 ${tokens.glowShadow}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Code2 className={`h-4 w-4 ${tokens.accentText}`} />
          <span className="font-mono text-xs font-semibold text-zinc-100">
            SOURCE // {programId}.CBL
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
          <span>{lines.length} lines</span>
          <span>{fieldCount} WORKING-STORAGE</span>
          <span>{paragraphCount} paragraphs</span>
        </div>
      </div>

      <div className="grid max-h-[520px] grid-cols-[64px_1fr] overflow-auto bg-zinc-950 font-mono text-xs leading-6">
        <div className="select-none border-r border-zinc-800/80 bg-zinc-900/50 py-3 text-right">
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
                      ? 'bg-rose-950/60 text-rose-300 font-bold'
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
    </section>
  );
}
