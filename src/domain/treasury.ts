import type { CompanyId, Game, LedgerEntry } from './types'

export const MANUAL_REASONS = ['Train', 'Track tile', 'Hub token', 'Other'] as const
export type ManualReason = (typeof MANUAL_REASONS)[number]

/**
 * Adds `delta` to a company's treasury cash and records it in the ledger, stamped with the
 * current cycle and round. A zero delta changes nothing.
 */
export function addCash(game: Game, id: CompanyId, delta: number, what: string, auto = true): Game {
  if (delta === 0) return game
  const company = game.companies[id]
  const entry: LedgerEntry = { cycle: game.round.cycle, round: game.round.type, what, delta, auto }
  return {
    ...game,
    companies: {
      ...game.companies,
      [id]: { ...company, treasuryCash: company.treasuryCash + delta, ledger: [...company.ledger, entry] },
    },
  }
}

/** A manual ledger entry: money the company spent or received. `amount` is above 0. */
export function manualEntry(
  game: Game,
  id: CompanyId,
  kind: 'spend' | 'receive',
  reason: ManualReason,
  amount: number,
): Game {
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('The amount must be more than 0')
  return addCash(game, id, kind === 'spend' ? -amount : amount, reason, false)
}
