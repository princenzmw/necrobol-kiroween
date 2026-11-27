import type { PhosphorTheme } from '../engine/types';

export interface ThemeTokens {
  label: string;
  accentText: string;
  accentDim: string;
  accentBorder: string;
  accentBg: string;
  buttonSolid: string;
  glowShadow: string;
  crtWellBg: string;
  textGlow: string;
  activeTabBorder: string;
  barFill: string;
  graphStroke: string;
  graphFill: string;
}

export const PHOSPHOR_THEMES: Record<PhosphorTheme, ThemeTokens> = {
  green: {
    label: '3270 Green',
    accentText: 'text-[#34F585]',
    accentDim: 'text-emerald-500',
    accentBorder: 'border-emerald-600/65',
    accentBg: 'bg-emerald-950/45',
    buttonSolid: 'bg-[#34F585] text-[#050907] hover:bg-[#58f89b]',
    glowShadow: 'shadow-[0_0_24px_rgba(52,245,133,0.12)]',
    crtWellBg: 'bg-[#04130B]',
    textGlow: 'drop-shadow-[0_0_6px_rgba(52,245,133,0.3)]',
    activeTabBorder: 'border-t-2 border-t-[#34F585]',
    barFill: 'bg-[#34F585]',
    graphStroke: '#34F585',
    graphFill: '#052e16',
  },
  amber: {
    label: '3278 Amber',
    accentText: 'text-[#FFB020]',
    accentDim: 'text-amber-500',
    accentBorder: 'border-amber-600/65',
    accentBg: 'bg-amber-950/45',
    buttonSolid: 'bg-[#FFB020] text-[#090704] hover:bg-[#ffc04d]',
    glowShadow: 'shadow-[0_0_24px_rgba(255,176,32,0.12)]',
    crtWellBg: 'bg-[#140D03]',
    textGlow: 'drop-shadow-[0_0_6px_rgba(255,176,32,0.3)]',
    activeTabBorder: 'border-t-2 border-t-[#FFB020]',
    barFill: 'bg-[#FFB020]',
    graphStroke: '#FFB020',
    graphFill: '#451a03',
  },
  violet: {
    label: 'Spectral Violet',
    accentText: 'text-[#C084FC]',
    accentDim: 'text-violet-400',
    accentBorder: 'border-violet-600/65',
    accentBg: 'bg-violet-950/45',
    buttonSolid: 'bg-[#C084FC] text-[#09050E] hover:bg-[#d1a2fe]',
    glowShadow: 'shadow-[0_0_24px_rgba(192,132,252,0.16)]',
    crtWellBg: 'bg-[#11081C]',
    textGlow: 'drop-shadow-[0_0_6px_rgba(192,132,252,0.32)]',
    activeTabBorder: 'border-t-2 border-t-[#C084FC]',
    barFill: 'bg-[#C084FC]',
    graphStroke: '#C084FC',
    graphFill: '#2e1065',
  },
};
