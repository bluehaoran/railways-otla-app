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

export interface Company {
  id: CompanyId
  status: CompanyStatus
  president: PlayerId | null
  holdings: Record<PlayerId, number> // regular cards only
  treasuryShares: number // regular cards
  marketShares: number // regular cards
  identity?: number // majors: index into the names list (name toggle)
}

export interface Game {
  schemaVersion: 1
  id: string
  name: string
  createdAt: string // ISO
  settings: { shortGame: boolean; phase: Phase; mainView: ViewId }
  players: Player[] // order = clockwise seating
  companies: Record<CompanyId, Company>
  track: CompanyId[][] // length 27; track[i] is the queue at TRACK[i]; index 0 is the front
}
