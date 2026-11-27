import { Ghost, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { CurseSeverity, ExorcismReport, PhosphorTheme } from '../engine/types';
import { PHOSPHOR_THEMES } from './theme';

interface ExorcistPanelProps {
  report: ExorcismReport;
  onJumpToLine: (line: number) => void;
  theme: PhosphorTheme;
}

function severityBadge(sev: CurseSeverity): string {
  switch (sev) {
    case 'CRITICAL':
      return 'border-red-600/80 bg-red-950/70 text-red-200';
    case 'HIGH':
      return 'border-amber-600/80 bg-amber-950/70 text-amber-200';
    case 'MEDIUM':
      return 'border-violet-600/80 bg-violet-950/70 text-violet-200';
    case 'LOW':
      return 'border-zinc-700 bg-zinc-900 text-zinc-300';
  }
}

function severityAccentBorder(sev: CurseSeverity): string {
  switch (sev) {
    case 'CRITICAL':
      return 'border-l-red-500';
    case 'HIGH':
      return 'border-l-amber-400';
    case 'MEDIUM':
      return 'border-l-violet-400';
    case 'LOW':
      return 'border-l-zinc-500';
  }
}

export function ExorcistPanel({ report, onJumpToLine, theme }: ExorcistPanelProps) {
  const tokens = PHOSPHOR_THEMES[theme];
  const ghostSet = new Set(report.ghostParagraphs);

  const nodePositions = report.paragraphs.map((name, idx) => ({
    name,
    x: 24 + (idx % 2) * 230,
    y: 22 + Math.floor(idx / 2) * 76,
    isGhost: ghostSet.has(name),
  }));

  const posMap = new Map(nodePositions.map((n) => [n.name, n]));
  const svgHeight = Math.max(120, Math.ceil(report.paragraphs.length / 2) * 76 + 34);
  const litSegments = report.hauntingScore === 0 ? 0 : Math.max(1, Math.round(report.hauntingScore / 10));

  return (
    <div className="space-y-4">
      <section className="hardware-panel rounded-xs p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {report.hauntingScore === 0 ? (
              <ShieldCheck className="h-5 w-5 text-[#34F585]" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-rose-400" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-hardware text-sm font-bold text-zinc-100">
                  Exorcist Static Audit
                </h2>
                <span className="rounded-xs border border-[#2B313B] bg-[#111418] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                  {report.grade}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {report.curses.length} {report.curses.length === 1 ? 'hazard' : 'hazards'} detected across{' '}
                {report.paragraphs.length} paragraphs
              </p>
            </div>
          </div>

          <div className="text-right font-mono">
            <div
              className={`text-2xl font-bold ${
                report.hauntingScore === 0
                  ? 'text-[#34F585]'
                  : report.hauntingScore <= 25
                    ? 'text-[#FFB020]'
                    : 'text-rose-400'
              }`}
            >
              {report.hauntingScore}/100
            </div>
            <div className="text-[10px] text-zinc-400">Haunting Score</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-10 gap-1" aria-label="Haunting score gauge">
          {Array.from({ length: 10 }, (_, idx) => {
            const lit = idx < litSegments;
            const color = !lit
              ? 'bg-[#111418] border-[#2B313B]'
              : report.hauntingScore <= 25
                ? 'bg-[#FFB020] border-[#FFB020]'
                : 'bg-rose-500 border-rose-400';
            return <div key={idx} className={`h-2.5 rounded-xs border ${color}`} />;
          })}
        </div>
      </section>

      <section className="hardware-panel rounded-xs p-4">
        <div className="flex items-center justify-between border-b border-[#2B313B] pb-2">
          <h3 className="font-hardware text-sm font-semibold text-zinc-100">
            Curse Diagnostics
          </h3>
          <span className="font-mono text-[11px] text-zinc-400">Click any row to jump to line</span>
        </div>

        {report.curses.length === 0 ? (
          <div className="mt-3 rounded-xs border border-emerald-700/60 bg-[#04130B] p-3 font-mono text-xs text-[#34F585]">
            Zero curses detected. Program is free of Y2K rollovers, GO TO branches, and ghost paragraphs.
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            {report.curses.map((curse) => (
              <button
                key={curse.id}
                type="button"
                onClick={() => onJumpToLine(curse.line)}
                className={`block w-full cursor-pointer rounded-xs border border-[#2B313B] border-l-4 ${severityAccentBorder(curse.severity)} bg-[#111418] p-3 text-left transition hover:border-zinc-500 hover:bg-[#151920]`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-xs border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${severityBadge(curse.severity)}`}
                    >
                      {curse.severity}
                    </span>
                    <span className="font-mono text-xs font-semibold text-zinc-100">
                      {curse.title}
                    </span>
                  </div>
                  <span className="rounded-xs border border-[#2B313B] bg-[#191D23] px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
                    L{curse.line} {curse.code}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-zinc-300">{curse.detail}</p>
                <p className={`mt-1 font-mono text-[11px] ${tokens.accentText}`}>
                  Fix: {curse.remediation}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="hardware-panel rounded-xs p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-hardware text-sm font-semibold text-zinc-100">
            Paragraph Control-Flow Graph
          </h3>
          <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-400">
            <span className={tokens.accentText}>Solid = PERFORM</span>
            <span className="text-rose-400">Crimson = GO TO</span>
            <span className="inline-flex items-center gap-1 text-violet-300">
              <Ghost className="h-3 w-3" /> Dashed = Ghost
            </span>
          </div>
        </div>

        <div className="crt-glass scope-grid mt-3 overflow-x-auto rounded-xs border border-[#2B313B] p-2">
          <svg width="470" height={svgHeight} viewBox={`0 0 470 ${svgHeight}`} className="max-w-full">
            <defs>
              <marker id="arrow-normal" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill={tokens.graphStroke} />
              </marker>
              <marker id="arrow-goto" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#fb7185" />
              </marker>
            </defs>

            {report.edges.map((edge, idx) => {
              const from = posMap.get(edge.from);
              const to = posMap.get(edge.to);
              if (!from || !to) return null;
              const x1 = from.x + 95;
              const y1 = from.y + 40;
              const x2 = to.x + 95;
              const y2 = to.y;
              const isGoto = edge.kind === 'GOTO';
              return (
                <path
                  key={`${edge.from}-${edge.to}-${idx}`}
                  d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isGoto ? '#fb7185' : tokens.graphStroke}
                  strokeWidth={isGoto ? 2 : 1.5}
                  strokeDasharray={edge.kind === 'FALLTHROUGH' ? '4 4' : undefined}
                  markerEnd={isGoto ? 'url(#arrow-goto)' : 'url(#arrow-normal)'}
                />
              );
            })}

            {nodePositions.map((node) => (
              <g key={node.name} transform={`translate(${node.x}, ${node.y})`}>
                <rect
                  width="190"
                  height="40"
                  rx="2"
                  fill={node.isGhost ? '#2e1065' : tokens.graphFill}
                  stroke={node.isGhost ? '#c084fc' : tokens.graphStroke}
                  strokeWidth="1.5"
                  strokeDasharray={node.isGhost ? '5 3' : undefined}
                />
                <text
                  x="95"
                  y="24"
                  textAnchor="middle"
                  fill={node.isGhost ? '#e9d5ff' : '#f4f4f5'}
                  fontSize="11"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {node.isGhost ? `GHOST: ${node.name}` : node.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </section>
    </div>
  );
}
