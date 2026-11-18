import { FontPairing, RadiusStyle, ThemeConfig } from '../types/planner';

const FONT_MAP: Record<FontPairing, { display: string; body: string; mono: string }> = {
  'outfit-jakarta': {
    display: "'Outfit', sans-serif",
    body: "'Plus Jakarta Sans', 'Noto Sans Sinhala', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  'jakarta-ibm': {
    display: "'Plus Jakarta Sans', sans-serif",
    body: "'Plus Jakarta Sans', 'Noto Sans Sinhala', sans-serif",
    mono: "'IBM Plex Mono', monospace",
  },
  'dm-space': {
    display: "'DM Sans', sans-serif",
    body: "'DM Sans', 'Noto Sans Sinhala', sans-serif",
    mono: "'Space Mono', monospace",
  },
};

const RADIUS_MAP: Record<RadiusStyle, { card: string; control: string }> = {
  sharp: { card: '4px', control: '3px' },
  balanced: { card: '10px', control: '6px' },
  soft: { card: '16px', control: '10px' },
};

function hexToSoftRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(15, 118, 110, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyThemeToDocument(theme: ThemeConfig): void {
  const root = document.documentElement;
  if (theme.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const fonts = FONT_MAP[theme.fontPairing] ?? FONT_MAP['outfit-jakarta'];
  const radii = RADIUS_MAP[theme.radiusStyle] ?? RADIUS_MAP.balanced;

  root.style.setProperty('--bg-canvas', theme.colors.canvas);
  root.style.setProperty('--bg-surface', theme.colors.surface);
  root.style.setProperty('--bg-subtle', theme.colors.subtle);
  root.style.setProperty('--border-subtle', theme.colors.border);
  root.style.setProperty('--border-strong', theme.colors.border);
  root.style.setProperty('--text-primary', theme.colors.textPrimary);
  root.style.setProperty('--text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--text-muted', theme.colors.textSecondary);
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--accent-fg', theme.colors.accentFg);
  root.style.setProperty('--accent-soft', hexToSoftRgba(theme.colors.accent, theme.isDark ? 0.18 : 0.12));

  root.style.setProperty('--color-using', theme.colors.usingBlock);
  root.style.setProperty('--color-class', theme.colors.classBlock);
  root.style.setProperty('--color-wasting', theme.colors.wastingBlock);
  root.style.setProperty('--color-sleep', theme.colors.sleepBlock);
  root.style.setProperty('--color-online', theme.colors.onlineBlock);

  root.style.setProperty('--font-display', fonts.display);
  root.style.setProperty('--font-body', fonts.body);
  root.style.setProperty('--font-mono', fonts.mono);

  root.style.setProperty('--radius-card', radii.card);
  root.style.setProperty('--radius-control', radii.control);
}
