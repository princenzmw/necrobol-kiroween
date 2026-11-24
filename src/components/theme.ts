import type { PhosphorTheme } from '../engine/types';

export interface ThemeTokens {
  label: string;
  accentText: string;
  accentDim: string;
  accentBorder: string;
  accentBg: string;
  buttonSolid: string;
  glowShadow: string;
  graphStroke: string;
  graphFill: string;
}

export const PHOSPHOR_THEMES: Record<PhosphorTheme, ThemeTokens> = {
  green: {
    label: '3270 Green',
    accentText: 'text-emerald-400',
    accentDim: 'text-emerald-600',
    accentBorder: 'border-emerald-700/70',
    accentBg: 'bg-emerald-950/40',
    buttonSolid: 'bg-emerald-600 text-zinc-950 hover:bg-emerald-500',
    glowShadow: 'shadow-[0_0_24px_rgba(16,185,129,0.12)]',
    graphStroke: '#34d399',
    graphFill: '#052e16',
  },
  amber: {
    label: '3278 Amber',
    accentText: 'text-amber-400',
    accentDim: 'text-amber-600',
    accentBorder: 'border-amber-700/70',
    accentBg: 'bg-amber-950/40',
    buttonSolid: 'bg-amber-500 text-zinc-950 hover:bg-amber-400',
    glowShadow: 'shadow-[0_0_24px_rgba(245,158,11,0.12)]',
    graphStroke: '#fbbf24',
    graphFill: '#451a03',
  },
  violet: {
    label: 'Spectral Violet',
    accentText: 'text-violet-300',
    accentDim: 'text-violet-500',
    accentBorder: 'border-violet-700/70',
    accentBg: 'bg-violet-950/40',
    buttonSolid: 'bg-violet-500 text-zinc-950 hover:bg-violet-400',
    glowShadow: 'shadow-[0_0_24px_rgba(139,92,246,0.16)]',
    graphStroke: '#c4b5fd',
    graphFill: '#2e1065',
  },
};
