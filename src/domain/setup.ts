import { COMPANY_IDS, SHORT_GAME_REMOVED } from './companies'
import type { Company, Game, Phase } from './types'

export const STARTING_CASH: Record<number, number> = { 2: 450, 3: 300, 4: 275, 5: 220 }
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 5

/** 2 player games default to Short. 3 to 5 player games default to Long. */
export function defaultShortGame(playerCount: number): boolean {
  return playerCount === 2
}

/** A short unique id. Does not need a secure context, unlike crypto.randomUUID. */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export interface NewGameOptions {
  name: string
  players: { name: string; code: string; cash: number }[]
  shortGame: boolean
  phase: Phase
}

export function newGame(opts: NewGameOptions, id: string = newId(), createdAt: string = new Date().toISOString()): Game {
  const companies: Record<string, Company> = {}
  for (const companyId of COMPANY_IDS) {
    companies[companyId] = {
      id: companyId,
      status: opts.shortGame && SHORT_GAME_REMOVED.includes(companyId) ? 'unavailable' : 'unstarted',
      president: null,
      holdings: {},
      treasuryShares: 0,
      marketShares: 0,
    }
  }
  return {
    schemaVersion: 1,
    id,
    name: opts.name,
    createdAt,
    settings: { shortGame: opts.shortGame, phase: opts.phase, mainView: 'track' },
    players: opts.players.map((p, i) => ({ id: `p${i + 1}`, name: p.name, code: p.code, cash: p.cash })),
    companies,
    track: Array.from({ length: 27 }, () => []),
  }
}
