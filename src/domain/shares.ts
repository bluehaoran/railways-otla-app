import { displayName, kindOf } from './companies'
import type { Company, CompanyId, Game, PlayerId } from './types'

export const UNIT_PCT = { minor: 0.2, major: 0.1 }
export const TOTAL_SHARES = { minor: 5, major: 10 }
/** A player holds at most 60% of a company. */
export const PLAYER_LIMIT = { minor: 3, major: 6 }
/** The market holds at most 50% of a company. */
export const MARKET_LIMIT = { minor: 2, major: 5 }

/** Shares a player holds: regular cards, plus 2 for the president card. */
export function shares(company: Company, playerId: PlayerId): number {
  return (company.holdings[playerId] ?? 0) + (company.president === playerId ? 2 : 0)
}

/** All shares accounted for: players, the president card, treasury and market. */
export function shareTotal(company: Company): number {
  const held = Object.values(company.holdings).reduce((sum, n) => sum + n, 0)
  return held + (company.president === null ? 0 : 2) + company.treasuryShares + company.marketShares
}

export type WarningCode =
  | 'share-sum'
  | 'player-limit'
  | 'market-limit'
  | 'no-president'
  | 'president-outvoted'
  | 'negative-cash'

export interface Warning {
  code: WarningCode
  companyId?: CompanyId
  playerId?: PlayerId
  message: string
}

/** Rule warnings for the current state. Warnings never block an action. */
export function validate(game: Game): Warning[] {
  const out: Warning[] = []
  for (const company of Object.values(game.companies)) {
    if (company.status !== 'active') continue
    const kind = kindOf(company.id)
    const name = displayName(company)
    const companyId = company.id

    const sum = shareTotal(company)
    if (sum !== TOTAL_SHARES[kind]) {
      out.push({ code: 'share-sum', companyId, message: `${name}: shares total ${sum} of ${TOTAL_SHARES[kind]}` })
    }

    for (const p of game.players) {
      const n = shares(company, p.id)
      if (n > PLAYER_LIMIT[kind]) {
        out.push({
          code: 'player-limit',
          companyId,
          playerId: p.id,
          message: `${name}: ${p.code} holds ${n} shares, the limit is ${PLAYER_LIMIT[kind]}`,
        })
      }
    }

    if (company.marketShares > MARKET_LIMIT[kind]) {
      out.push({
        code: 'market-limit',
        companyId,
        message: `${name}: the market holds ${company.marketShares} shares, the limit is ${MARKET_LIMIT[kind]}`,
      })
    }

    const president = game.players.find((p) => p.id === company.president)
    if (!president) {
      out.push({ code: 'no-president', companyId, message: `${name} has no president` })
    } else {
      const presidentShares = shares(company, president.id)
      let top = president
      for (const p of game.players) if (shares(company, p.id) > shares(company, top.id)) top = p
      if (top.id !== president.id) {
        out.push({
          code: 'president-outvoted',
          companyId,
          playerId: top.id,
          message: `${name}: ${top.code} has ${shares(company, top.id)}, president ${president.code} has ${presidentShares}`,
        })
      }
    }
  }
  for (const p of game.players) {
    if (p.cash < 0) out.push({ code: 'negative-cash', playerId: p.id, message: `${p.name} has negative cash` })
  }
  return out
}
