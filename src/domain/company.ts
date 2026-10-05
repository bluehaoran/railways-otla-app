import { COMPANIES } from './companies'
import { TRACK } from './track'
import type { CompanyId, Game, PlayerId } from './types'

/**
 * Starts a minor: the president gets the president card (2 shares), the 3 regular
 * cards go to the company treasury, and the token joins the back of the queue at `price`.
 * The president pays the winning bid from cash. The cash may go negative; validation flags it.
 * The company's own cash is not tracked in Phase 1, so the bid only leaves the player.
 */
export function startCompany(game: Game, id: CompanyId, presidentId: PlayerId, price: number, bid: number): Game {
  const company = game.companies[id]
  if (!company || COMPANIES[id].kind !== 'minor') throw new Error(`${id} is not a minor company`)
  if (company.status !== 'unstarted') throw new Error(`${id} cannot be started`)
  if (!game.players.some((p) => p.id === presidentId)) throw new Error(`No player ${presidentId}`)
  const index = TRACK.indexOf(price)
  if (index < 1) throw new RangeError(`${price} is not a track price`)
  if (!Number.isFinite(bid) || bid < 0) throw new RangeError('The bid must be a number, 0 or more')
  return {
    ...game,
    players: game.players.map((p) => (p.id === presidentId ? { ...p, cash: p.cash - bid } : p)),
    companies: {
      ...game.companies,
      [id]: { id, status: 'active', president: presidentId, holdings: {}, treasuryShares: 3, marketShares: 0 },
    },
    track: game.track.map((queue, i) => (i === index ? [...queue, id] : queue)),
  }
}

/** Dissolves a company: its shares leave the game and its token leaves the track. */
export function closeCompany(game: Game, id: CompanyId): Game {
  return {
    ...game,
    companies: {
      ...game.companies,
      [id]: { id, status: 'closed', president: null, holdings: {}, treasuryShares: 0, marketShares: 0 },
    },
    track: game.track.map((queue) => queue.filter((c) => c !== id)),
  }
}
