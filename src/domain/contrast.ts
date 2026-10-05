export const INK = '#18181b'

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG contrast ratio of two `#rrggbb` colors, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Text color for a company fill: the first of ink, white, black that reaches 4.5:1. */
export function inkFor(fill: string): string {
  for (const candidate of [INK, '#ffffff', '#000000']) {
    if (contrast(candidate, fill) >= 4.5) return candidate
  }
  return contrast('#000000', fill) >= contrast('#ffffff', fill) ? '#000000' : '#ffffff'
}
