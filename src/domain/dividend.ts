import { kindOf } from './companies'
import { closeCompany } from './company'
import { TOTAL_SHARES, shares } from './shares'
import { TOP, TRACK, findToken, moveToken, priceOf } from './track'
import { addCash } from './treasury'
import type { CompanyId, Game, PlayerId } from './types'

export type DividendChoice = 'payout' | 'withhold' | 'no-train'

export interface DividendPlan {
  companyId: CompanyId
  /** What the company really did. A payout of 0 counts as no train (rulebook p.11). */
  choice: DividendChoice
  earnings: number
  /** The share price before the move. */
  price: number
  /** Cash each player receives. Players who receive nothing are absent. */
  players: Record<PlayerId, number>
  /** Cash that goes to the company treasury: the payout on its own shares, or the withheld earnings. */
  treasury: number
  /** The payout on bank pool shares. Nobody receives it. Shown for the total. */
  bank: number
  /** Price steps: -1, 0 (unchanged, the token goes to the back), 1 or 2. */
  steps: -1 | 0 | 1 | 2
  /** The price after the move. 0 means the company closes. */
  newPrice: number
}

/**
 * Previews a dividend decision. Does not change the game.
 * `earnings` is a whole multiple of 10 (decision D5). No train ignores it.
 * Throws for a company that already acted, so a caller must check `game.operating.acted`
 * first (for example in a Vue `computed`).
 */
export function dividendPlan(game: Game, id: CompanyId, earnings: number, choice: DividendChoice): DividendPlan {
  const company = game.companies[id]
  const pos = findToken(game, id)
  if (!company || company.status !== 'active' || !pos) throw new Error(`${id} is not an active company`)
  if (game.operating.acted.includes(id)) throw new Error(`${id} has already operated this round`)
  if (!Number.isInteger(earnings) || earnings < 0 || earnings % 10 !== 0) {
    throw new RangeError('Earnings are a multiple of 10, 0 or more')
  }

  const price = TRACK[pos.index]
  const effective: DividendChoice = choice === 'payout' && earnings === 0 ? 'no-train' : choice
  const e = effective === 'no-train' ? 0 : earnings

  let steps: DividendPlan['steps'] = -1
  if (effective === 'payout') steps = e < price ? 0 : e < 2 * price ? 1 : 2

  const players: Record<PlayerId, number> = {}
  let treasury = 0
  let bank = 0
  if (effective === 'payout') {
    const each = e / TOTAL_SHARES[kindOf(id)]
    for (const p of game.players) {
      const n = shares(company, p.id)
      if (n > 0) players[p.id] = n * each
    }
    treasury = company.treasuryShares * each
    bank = company.marketShares * each
  } else if (effective === 'withhold') {
    treasury = e
  }

  const index = Math.max(0, Math.min(TOP, pos.index + steps))
  return { companyId: id, choice: effective, earnings: e, price, players, treasury, bank, steps, newPrice: TRACK[index] }
}

/** Applies a plan as one step: cash, treasury, the price move, and the company's acted flags. */
export function applyDividend(game: Game, plan: DividendPlan): Game {
  const id = plan.companyId
  if (game.operating.acted.includes(id)) throw new Error(`${id} has already operated this round`)
  if (game.companies[id]?.status !== 'active') throw new Error(`${id} is not an active company`)
  if (priceOf(game, id) !== plan.price) throw new Error(`The plan for ${id} is stale: the price has changed`)
  let g: Game = {
    ...game,
    players: game.players.map((p) => ({ ...p, cash: p.cash + (plan.players[p.id] ?? 0) })),
    companies: { ...game.companies, [id]: { ...game.companies[id], operated: true } },
    operating: { ...game.operating, acted: [...game.operating.acted, id] },
  }
  if (plan.treasury > 0) {
    g = addCash(g, id, plan.treasury, plan.choice === 'withhold' ? 'Earnings withheld' : 'Dividend on treasury shares')
  }
  const moved = moveToken(g, id, plan.steps)
  return moved.kind === 'close' ? closeCompany(g, id) : moved.game
}
