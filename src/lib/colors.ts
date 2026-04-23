export interface BadgeColor {
  bg: string;
  border: string;
  text: string;
  name: string;
}

// 15 badge colors — WCAG AA compliant (≥ 4.5:1 contrast text on bg)
export const BADGE_PALETTE: BadgeColor[] = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', name: 'Blue' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', name: 'Green' },
  { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', name: 'Violet' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', name: 'Orange' },
  { bg: '#fdf2f8', border: '#fbcfe8', text: '#be185d', name: 'Pink' },
  { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e', name: 'Teal' },
  { bg: '#fefce8', border: '#fef08a', text: '#a16207', name: 'Yellow' },
  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', name: 'Red' },
  { bg: '#eef2ff', border: '#c7d2fe', text: '#4338ca', name: 'Indigo' },
  { bg: '#f7fee7', border: '#d9f99d', text: '#4d7c0f', name: 'Lime' },
  { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490', name: 'Cyan' },
  { bg: '#fffbeb', border: '#fde68a', text: '#b45309', name: 'Amber' },
  { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', name: 'Rose' },
  { bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce', name: 'Purple' },
  { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1', name: 'Sky' },
];

export const PALETTE_COLORS = BADGE_PALETTE.map((c) => c.bg);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function colorDist(a: string, b: string): number {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return (ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2;
}

/**
 * Returns the palette entry for a given stored hex.
 * Exact match on bg (new palette colors) or nearest match by text-color
 * distance (handles legacy dark hex codes like #4f46e5).
 */
export function getBadgeColor(hex: string): BadgeColor {
  if (!hex) return BADGE_PALETTE[0];
  const h = hex.toLowerCase();
  const exact = BADGE_PALETTE.find((c) => c.bg === h);
  if (exact) return exact;
  return BADGE_PALETTE.reduce((best, color) =>
    colorDist(h, color.text) < colorDist(h, best.text) ? color : best
  );
}
