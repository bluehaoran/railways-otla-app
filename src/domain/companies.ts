import data from '../data/companies.json'
import { inkFor } from './contrast'
import type { Company, CompanyId, CompanyKind } from './types'

export interface CompanyInfo {
  id: CompanyId
  kind: CompanyKind
  abbr: string
  color: string
  ink: string
  names: string[] // minors have one name; majors have one or two
}

const majors: CompanyInfo[] = Object.entries(data.majors).map(([id, m]) => ({
  id,
  kind: 'major',
  abbr: m.abbr,
  color: m.color,
  ink: inkFor(m.color),
  names: m.identities.map((i) => i.name).filter((n): n is string => typeof n === 'string'),
}))

const minors: CompanyInfo[] = Object.entries(data.minors).map(([id, m]) => ({
  id,
  kind: 'minor',
  abbr: m.abbr,
  color: m.color,
  ink: inkFor(m.color),
  names: [m.name],
}))

export const COMPANIES: Record<CompanyId, CompanyInfo> = Object.fromEntries(
  [...majors, ...minors].map((c) => [c.id, c]),
)
export const MAJOR_IDS: CompanyId[] = majors.map((c) => c.id)
export const MINOR_IDS: CompanyId[] = minors.map((c) => c.id)
export const COMPANY_IDS: CompanyId[] = [...MAJOR_IDS, ...MINOR_IDS]

/** Minors that are not available in a Short Game. */
export const SHORT_GAME_REMOVED: CompanyId[] = ['adaptive', 'overnight', 'bridging', 'spacious']

export function kindOf(id: CompanyId): CompanyKind {
  return COMPANIES[id].kind
}

/** The name to show for a company. A major uses its chosen identity. */
export function displayName(company: Company): string {
  const names = COMPANIES[company.id].names
  return names[company.identity ?? 0] ?? names[0]
}
