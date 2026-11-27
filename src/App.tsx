import { useCallback, useEffect, useMemo, useState } from 'react';
import { CobolEditor } from './components/CobolEditor';
import { ExorcistPanel } from './components/ExorcistPanel';
import { KiroInspectorModal } from './components/KiroInspectorModal';
import { MainframeHeader } from './components/MainframeHeader';
import { ModernizerPanel } from './components/ModernizerPanel';
import { TerminalDebugger } from './components/TerminalDebugger';
import { PHOSPHOR_THEMES } from './components/theme';
import { analyzeCobolProgram } from './engine/exorcist';
import { executeCobolProgram } from './engine/interpreter';
import { parseCobolSource } from './engine/parser';
import { COBOL_SAMPLES } from './engine/samples';
import { transpileCobolSource } from './engine/transpiler';
import type { PhosphorTheme } from './engine/types';

type RightPanelTab = 'debugger' | 'exorcist' | 'modernizer';

export function App() {
  const [selectedSampleId, setSelectedSampleId] = useState(COBOL_SAMPLES[0].id);
  const [source, setSource] = useState(COBOL_SAMPLES[0].source);
  const [theme, setTheme] = useState<PhosphorTheme>('green');
  const [scanlines, setScanlines] = useState(true);
  const [rightTab, setRightTab] = useState<RightPanelTab>('debugger');
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [kiroModalOpen, setKiroModalOpen] = useState(false);

  const parsed = useMemo(() => parseCobolSource(source), [source]);
  const execution = useMemo(() => executeCobolProgram(parsed), [parsed]);
  const exorcism = useMemo(() => analyzeCobolProgram(parsed), [parsed]);
  const transpiled = useMemo(() => transpileCobolSource(source), [source]);

  const activeLine =
    execution.steps.length > 0
      ? (execution.steps[Math.min(stepIdx, execution.steps.length - 1)]?.line ?? null)
      : null;

  useEffect(() => {
    if (!playing || execution.steps.length === 0) return;
    const timer = window.setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= execution.steps.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [playing, execution.steps.length]);

  const handleSelectSample = useCallback((id: string) => {
    const sample = COBOL_SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    setSelectedSampleId(sample.id);
    setSource(sample.source);
    setStepIdx(0);
    setPlaying(false);
    setHighlightedLine(null);
  }, []);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setStepIdx(0);
    setHighlightedLine(null);
  }, []);

  const handleExecute = useCallback(() => {
    setPlaying(false);
    setRightTab('debugger');
    setStepIdx(Math.max(0, execution.steps.length - 1));
  }, [execution.steps.length]);

  const handleStep = useCallback(() => {
    setPlaying(false);
    setRightTab('debugger');
    setStepIdx((prev) => Math.min(Math.max(0, execution.steps.length - 1), prev + 1));
  }, [execution.steps.length]);

  const handleExorciseAndModernize = useCallback(() => {
    setPlaying(false);
    setRightTab('exorcist');
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inTextarea = target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT';
      if (e.key === 'F3') {
        e.preventDefault();
        handleReset();
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleExecute();
      } else if (e.key === 'F8' && !inTextarea) {
        e.preventDefault();
        handleStep();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleExorciseAndModernize();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleReset, handleExecute, handleStep, handleExorciseAndModernize]);

  const tokens = PHOSPHOR_THEMES[theme];
  const totalSteps = execution.steps.length;
  const clampedStep = totalSteps > 0 ? Math.min(stepIdx, totalSteps - 1) + 1 : 0;

  return (
    <div className="chassis-desk flex min-h-screen flex-col text-zinc-100">
      <MainframeHeader
        selectedSampleId={selectedSampleId}
        onSelectSample={handleSelectSample}
        theme={theme}
        onChangeTheme={setTheme}
        scanlines={scanlines}
        onToggleScanlines={() => setScanlines((prev) => !prev)}
        onReset={handleReset}
        onExecute={handleExecute}
        onStep={handleStep}
        onExorciseAndModernize={handleExorciseAndModernize}
        onOpenKiroModal={() => setKiroModalOpen(true)}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <CobolEditor
              source={source}
              onChangeSource={(next) => {
                setSource(next);
                setPlaying(false);
                setStepIdx(0);
              }}
              activeLine={activeLine}
              highlightedLine={highlightedLine}
              curses={exorcism.curses}
              programId={parsed.programId}
              paragraphCount={parsed.paragraphs.length}
              fieldCount={parsed.dataItems.length}
              theme={theme}
            />
          </div>

          <div className="space-y-4 lg:col-span-6">
            <div className="hardware-panel flex flex-wrap divide-x divide-[#2B313B] overflow-hidden rounded-xs">
              {(
                [
                  { id: 'debugger', label: '3270 Terminal & Time-Travel' },
                  { id: 'exorcist', label: `Exorcist (${exorcism.curses.length} Curses)` },
                  { id: 'modernizer', label: `Modernizer (${transpiled.parity.matchPct}% Parity)` },
                ] as Array<{ id: RightPanelTab; label: string }>
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRightTab(item.id)}
                  className={`flex-1 cursor-pointer px-3 py-2 font-mono text-xs transition ${
                    rightTab === item.id
                      ? `${tokens.crtWellBg} ${tokens.accentText} ${tokens.activeTabBorder} font-bold`
                      : 'bg-[#191D23] text-zinc-400 hover:bg-[#1E232B] hover:text-zinc-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {rightTab === 'debugger' && (
              <TerminalDebugger
                execution={execution}
                currentStepIdx={stepIdx}
                onChangeStep={(idx) => {
                  setPlaying(false);
                  setStepIdx(idx);
                }}
                playing={playing}
                onTogglePlay={() => setPlaying((prev) => !prev)}
                scanlines={scanlines}
                theme={theme}
              />
            )}

            {rightTab === 'exorcist' && (
              <ExorcistPanel
                report={exorcism}
                onJumpToLine={(line) => {
                  setHighlightedLine(line);
                }}
                theme={theme}
              />
            )}

            {rightTab === 'modernizer' && <ModernizerPanel transpiled={transpiled} theme={theme} />}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#2B313B] bg-[#0B0E12] px-4 py-2 font-mono text-[11px] text-zinc-400 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className={tokens.accentText}>SYSTEM: ONLINE</span>
            <span>ARCHIVE: {parsed.programId}</span>
            <span>MODE: {tokens.label.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>STEP {clampedStep}/{totalSteps}</span>
            <span>PF3/PF5/PF8/PF9 READY</span>
          </div>
        </div>
      </footer>

      <KiroInspectorModal open={kiroModalOpen} onClose={() => setKiroModalOpen(false)} />
    </div>
  );
}

export default App;
