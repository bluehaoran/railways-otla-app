import { shares } from './shares'
import type { CompanyId, Game, PlayerId } from './types'

/**
 * The player who should take the presidency, or null.
 * The presidency moves only when another player holds strictly more shares than the president.
 * If several players tie for the most, it goes to the next of them clockwise from the president.
 */
export function presidencyCandidate(game: Game, id: CompanyId): PlayerId | null {
  const company = game.companies[id]
  const seat = game.players.findIndex((p) => p.id === company.president)
  if (seat === -1) return null
  const held = game.players.map((p) => shares(company, p.id))
  const most = Math.max(...held)
  if (held[seat] >= most) return null
  for (let step = 1; step < game.players.length; step++) {
    const i = (seat + step) % game.players.length
    if (held[i] === most) return game.players[i].id
  }
  return null
}

/** The new president gives 2 regular cards to the old president and takes the president card. */
export function transferPresidency(game: Game, id: CompanyId, to: PlayerId): Game {
  const company = game.companies[id]
  const from = company.president
  if (from === null) throw new Error(`${id} has no president`)
  if (from === to) return game
  const regular = company.holdings[to] ?? 0
  if (regular < 2) throw new Error('The new president needs 2 regular shares to exchange')
  return {
    ...game,
    companies: {
      ...game.companies,
      [id]: {
        ...company,
        president: to,
        holdings: { ...company.holdings, [to]: regular - 2, [from]: (company.holdings[from] ?? 0) + 2 },
      },
    },
  }
}
