import { AlertTriangle, Pause, Play, RotateCcw, SkipBack, SkipForward, Terminal } from 'lucide-react';
import type { ExecutionResult, PhosphorTheme } from '../engine/types';
import { PHOSPHOR_THEMES } from './theme';

interface TerminalDebuggerProps {
  execution: ExecutionResult;
  currentStepIdx: number;
  onChangeStep: (idx: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  scanlines: boolean;
  theme: PhosphorTheme;
}

export function TerminalDebugger({
  execution,
  currentStepIdx,
  onChangeStep,
  playing,
  onTogglePlay,
  scanlines,
  theme,
}: TerminalDebuggerProps) {
  const tokens = PHOSPHOR_THEMES[theme];
  const totalSteps = execution.steps.length;
  const clampedIdx = totalSteps > 0 ? Math.max(0, Math.min(currentStepIdx, totalSteps - 1)) : 0;
  const activeStep = totalSteps > 0 ? execution.steps[clampedIdx] : null;
  const displayedOutput = activeStep ? activeStep.outputSnapshot : execution.output;
  const displayedVars = activeStep ? activeStep.variables : {};
  const changedSet = new Set(activeStep?.changedKeys ?? []);
  const activeWarnings = activeStep ? activeStep.warnings : execution.warnings;

  return (
    <div className="space-y-4">
      <section className={`hardware-panel rounded-xs p-2 ${tokens.glowShadow}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center gap-2">
            <Terminal className={`h-4 w-4 ${tokens.accentText}`} />
            <span className="font-hardware text-sm font-semibold text-zinc-100">
              IBM 3270 Display
            </span>
            <span className="rounded-xs border border-[#2B313B] bg-[#111418] px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
              {execution.programId}
            </span>
          </div>
          <span className="rounded-xs border border-[#2B313B] bg-[#111418] px-2 py-0.5 font-mono text-[11px] text-zinc-300">
            HALT: {execution.haltedReason} | STEP {totalSteps > 0 ? clampedIdx + 1 : 0}/{totalSteps}
          </span>
        </div>

        <div className={`crt-glass relative overflow-hidden rounded-xs border ${tokens.accentBorder} ${tokens.crtWellBg}`}>
          {scanlines && <div className="crt-scanlines pointer-events-none absolute inset-0 z-10" />}

          <div className="min-h-[172px] space-y-1 p-4 font-mono text-xs">
            {displayedOutput.length === 0 ? (
              <div className="text-zinc-400">READY. PRESS PF5 TO EXECUTE OR STEP THROUGH BATCH.</div>
            ) : (
              displayedOutput.map((line, idx) => (
                <div key={`${idx}-${line}`} className={`${tokens.accentText} ${tokens.textGlow} leading-5`}>
                  <span className="mr-2 select-none text-zinc-500">&gt;</span>
                  {line}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-black/50 px-4 py-1.5 font-mono text-[10px] text-zinc-400">
            <span>4-3270-DISPLAY</span>
            <span>{activeStep ? `L${activeStep.line} [${activeStep.paragraph}]` : 'IDLE'}</span>
          </div>
        </div>

        <div className="mt-2 rounded-xs border border-[#2B313B] bg-[#111418] px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChangeStep(0)}
                disabled={totalSteps === 0}
                className="pf-keycap cursor-pointer rounded-xs border border-[#38404D] bg-[#222730] p-1.5 text-zinc-200 hover:bg-[#2A303B] disabled:opacity-40"
                title="Jump to Step 1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onChangeStep(Math.max(0, clampedIdx - 1))}
                disabled={clampedIdx === 0 || totalSteps === 0}
                className="pf-keycap cursor-pointer rounded-xs border border-[#38404D] bg-[#222730] p-1.5 text-zinc-200 hover:bg-[#2A303B] disabled:opacity-40"
                title="Previous Step"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onTogglePlay}
                disabled={totalSteps === 0}
                className={`pf-keycap inline-flex cursor-pointer items-center gap-1 rounded-xs px-2.5 py-1 font-mono text-xs font-semibold ${tokens.buttonSolid} disabled:opacity-40`}
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playing ? 'Pause' : 'Replay Trace'}
              </button>
              <button
                type="button"
                onClick={() => onChangeStep(Math.min(totalSteps - 1, clampedIdx + 1))}
                disabled={clampedIdx >= totalSteps - 1 || totalSteps === 0}
                className="pf-keycap cursor-pointer rounded-xs border border-[#38404D] bg-[#222730] p-1.5 text-zinc-200 hover:bg-[#2A303B] disabled:opacity-40"
                title="Next Step"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </div>

            {activeStep && (
              <span className="truncate font-mono text-[11px] text-zinc-300">
                {activeStep.statementText}
              </span>
            )}
          </div>

          {totalSteps > 1 && (
            <input
              type="range"
              min={0}
              max={totalSteps - 1}
              value={clampedIdx}
              onChange={(e) => onChangeStep(Number(e.target.value))}
              aria-label="Time-travel debugger step scrubber"
              className="mt-2.5 w-full accent-emerald-400"
            />
          )}
        </div>
      </section>

      {activeWarnings.length > 0 && (
        <section className="rounded-xs border border-amber-600/60 border-l-4 border-l-amber-400 bg-[#1F170B] p-3 text-xs text-amber-200">
          <div className="flex items-center gap-1.5 font-hardware font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Runtime Mainframe Hazards ({activeWarnings.length})
          </div>
          <ul className="mt-1.5 space-y-1 font-mono text-[11px]">
            {activeWarnings.map((w, idx) => (
              <li key={`${idx}-${w}`}>- {w}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="hardware-panel rounded-xs p-4">
        <div className="flex items-center justify-between border-b border-[#2B313B] pb-2">
          <h2 className="font-hardware text-sm font-semibold text-zinc-100">
            Working-Storage Registers
          </h2>
          <span className="font-mono text-[11px] text-zinc-400">
            {execution.finalVariables.length} fields
          </span>
        </div>

        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#2B313B] text-[11px] text-zinc-400">
                <th className="py-1.5 pr-3">FIELD</th>
                <th className="py-1.5 pr-3">PIC</th>
                <th className="py-1.5">VALUE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232933]">
              {execution.finalVariables.map((v) => {
                const liveVal = displayedVars[v.name] ?? v.value;
                const mutated = changedSet.has(v.name);
                return (
                  <tr key={v.name} className={mutated ? `${tokens.accentBg}` : undefined}>
                    <td className="py-1.5 pr-3 font-medium text-zinc-100">
                      {v.name}
                      {mutated && <span className={`ml-1.5 text-[10px] ${tokens.accentText}`}>*MOD</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-zinc-400">{v.pic}</td>
                    <td className={`py-1.5 ${v.truncated ? 'text-amber-300' : tokens.accentText}`}>
                      {String(liveVal)}
                      {v.truncated && (
                        <span className="ml-2 rounded-xs border border-amber-600/60 bg-amber-950/60 px-1.5 py-0.5 text-[10px] text-amber-300">
                          TRUNCATED
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
