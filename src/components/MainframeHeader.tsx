import { BookOpen, Cpu, Monitor, Play, RotateCcw, Sparkles, StepForward } from 'lucide-react';
import { COBOL_SAMPLES } from '../engine/samples';
import type { PhosphorTheme } from '../engine/types';
import { PHOSPHOR_THEMES } from './theme';

interface MainframeHeaderProps {
  selectedSampleId: string;
  onSelectSample: (sampleId: string) => void;
  theme: PhosphorTheme;
  onChangeTheme: (theme: PhosphorTheme) => void;
  scanlines: boolean;
  onToggleScanlines: () => void;
  onReset: () => void;
  onExecute: () => void;
  onStep: () => void;
  onExorciseAndModernize: () => void;
  onOpenKiroModal: () => void;
}

export function MainframeHeader({
  selectedSampleId,
  onSelectSample,
  theme,
  onChangeTheme,
  scanlines,
  onToggleScanlines,
  onReset,
  onExecute,
  onStep,
  onExorciseAndModernize,
  onOpenKiroModal,
}: MainframeHeaderProps) {
  const tokens = PHOSPHOR_THEMES[theme];

  return (
    <header className={`border-b ${tokens.accentBorder} bg-zinc-950`}>
      <div className="mx-auto max-w-[1440px] px-4 py-3.5 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded border ${tokens.accentBorder} ${tokens.accentBg} font-mono text-xs font-bold ${tokens.accentText}`}
            >
              3270
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`font-mono text-base font-bold tracking-wider ${tokens.accentText}`}>
                  NECROBOL // RESURRECTION WORKBENCH
                </h1>
                <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                  COBOL-85
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Browser-native mainframe debugger, legacy curse exorcist, and deterministic TypeScript/Python modernizer
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select legacy COBOL archive"
              value={selectedSampleId}
              onChange={(e) => onSelectSample(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
            >
              {COBOL_SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>

            <div className="flex rounded border border-zinc-800 bg-zinc-900 p-0.5">
              {(Object.keys(PHOSPHOR_THEMES) as PhosphorTheme[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChangeTheme(key)}
                  className={`cursor-pointer rounded px-2 py-1 font-mono text-[11px] transition ${
                    theme === key
                      ? `${PHOSPHOR_THEMES[key].buttonSolid} font-semibold`
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {PHOSPHOR_THEMES[key].label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleScanlines}
              className={`inline-flex cursor-pointer items-center gap-1 rounded border px-2.5 py-1.5 font-mono text-xs transition ${
                scanlines
                  ? `${tokens.accentBorder} ${tokens.accentBg} ${tokens.accentText}`
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              CRT
            </button>

            <button
              type="button"
              onClick={onOpenKiroModal}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-violet-700/70 bg-violet-950/40 px-2.5 py-1.5 font-mono text-xs text-violet-200 transition hover:bg-violet-900/50"
            >
              <BookOpen className="h-3.5 w-3.5" />
              .kiro Specs &amp; MCP
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/90 pt-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
            <Cpu className="h-3.5 w-3.5" />
            <span>IBM 3270 PF KEYS:</span>
            <span className="text-zinc-400">PF3 Reset · PF5 Execute · PF8 Step · PF9 Exorcise &amp; Parity</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-300 hover:bg-zinc-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              PF3 Reset
            </button>
            <button
              type="button"
              onClick={onStep}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-200 hover:bg-zinc-800"
            >
              <StepForward className="h-3.5 w-3.5" />
              PF8 Step
            </button>
            <button
              type="button"
              onClick={onExorciseAndModernize}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-rose-700/70 bg-rose-950/40 px-2.5 py-1 font-mono text-xs text-rose-200 hover:bg-rose-900/50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              PF9 Exorcise &amp; Transpile
            </button>
            <button
              type="button"
              onClick={onExecute}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 font-mono text-xs font-bold transition ${tokens.buttonSolid}`}
            >
              <Play className="h-3.5 w-3.5" />
              PF5 Execute Batch
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
