// Direct edits for edit mode and for the cash row. They accept any value and never validate.
import { SHORT_GAME_REMOVED } from './companies'
import type { Company, CompanyId, Game, Phase, PlayerId, ViewId } from './types'

/** A share count: a whole number, 0 or more. A cleared input (null) counts as 0. */
function count(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

/** A cash amount: a whole number, may be negative. A cleared input (null) counts as 0. */
function money(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
}

function patchCompany(game: Game, id: CompanyId, patch: Partial<Company>): Game {
  return { ...game, companies: { ...game.companies, [id]: { ...game.companies[id], ...patch } } }
}

export function setCash(game: Game, playerId: PlayerId, cash: number | null): Game {
  return { ...game, players: game.players.map((p) => (p.id === playerId ? { ...p, cash: money(cash) } : p)) }
}

export function setHolding(game: Game, companyId: CompanyId, playerId: PlayerId, n: number | null): Game {
  return patchCompany(game, companyId, { holdings: { ...game.companies[companyId].holdings, [playerId]: count(n) } })
}

export function setTreasuryShares(game: Game, companyId: CompanyId, n: number | null): Game {
  return patchCompany(game, companyId, { treasuryShares: count(n) })
}

export function setMarketShares(game: Game, companyId: CompanyId, n: number | null): Game {
  return patchCompany(game, companyId, { marketShares: count(n) })
}

/** Sets the president directly. No cards are exchanged; use transferPresidency for the rule. */
export function setPresident(game: Game, companyId: CompanyId, playerId: PlayerId | null): Game {
  return patchCompany(game, companyId, { president: playerId })
}

export function setPhase(game: Game, phase: Phase): Game {
  return { ...game, settings: { ...game.settings, phase } }
}

export function setMainView(game: Game, mainView: ViewId): Game {
  return { ...game, settings: { ...game.settings, mainView } }
}

/** Renames the game. An empty name keeps the old one. */
export function renameGame(game: Game, name: string): Game {
  const trimmed = name.trim()
  return trimmed === '' ? game : { ...game, name: trimmed }
}

/** The Short Game flag can change only before the first company starts. */
export function canChangeShortGame(game: Game): boolean {
  return Object.values(game.companies).every((c) => c.status === 'unstarted' || c.status === 'unavailable')
}

export function setShortGame(game: Game, shortGame: boolean): Game {
  if (!canChangeShortGame(game)) throw new Error('The game length is fixed once a company has started')
  const companies = { ...game.companies }
  for (const id of SHORT_GAME_REMOVED) {
    companies[id] = { ...companies[id], status: shortGame ? 'unavailable' : 'unstarted' }
  }
  return { ...game, settings: { ...game.settings, shortGame }, companies }
}
