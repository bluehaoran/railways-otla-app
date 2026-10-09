import { describe, expect, it } from 'vitest'
import { addCash, manualEntry } from './treasury'
import { put, testGame, withRound } from './fixtures'
import { validate } from './shares'

const base = () => withRound(put(testGame(), 'express', { price: 80, president: 'p1', treasury: 3 }), 2, 'OR1')

describe('addCash', () => {
  it('adds to the treasury and records an automatic entry in the current round', () => {
    const g = addCash(base(), 'express', 80, 'Share bought')
    expect(g.companies.express.treasuryCash).toBe(80)
    expect(g.companies.express.ledger).toEqual([{ cycle: 2, round: 'OR1', what: 'Share bought', delta: 80, auto: true }])
  })

  it('records a negative delta and keeps a running balance', () => {
    let g = addCash(base(), 'express', 100, 'In')
    g = addCash(g, 'express', -40, 'Out')
    expect(g.companies.express.treasuryCash).toBe(60)
    expect(g.companies.express.ledger.map((e) => e.delta)).toEqual([100, -40])
  })

  it('does nothing for a zero delta', () => {
    const g = base()
    expect(addCash(g, 'express', 0, 'Nothing')).toBe(g)
  })

  it('does not change the input game', () => {
    const g = base()
    addCash(g, 'express', 10, 'x')
    expect(g.companies.express.treasuryCash).toBe(0)
    expect(g.companies.express.ledger).toEqual([])
  })
})

describe('manualEntry', () => {
  it('spends and receives with the reason as the text, marked as not automatic', () => {
    let g = manualEntry(base(), 'express', 'receive', 'Other', 200)
    g = manualEntry(g, 'express', 'spend', 'Train', 100)
    expect(g.companies.express.treasuryCash).toBe(100)
    expect(g.companies.express.ledger.map((e) => [e.what, e.delta, e.auto])).toEqual([
      ['Other', 200, false],
      ['Train', -100, false],
    ])
  })

  it.each([0, -5, NaN, Infinity, 12.5])('rejects the amount %s', (amount) => {
    expect(() => manualEntry(base(), 'express', 'spend', 'Train', amount)).toThrow(RangeError)
  })
})

describe('validate: negative treasury', () => {
  it('warns when a company treasury is below 0, and not at 0', () => {
    const g = base()
    expect(validate(g).some((w) => w.code === 'negative-treasury')).toBe(false)
    const spent = manualEntry(g, 'express', 'spend', 'Train', 30)
    const warning = validate(spent).find((w) => w.code === 'negative-treasury')
    expect(warning?.companyId).toBe('express')
  })
})
