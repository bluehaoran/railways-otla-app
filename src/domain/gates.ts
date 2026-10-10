import { canMerge } from './merge'
import { actionsAllowed, isGameOver } from './rounds'
import type { Game } from './types'

export interface GateHints {
  start: string | null
  merge: string | null
}

/** Why Start company and Merge are disabled in a live game; null when the action is open. */
export function gateHints(game: Game): GateHints {
  if (!game.settings.live) return { start: null, merge: null }
  if (isGameOver(game)) return { start: 'The game is over', merge: 'The game is over' }
  const allowed = actionsAllowed(game)
  return {
    start: allowed.startCompany ? null : 'Companies start in the Stock Round',
    merge: !allowed.merge
      ? 'Mergers happen in the Merger Round, from the green phase'
      : canMerge(game)
        ? null
        : 'A merger needs two active minors and a major that has not started',
  }
}
