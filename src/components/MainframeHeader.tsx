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
    <header className="border-b border-[#2B313B] bg-[#191D23] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="mx-auto max-w-[1440px] px-4 py-3.5 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-xs border ${tokens.accentBorder} ${tokens.crtWellBg} font-mono text-xs font-bold ${tokens.accentText} ${tokens.textGlow}`}
            >
              3270
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className={`font-hardware text-xl font-bold tracking-wide text-zinc-100`}>
                  NECROBOL
                </h1>
                <span className={`rounded-xs border ${tokens.accentBorder} ${tokens.crtWellBg} px-2 py-0.5 font-mono text-[11px] font-medium ${tokens.accentText}`}>
                  IBM 3270 / COBOL-85
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Mainframe debugger, legacy hazard audit, and deterministic TypeScript/Python modernizer
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select legacy COBOL archive"
              value={selectedSampleId}
              onChange={(e) => onSelectSample(e.target.value)}
              className="rounded-xs border border-[#2B313B] bg-[#0B0E12] px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none"
            >
              {COBOL_SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>

            <div className="flex divide-x divide-[#2B313B] overflow-hidden rounded-xs border border-[#2B313B] bg-[#111418]">
              {(Object.keys(PHOSPHOR_THEMES) as PhosphorTheme[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChangeTheme(key)}
                  className={`cursor-pointer px-2.5 py-1.5 font-mono text-[11px] transition ${
                    theme === key
                      ? `${PHOSPHOR_THEMES[key].buttonSolid} font-semibold`
                      : 'text-zinc-400 hover:bg-[#1E232B] hover:text-zinc-100'
                  }`}
                >
                  {PHOSPHOR_THEMES[key].label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleScanlines}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xs border px-2.5 py-1.5 font-mono text-xs transition ${
                scanlines
                  ? `${tokens.accentBorder} ${tokens.crtWellBg} ${tokens.accentText}`
                  : 'border-[#2B313B] bg-[#111418] text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              CRT
            </button>

            <button
              type="button"
              onClick={onOpenKiroModal}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xs border border-violet-500/50 bg-[#1B1329] px-2.5 py-1.5 font-mono text-xs text-violet-200 transition hover:bg-violet-950/80"
            >
              <BookOpen className="h-3.5 w-3.5" />
              .kiro Specs &amp; MCP
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#2B313B] pt-2.5">
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
            <Cpu className={`h-3.5 w-3.5 ${tokens.accentText}`} />
            <span className="font-hardware font-semibold text-zinc-300">Program Function Deck</span>
            <span className="text-zinc-500">F3 Reset / F5 Execute / F8 Step / F9 Exorcise</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="pf-keycap inline-flex cursor-pointer items-center gap-1.5 rounded-xs border border-[#38404D] bg-[#222730] px-2.5 py-1 font-mono text-xs text-zinc-200 transition hover:bg-[#2A303B] active:translate-y-px"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              PF3 Reset
            </button>
            <button
              type="button"
              onClick={onStep}
              className="pf-keycap inline-flex cursor-pointer items-center gap-1.5 rounded-xs border border-[#38404D] bg-[#222730] px-2.5 py-1 font-mono text-xs text-zinc-100 transition hover:bg-[#2A303B] active:translate-y-px"
            >
              <StepForward className="h-3.5 w-3.5" />
              PF8 Step
            </button>
            <button
              type="button"
              onClick={onExorciseAndModernize}
              className="pf-keycap inline-flex cursor-pointer items-center gap-1.5 rounded-xs border border-rose-500/55 bg-[#2A151B] px-2.5 py-1 font-mono text-xs text-rose-200 transition hover:bg-rose-950/75 active:translate-y-px"
            >
              <Sparkles className="h-3.5 w-3.5 text-rose-400" />
              PF9 Exorcise &amp; Transpile
            </button>
            <button
              type="button"
              onClick={onExecute}
              className={`pf-keycap inline-flex cursor-pointer items-center gap-1.5 rounded-xs border border-black/30 px-3 py-1 font-mono text-xs font-bold transition active:translate-y-px ${tokens.buttonSolid}`}
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
