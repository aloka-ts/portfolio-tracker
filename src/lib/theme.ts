import { atom } from 'nanostores';

// Shared light/dark theme handling.
// The anti-flash inline script in Layout.astro duplicates the resolve logic —
// keep the two in sync.
export type ThemeMode = 'light' | 'dark';

const isBrowser = typeof window !== 'undefined';

// Bumped whenever the applied theme changes; chart components subscribe to
// this so canvas-rendered colors follow the theme instantly.
export const themeTickStore = atom(0);

export function getThemeMode(): ThemeMode {
  if (!isBrowser) return 'dark';
  return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
}

export function applyThemeMode(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  themeTickStore.set(themeTickStore.get() + 1);
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem('theme', mode);
  applyThemeMode(mode);
}

// High-contrast palette for colorblind mode (blue/gold anchored)
const COLORBLIND_PALETTE = [
  '#0284C7', '#F59E0B', '#3B82F6', '#EF4444',
  '#8B5CF6', '#EC4899', '#10B981', '#64748B',
];

/** Chart series colors from the --chart-N CSS tokens (theme-aware). */
export function getChartPalette(colorblind = false): string[] {
  if (colorblind) return COLORBLIND_PALETTE;
  if (!isBrowser) return COLORBLIND_PALETTE;
  const style = getComputedStyle(document.documentElement);
  return Array.from({ length: 8 }, (_, i) =>
    style.getPropertyValue(`--chart-${i + 1}`).trim() || '#FF0055'
  );
}

/** Read any CSS custom property off :root (e.g. '--bg-card'). */
export function getCssVar(name: string, fallback = ''): string {
  if (!isBrowser) return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
