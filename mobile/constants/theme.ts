// constants/theme.ts
export const colors = {
  bg: '#0f172a',
  cardBg: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.08)',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  blue: '#60a5fa',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  purple: '#a78bfa',
};

export const ratingColors: Record<string, string> = {
  green: colors.green,
  yellow: colors.yellow,
  red: colors.red,
};

export function scoreColor(score: number): string {
  if (score < 10) return '#64748b';
  if (score < 25) return '#f87171';
  if (score < 40) return '#fb923c';
  if (score < 55) return '#fbbf24';
  if (score < 70) return '#4ade80';
  if (score < 85) return '#34d399';
  if (score < 95) return '#a78bfa';
  return '#ec4899';
}
