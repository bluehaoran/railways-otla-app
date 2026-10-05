import type { Zone } from './track'
import type { Phase } from './types'

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th". */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

export const PHASE_LABEL: Record<Phase, string> = { yellow: 'Yellow', green: 'Green', purple: 'Purple' }

export const ZONE_LABEL: Record<Zone, string> = {
  closed: 'Closed',
  none: '',
  yellow: 'Yellow',
  green: 'Green',
  purple: 'Purple',
}
