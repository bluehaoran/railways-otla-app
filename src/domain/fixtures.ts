// Test helpers. Not imported by app code.
import { newGame } from './setup'
import type { CompanyId, Game, PlayerId } from './types'

const PRICES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200, 220, 245, 270, 300, 330, 360, 400, 450, 500]

/** A Long Game in the yellow phase. Players get ids p1, p2, ... and code = name, cash 0. */
export function testGame(names: string[] = ['J', 'K']): Game {
  return newGame(
    { name: 'Test', players: names.map((n) => ({ name: n, code: n, cash: 0 })), shortGame: false, phase: 'yellow' },
    'g1',
    '2026-01-01T00:00:00.000Z',
  )
}

/** Puts a company on the track at `price` (back of the queue) with the given ownership. */
export function put(
  game: Game,
  id: CompanyId,
  o: { price: number; president?: PlayerId | null; holdings?: Record<PlayerId, number>; treasury?: number; market?: number },
): Game {
  const index = PRICES.indexOf(o.price)
  if (index < 1) throw new Error(`${o.price} is not a track price above 0`)
  return {
    ...game,
    companies: {
      ...game.companies,
      [id]: {
        ...game.companies[id],
        status: 'active',
        operated: true,
        president: o.president ?? null,
        holdings: o.holdings ?? {},
        treasuryShares: o.treasury ?? 0,
        marketShares: o.market ?? 0,
      },
    },
    track: game.track.map((q, i) => (i === index ? [...q, id] : q)),
  }
}
