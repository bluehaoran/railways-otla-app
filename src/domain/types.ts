export type PlayerId = string
export type CompanyId = string // keys from companies.json
export type Phase = 'yellow' | 'green' | 'purple'
export type ViewId = 'track' | 'ownership' | 'scoreboard' | 'dividend'
export type CompanyStatus = 'unavailable' | 'unstarted' | 'active' | 'merged' | 'closed'
export type CompanyKind = 'minor' | 'major'

export interface Player {
  id: PlayerId
  name: string
  code: string
  cash: number
}

export type RoundType = 'SR' | 'OR1' | 'OR2' | 'MR'

/** One change to a company's treasury cash. Positive `delta` is cash in. */
export interface LedgerEntry {
  cycle: number
  round: RoundType
  what: string
  delta: number
  /** True when the app wrote the entry, false when the user typed it. */
  auto: boolean
}

export interface Company {
  id: CompanyId
  status: CompanyStatus
  president: PlayerId | null
  holdings: Record<PlayerId, number> // regular cards only
  treasuryShares: number // regular cards
  marketShares: number // regular cards
  identity?: number // majors: index into the names list (name toggle)
  /** Company treasury cash. Never part of a player's score. */
  treasuryCash: number
  /** False for a minor that has not had its first Operating Round yet. Its shares cannot be sold. */
  operated: boolean
  ledger: LedgerEntry[]
}

export interface Game {
  schemaVersion: 2
  id: string
  name: string
  createdAt: string // ISO
  /** `live`: Phase 2 automation (cash, rounds, ledger) runs only when true. */
  settings: { shortGame: boolean; phase: Phase; mainView: ViewId; live: boolean }
  players: Player[] // order = clockwise seating
  companies: Record<CompanyId, Company>
  track: CompanyId[][] // length 27; track[i] is the queue at TRACK[i]; index 0 is the front
  round: { cycle: number; type: RoundType }
  /** Each player's total at the end of a cycle. Index 0 is cycle 1. */
  cycleScores: Record<PlayerId, number>[]
  /** Companies each player sold in this Stock Round. Cleared when a Stock Round starts. */
  soldThisRound: Record<PlayerId, CompanyId[]>
  /** Companies that have already acted, and that have already issued or redeemed, in this Operating Round. */
  operating: { acted: CompanyId[]; issuedOrRedeemed: CompanyId[] }
}
