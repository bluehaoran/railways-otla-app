import { describe, expect, it } from 'vitest'
import { put, testGame, withRound } from './fixtures'
import { gateHints } from './gates'
import type { Game, Phase, RoundType } from './types'

const START = 'Companies start in the Stock Round'
const ROUND = 'Mergers happen in the Merger Round, from the green phase'
const PAIR = 'A merger needs two active minors and a major that has not started'

function live(type: RoundType, phase: Phase, minors: boolean): Game {
  let g = testGame(['A', 'B'])
  if (minors) {
    g = put(g, 'tunneling', { price: 70, president: 'p1', treasury: 3 })
    g = put(g, 'express', { price: 80, president: 'p2', treasury: 3 })
  }
  g = withRound(g, 1, type)
  return { ...g, settings: { ...g.settings, live: true, phase } }
}

describe('gateHints', () => {
  it('gives no hints in a manual game', () => {
    const g = { ...live('OR1', 'yellow', false) }
    g.settings = { ...g.settings, live: false }
    expect(gateHints(g)).toEqual({ start: null, merge: null })
  })

  it('explains Merge, not Start, in the Stock Round', () => {
    expect(gateHints(live('SR', 'yellow', true))).toEqual({ start: null, merge: ROUND })
  })

  it('explains Start in an Operating Round', () => {
    expect(gateHints(live('OR1', 'green', true)).start).toBe(START)
  })

  it('gives no hints in a Merger Round with a pair to merge', () => {
    expect(gateHints(live('MR', 'green', true))).toEqual({ start: START, merge: null })
  })

  it('names the missing minors in a green Merger Round', () => {
    expect(gateHints(live('MR', 'green', false)).merge).toBe(PAIR)
  })

  it('says the game is over in both hints', () => {
    const g = withRound(live('SR', 'green', true), 7, 'SR')
    expect(gateHints(g)).toEqual({ start: 'The game is over', merge: 'The game is over' })
  })

  it('points at the Merger Round in the yellow phase', () => {
    expect(gateHints(live('MR', 'yellow', true)).merge).toBe(ROUND)
  })
})
