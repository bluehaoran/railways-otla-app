import { displayName, kindOf } from './companies'
import { closeCompany } from './company'
import { presidencyCandidate, transferPresidency } from './presidency'
import { MARKET_LIMIT } from './shares'
import { moveToken, priceOf } from './track'
import type { CompanyId, Game, PlayerId } from './types'

export type BuySource = 'treasury' | 'market'

export interface StockTurn {
  playerId: PlayerId
  /** Regular shares to sell per company. Sold in the key order. */
  sells: Record<CompanyId, number>
  buy?: { companyId: CompanyId; source: BuySource }
}

export type TurnProblemCode =
  | 'not-active'
  | 'bad-count'
  | 'not-held'
  | 'not-operated'
  | 'market-full'
  | 'sold-this-round'
  | 'nothing-to-buy'
  | 'player-limit'
  | 'no-cash'

export interface TurnProblem {
  code: TurnProblemCode
  companyId: CompanyId
  message: string
}

export interface TurnPlan {
  problems: TurnProblem[]
  /** The game after the turn, presidency exchanges and closes included. The input game when there are problems. */
  game: Game
  cashBefore: number
  cashAfter: number
  /** Companies sold. Each drops 1 step. */
  sold: CompanyId[]
  /** Companies that close because the drop reaches 0. The UI confirms before applying. */
  closes: CompanyId[]
  /** Presidency exchanges the rules require after this turn. */
  presidency: { companyId: CompanyId; from: PlayerId; to: PlayerId }[]
}

/** Previews one Stock Round turn: sell, then buy at most one share. Does not change the game. */
export function planTurn(game: Game, turn: StockTurn): TurnPlan {
  const player = game.players.find((p) => p.id === turn.playerId)
  if (!player) throw new Error(`No player ${turn.playerId}`)

  const problems: TurnProblem[] = []
  const problem = (code: TurnProblemCode, companyId: CompanyId, message: string) =>
    problems.push({ code, companyId, message })

  let g = game
  let cash = player.cash
  const sold: CompanyId[] = []
  const closing: CompanyId[] = []

  for (const [companyId, count] of Object.entries(turn.sells)) {
    if (count === 0) continue
    const company = g.companies[companyId]
    if (!company || company.status !== 'active' || priceOf(g, companyId) === null) {
      problem('not-active', companyId, `${companyId} is not in play`)
      continue
    }
    const name = displayName(company)
    const kind = kindOf(companyId)
    const held = company.holdings[turn.playerId] ?? 0
    if (!Number.isInteger(count) || count < 1) {
      problem('bad-count', companyId, `${name}: sell a whole number of shares`)
    } else if (held < count) {
      problem('not-held', companyId, `${name}: ${player.code} holds ${held} shares that can be sold`)
    } else if (kind === 'minor' && !company.operated) {
      problem('not-operated', companyId, `${name} has not operated yet, so its shares cannot be sold`)
    } else if (company.marketShares + count > MARKET_LIMIT[kind]) {
      problem('market-full', companyId, `${name}: the bank pool would hold more than 50%`)
    } else {
      cash += (priceOf(g, companyId) as number) * count
      g = {
        ...g,
        companies: {
          ...g.companies,
          [companyId]: {
            ...company,
            holdings: { ...company.holdings, [turn.playerId]: held - count },
            marketShares: company.marketShares + count,
          },
        },
      }
      const moved = moveToken(g, companyId, -1)
      if (moved.kind === 'close') closing.push(companyId)
      else g = moved.game
      sold.push(companyId)
    }
  }

  if (problems.length > 0) {
    return { problems, game, cashBefore: player.cash, cashAfter: player.cash, sold: [], closes: [], presidency: [] }
  }

  g = {
    ...g,
    players: g.players.map((p) => (p.id === turn.playerId ? { ...p, cash } : p)),
    soldThisRound:
      sold.length === 0
        ? g.soldThisRound
        : {
            ...g.soldThisRound,
            [turn.playerId]: [...new Set([...(g.soldThisRound[turn.playerId] ?? []), ...sold])],
          },
  }

  const presidency: TurnPlan['presidency'] = []
  for (const companyId of sold) {
    if (closing.includes(companyId)) continue
    const to = presidencyCandidate(g, companyId)
    const from = g.companies[companyId].president
    if (to !== null && from !== null) {
      presidency.push({ companyId, from, to })
      g = transferPresidency(g, companyId, to)
    }
  }
  for (const companyId of closing) g = closeCompany(g, companyId)

  return { problems, game: g, cashBefore: player.cash, cashAfter: cash, sold, closes: closing, presidency }
}

/** Applies a turn as one step. Throws when the turn has problems. */
export function applyTurn(game: Game, turn: StockTurn): Game {
  const plan = planTurn(game, turn)
  if (plan.problems.length > 0) throw new Error(plan.problems.map((p) => p.message).join('; '))
  return plan.game
}
