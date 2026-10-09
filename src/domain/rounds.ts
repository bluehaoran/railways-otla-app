import { playerTotal, turnOrder } from './scoring'
import { moveToken } from './track'
import type { CompanyId, Game, PlayerId, RoundType } from './types'

export function cycleCount(game: Game): number {
  return game.settings.shortGame ? 4 : 6
}

/** True once the last cycle has ended. `advanceRound` then moves the round to `cycleCount + 1`. */
export function isGameOver(game: Game): boolean {
  return game.round.cycle > cycleCount(game)
}

/** The Merger Round happens only from the green phase (rulebook p.18). */
export function hasMergerRound(game: Game): boolean {
  return game.settings.phase !== 'yellow'
}

/** Stores every player's total for the current cycle, replacing an earlier snapshot of that cycle. */
export function saveSnapshot(game: Game): Game {
  const totals: Record<PlayerId, number> = {}
  for (const p of game.players) totals[p.id] = playerTotal(game, p.id)
  const scores = [...game.cycleScores]
  while (scores.length < game.round.cycle - 1) scores.push({})
  scores[game.round.cycle - 1] = totals
  return { ...game, cycleScores: scores }
}

function enter(game: Game, cycle: number, type: RoundType): Game {
  const next: Game = { ...game, round: { cycle, type } }
  if (type === 'SR') return { ...next, soldThisRound: {} }
  if (type === 'OR1' || type === 'OR2') return { ...next, operating: { acted: [], issuedOrRedeemed: [] } }
  return next
}

/** Moves to the next round. The cycle ends after OR2 or the Merger Round, which saves a snapshot. */
export function advanceRound(game: Game): Game {
  if (isGameOver(game)) throw new Error('The game is over')
  const { cycle, type } = game.round
  if (type === 'SR') return enter(game, cycle, 'OR1')
  if (type === 'OR1') return enter(game, cycle, 'OR2')
  if (type === 'OR2' && hasMergerRound(game)) return enter(game, cycle, 'MR')
  return enter(saveSnapshot(game), cycle + 1, 'SR')
}

/** Active companies that are fully owned by players, in turn order (rulebook p.11, decision D8). */
export function stockRoundRisers(game: Game): CompanyId[] {
  return turnOrder(game).filter((id) => {
    const c = game.companies[id]
    return c.status === 'active' && c.treasuryShares === 0 && c.marketShares === 0
  })
}

/** The end-of-Stock-Round bonus (+1 step, to the back), then the first Operating Round. */
export function endStockRound(game: Game, skip: CompanyId[] = []): Game {
  let g = game
  for (const id of stockRoundRisers(game)) {
    if (skip.includes(id)) continue
    const moved = moveToken(g, id, 1)
    if (moved.kind === 'moved') g = moved.game
  }
  return advanceRound(g)
}

/** The next company to act: highest price first, then queue order, skipping those that acted. */
export function nextToOperate(game: Game): CompanyId | null {
  if (game.round.type !== 'OR1' && game.round.type !== 'OR2') return null
  return turnOrder(game).find((id) => !game.operating.acted.includes(id)) ?? null
}

export interface Actions {
  stock: boolean
  startCompany: boolean
  dividend: boolean
  issueRedeem: boolean
  merge: boolean
}

/** Which actions the current round allows. A manual game allows everything (Phase 1 behavior). */
export function actionsAllowed(game: Game): Actions {
  if (!game.settings.live) return { stock: true, startCompany: true, dividend: true, issueRedeem: true, merge: true }
  const none: Actions = { stock: false, startCompany: false, dividend: false, issueRedeem: false, merge: false }
  if (isGameOver(game)) return none
  switch (game.round.type) {
    case 'SR':
      return { ...none, stock: true, startCompany: true }
    case 'OR1':
    case 'OR2':
      return { ...none, dividend: true, issueRedeem: true }
    case 'MR':
      return { ...none, merge: hasMergerRound(game) }
  }
}
