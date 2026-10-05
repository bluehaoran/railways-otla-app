import { describe, expect, it } from 'vitest'
import { playerTotal, ranking, tieNotes, turnOrder } from './scoring'
import { put, testGame } from './fixtures'

const [J, K, L] = ['p1', 'p2', 'p3']

function withCash(game: ReturnType<typeof testGame>, cash: number[]) {
  return { ...game, players: game.players.map((p, i) => ({ ...p, cash: cash[i] })) }
}

describe('turnOrder', () => {
  it('sorts by price descending, then by queue order', () => {
    let g = put(testGame(), 'tunneling', { price: 90 })
    g = put(g, 'express', { price: 110 })
    g = put(g, 'northernPort', { price: 90 })
    g = put(g, 'resourceful', { price: 60 })
    expect(turnOrder(g)).toEqual(['express', 'tunneling', 'northernPort', 'resourceful'])
  })

  it('is empty for a new game', () => {
    expect(turnOrder(testGame())).toEqual([])
  })
})

describe('playerTotal', () => {
  it('adds cash and shares times price (spec D3 test 5)', () => {
    let g = withCash(testGame(), [100, 0])
    g = put(g, 'express', { price: 80, president: J, holdings: { [J]: 1 }, treasury: 2 })
    g = put(g, 'union', { price: 60, president: K, holdings: { [J]: 1 }, treasury: 7 })
    expect(playerTotal(g, J)).toBe(400)
    expect(playerTotal(g, K)).toBe(120)
  })

  it('ignores treasury and market shares and companies that are off the track', () => {
    let g = withCash(testGame(), [50, 0])
    g = put(g, 'express', { price: 80, treasury: 3, market: 2 })
    g.companies.tunneling = { ...g.companies.tunneling, status: 'closed', president: J, holdings: { [J]: 3 } }
    expect(playerTotal(g, J)).toBe(50)
  })
})

describe('ranking', () => {
  it('ranks by total, highest first', () => {
    const g = withCash(testGame(['J', 'K', 'L']), [10, 30, 20])
    expect(ranking(g)).toEqual([
      { playerId: K, total: 30, rank: 1, tieBreakApplied: false },
      { playerId: L, total: 20, rank: 2, tieBreakApplied: false },
      { playerId: J, total: 10, rank: 3, tieBreakApplied: false },
    ])
  })

  it('breaks a tie by the presidency that comes first in turn order (spec D3 test 6)', () => {
    let g = withCash(testGame(), [40, 0])
    // J presides over Tunneling (70). K presides over Express (90), which acts first.
    g = put(g, 'tunneling', { price: 70, president: J, treasury: 3 })
    g = put(g, 'express', { price: 90, president: K, treasury: 3 })
    expect(playerTotal(g, J)).toBe(180)
    expect(playerTotal(g, K)).toBe(180)
    expect(ranking(g)).toEqual([
      { playerId: K, total: 180, rank: 1, tieBreakApplied: true },
      { playerId: J, total: 180, rank: 2, tieBreakApplied: true },
    ])
    expect(tieNotes(g)).toEqual([
      'K and J tie at 180. K ranks higher: K is president of Express, which acts before Tunneling, where J is president.',
    ])
  })

  it('uses queue order when both presidencies are at the same price', () => {
    let g = testGame()
    g = put(g, 'tunneling', { price: 80, president: K, treasury: 3 })
    g = put(g, 'express', { price: 80, president: J, treasury: 3 })
    expect(ranking(g).map((r) => r.playerId)).toEqual([K, J])
  })

  it('leaves players tied when neither presides over a company', () => {
    const g = withCash(testGame(['J', 'K', 'L']), [100, 50, 100])
    expect(ranking(g)).toEqual([
      { playerId: J, total: 100, rank: 1, tieBreakApplied: false },
      { playerId: L, total: 100, rank: 1, tieBreakApplied: false },
      { playerId: K, total: 50, rank: 3, tieBreakApplied: false },
    ])
    expect(tieNotes(g)).toEqual(['J and L tie at 100. Neither is president of a company, so they stay tied.'])
  })

  it('ranks a president above a tied player with no presidency', () => {
    let g = withCash(testGame(), [0, 160])
    g = put(g, 'express', { price: 80, president: J, treasury: 3 })
    expect(ranking(g).map((r) => [r.playerId, r.rank])).toEqual([[J, 1], [K, 2]])
    expect(tieNotes(g)).toEqual([
      'J and K tie at 160. J ranks higher: J is president of Express, and K is president of no company.',
    ])
  })
})
