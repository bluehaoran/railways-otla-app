import { describe, expect, it } from 'vitest'
import {
  actionsAllowed,
  advanceRound,
  cycleCount,
  endStockRound,
  hasMergerRound,
  isGameOver,
  nextToOperate,
  saveSnapshot,
  stockRoundRisers,
} from './rounds'
import { put, testGame, withRound } from './fixtures'
import { setCash, setPhase } from './edit'
import { priceOf } from './track'

const [J, K] = ['p1', 'p2']
const roundOf = (g: ReturnType<typeof testGame>) => `${g.round.cycle}${g.round.type}`

describe('round order (spec D3 test 20)', () => {
  it('skips the Merger Round in the yellow phase', () => {
    let g = testGame()
    const seen = [roundOf(g)]
    for (let i = 0; i < 3; i++) {
      g = advanceRound(g)
      seen.push(roundOf(g))
    }
    expect(seen).toEqual(['1SR', '1OR1', '1OR2', '2SR'])
    expect(hasMergerRound(g)).toBe(false)
  })

  it('plays the Merger Round from the green phase', () => {
    let g = setPhase(testGame(), 'green')
    const seen = [roundOf(g)]
    for (let i = 0; i < 4; i++) {
      g = advanceRound(g)
      seen.push(roundOf(g))
    }
    expect(seen).toEqual(['1SR', '1OR1', '1OR2', '1MR', '2SR'])
  })

  it('reads the phase when OR2 ends: a phase change after leaving OR2 adds no Merger Round', () => {
    const yellow = withRound(testGame(), 1, 'OR2')
    let g = advanceRound(yellow)
    expect(roundOf(g)).toBe('2SR')
    g = setPhase(g, 'green')
    expect(roundOf(g)).toBe('2SR')
    const early = advanceRound(setPhase(yellow, 'green'))
    expect(roundOf(early)).toBe('1MR')
  })

  it('has 4 cycles in a Short Game and 6 in a Long Game, and ends after the last', () => {
    const long = testGame()
    expect(cycleCount(long)).toBe(6)
    const short = { ...testGame(), settings: { ...testGame().settings, shortGame: true } }
    expect(cycleCount(short)).toBe(4)
    const last = withRound(short, 4, 'OR2')
    expect(isGameOver(last)).toBe(false)
    const over = advanceRound(last)
    expect(isGameOver(over)).toBe(true)
    expect(over.round).toEqual({ cycle: 5, type: 'SR' })
    expect(() => advanceRound(over)).toThrow()
    expect(over.cycleScores).toHaveLength(4)
  })

  it('clears the Operating Round state on entering an OR and the sales record on entering an SR', () => {
    let g = { ...testGame(), operating: { acted: ['express'], issuedOrRedeemed: ['express'] }, soldThisRound: { [K]: ['express'] } }
    g = advanceRound(g)
    expect(g.round.type).toBe('OR1')
    expect(g.operating).toEqual({ acted: [], issuedOrRedeemed: [] })
    g = { ...withRound(g, 1, 'OR2'), soldThisRound: { [K]: ['express'] } }
    g = advanceRound(g)
    expect(g.round.type).toBe('SR')
    expect(g.soldThisRound).toEqual({})
  })
})

describe('snapshots', () => {
  const game = () => setCash(setCash(put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 }), J, 100), K, 0)

  it('stores every player total at the end of a cycle', () => {
    const next = advanceRound(withRound(game(), 1, 'OR2'))
    expect(next.cycleScores).toEqual([{ [J]: 260, [K]: 80 }])
  })

  it('replaces the snapshot for the same cycle when saved again', () => {
    let g = withRound(game(), 2, 'OR1')
    g = saveSnapshot(g)
    g = setCash(g, K, 50)
    g = saveSnapshot(g)
    expect(g.cycleScores).toHaveLength(2)
    expect(g.cycleScores[1]).toEqual({ [J]: 260, [K]: 130 })
    expect(g.cycleScores[0]).toEqual({})
  })
})

describe('end of Stock Round (spec D3 test 17)', () => {
  const full = (price: number, id: string, g = testGame()) => put(g, id, { price, president: J, holdings: { [K]: 3 } })

  it('raises only the companies fully owned by players, to the back of the new queue', () => {
    let g = full(80, 'express')
    g = put(g, 'tunneling', { price: 70, president: J, holdings: { [K]: 1 }, treasury: 2 })
    g = put(g, 'resourceful', { price: 90, president: K, treasury: 3 })
    expect(stockRoundRisers(g)).toEqual(['express'])
    const next = endStockRound(g)
    expect(priceOf(next, 'express')).toBe(90)
    expect(next.track[9]).toEqual(['resourceful', 'express'])
    expect(priceOf(next, 'tunneling')).toBe(70)
  })

  it('does not rise a company with a share in the bank pool', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 2 }, market: 1 })
    expect(stockRoundRisers(g)).toEqual([])
  })

  it('stacks several risers in turn order (decision D8)', () => {
    let g = full(80, 'express')
    g = full(80, 'tunneling', g)
    expect(g.track[8]).toEqual(['express', 'tunneling'])
    const next = endStockRound(g)
    expect(next.track[9]).toEqual(['express', 'tunneling'])
  })

  it('keeps the companies in the skip list where they are', () => {
    let g = full(80, 'express')
    g = full(80, 'tunneling', g)
    const next = endStockRound(g, ['tunneling'])
    expect(priceOf(next, 'express')).toBe(90)
    expect(priceOf(next, 'tunneling')).toBe(80)
  })

  it('stays at 500 and goes to the back', () => {
    let g = full(500, 'express')
    g = put(g, 'tunneling', { price: 500, president: K, treasury: 3 })
    const next = endStockRound(g)
    expect(next.track[26]).toEqual(['tunneling', 'express'])
  })

  it('then moves to the first Operating Round', () => {
    const next = endStockRound(testGame())
    expect(roundOf(next)).toBe('1OR1')
  })
})

describe('who operates next (rulebook p.11 to 12)', () => {
  const ors = () => withRound(put(put(testGame(), 'express', { price: 80, president: J, treasury: 3 }), 'tunneling', { price: 70, president: K, treasury: 3 }), 1, 'OR1')

  it('is the highest price that has not acted', () => {
    expect(nextToOperate(ors())).toBe('express')
    expect(nextToOperate({ ...ors(), operating: { acted: ['express'], issuedOrRedeemed: [] } })).toBe('tunneling')
    expect(nextToOperate({ ...ors(), operating: { acted: ['express', 'tunneling'], issuedOrRedeemed: [] } })).toBeNull()
  })

  it('follows a price change during the round', () => {
    let g = ors()
    g = { ...g, track: g.track.map((q, i) => (i === 8 ? [] : i === 6 ? ['express'] : q)) }
    expect(nextToOperate(g)).toBe('tunneling')
  })

  it('is null outside an Operating Round', () => {
    expect(nextToOperate(withRound(ors(), 1, 'SR'))).toBeNull()
    expect(nextToOperate(withRound(ors(), 1, 'MR'))).toBeNull()
  })
})

describe('actionsAllowed', () => {
  const none = { stock: false, startCompany: false, dividend: false, issueRedeem: false, merge: false }

  it('allows stock actions only in a Stock Round', () => {
    expect(actionsAllowed(testGame())).toEqual({ ...none, stock: true, startCompany: true })
  })

  it('allows dividend and issue only in an Operating Round', () => {
    expect(actionsAllowed(withRound(testGame(), 1, 'OR2'))).toEqual({ ...none, dividend: true, issueRedeem: true })
  })

  it('allows a merge only in the Merger Round, and only from the green phase', () => {
    const mr = withRound(setPhase(testGame(), 'green'), 1, 'MR')
    expect(actionsAllowed(mr)).toEqual({ ...none, merge: true })
    expect(actionsAllowed(setPhase(mr, 'yellow')).merge).toBe(false)
  })

  it('allows nothing when the game is over', () => {
    expect(actionsAllowed(withRound(testGame(), 7, 'SR'))).toEqual(none)
  })

  it('allows everything in a manual game (Phase 1 behavior, P2-93)', () => {
    const manual = { ...testGame(), settings: { ...testGame().settings, live: false } }
    expect(actionsAllowed(manual)).toEqual({ stock: true, startCompany: true, dividend: true, issueRedeem: true, merge: true })
  })
})
