import { describe, expect, it } from 'vitest'
import { applyDividend, dividendPlan } from './dividend'
import { put, testGame } from './fixtures'
import { priceOf } from './track'

const [J, K] = ['p1', 'p2']
/** A minor: J president (2), K 1 share, 1 in the treasury, 1 in the bank pool. */
const express = (price = 80) => put(testGame(), 'express', { price, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })

describe('dividendPlan payouts (spec D3 test 15)', () => {
  it('pays the worked example: J 48, K 24, treasury 24, bank 24', () => {
    const plan = dividendPlan(express(), 'express', 120, 'payout')
    expect(plan.players).toEqual({ [J]: 48, [K]: 24 })
    expect(plan.treasury).toBe(24)
    expect(plan.bank).toBe(24)
  })

  it('pays 62 per minor share on earnings of 310 (rulebook example)', () => {
    const plan = dividendPlan(express(), 'express', 310, 'payout')
    expect(plan.players).toEqual({ [J]: 124, [K]: 62 })
    expect(plan.treasury).toBe(62)
  })

  it('pays a tenth per major share and double for the president card', () => {
    const g = put(testGame(), 'federation', { price: 100, president: J, holdings: { [K]: 3 }, treasury: 4, market: 1 })
    const plan = dividendPlan(g, 'federation', 100, 'payout')
    expect(plan.players).toEqual({ [J]: 20, [K]: 30 })
    expect(plan.treasury).toBe(40)
    expect(plan.bank).toBe(10)
  })

  it('does not crash when the company has no president', () => {
    const g = put(testGame(), 'express', { price: 80, president: null, holdings: { [K]: 3 }, treasury: 2 })
    expect(dividendPlan(g, 'express', 50, 'payout').players).toEqual({ [K]: 30 })
  })
})

describe('dividendPlan price effect', () => {
  it.each([
    [30, 'payout', 0, 80],
    [80, 'payout', 1, 90],
    [150, 'payout', 1, 90],
    [160, 'payout', 2, 100],
    [120, 'withhold', -1, 70],
    [120, 'no-train', -1, 70],
  ] as const)('earnings %i, %s: %i steps to %i', (earnings, choice, steps, newPrice) => {
    const plan = dividendPlan(express(80), 'express', earnings, choice)
    expect(plan.steps).toBe(steps)
    expect(plan.newPrice).toBe(newPrice)
  })

  it('treats a payout of 0 as no train: price drops 1 and nobody is paid (rulebook p.11)', () => {
    const plan = dividendPlan(express(), 'express', 0, 'payout')
    expect(plan.choice).toBe('no-train')
    expect(plan.steps).toBe(-1)
    expect(plan.players).toEqual({})
  })

  it('withholds earnings into the treasury and pays nobody', () => {
    const plan = dividendPlan(express(), 'express', 120, 'withhold')
    expect(plan.players).toEqual({})
    expect(plan.treasury).toBe(120)
  })

  it('ignores the earnings for no train', () => {
    const plan = dividendPlan(express(), 'express', 999990, 'no-train')
    expect([plan.earnings, plan.treasury, plan.players]).toEqual([0, 0, {}])
  })

  it('stays at 500 on a rise (review focus 5)', () => {
    const g = put(testGame(), 'express', { price: 500, president: J, treasury: 3 })
    expect(dividendPlan(g, 'express', 1000, 'payout').newPrice).toBe(500)
  })

  it.each([125, -10, NaN, 15.5, Infinity])('rejects earnings of %s (review focus 2)', (earnings) => {
    expect(() => dividendPlan(express(), 'express', earnings, 'payout')).toThrow(RangeError)
  })

  it('rejects a company that is not active', () => {
    expect(() => dividendPlan(testGame(), 'express', 10, 'payout')).toThrow()
  })
})

describe('applyDividend', () => {
  it('credits players and the treasury, raises the price and marks the company as operated', () => {
    const g = express(80)
    const next = applyDividend(g, dividendPlan(g, 'express', 120, 'payout'))
    expect(next.players.map((p) => p.cash)).toEqual([48, 24])
    expect(next.companies.express.treasuryCash).toBe(24)
    expect(next.companies.express.ledger).toHaveLength(1)
    expect(next.companies.express.operated).toBe(true)
    expect(next.operating.acted).toEqual(['express'])
    expect(priceOf(next, 'express')).toBe(90)
  })

  it('puts a token that keeps its price at the back of its queue', () => {
    let g = express(80)
    g = put(g, 'tunneling', { price: 80, president: K, treasury: 3 })
    expect(g.track[8]).toEqual(['express', 'tunneling'])
    const next = applyDividend(g, dividendPlan(g, 'express', 30, 'payout'))
    expect(next.track[8]).toEqual(['tunneling', 'express'])
  })

  it('withholding adds the earnings to the treasury with a ledger entry and drops the price', () => {
    const g = express(80)
    const next = applyDividend(g, dividendPlan(g, 'express', 120, 'withhold'))
    expect(next.companies.express.treasuryCash).toBe(120)
    expect(next.players.map((p) => p.cash)).toEqual([0, 0])
    expect(priceOf(next, 'express')).toBe(70)
  })

  it('closes the company when the price reaches 0 (spec D3 test 19)', () => {
    const g = put(testGame(), 'express', { price: 10, president: J, holdings: { [K]: 1 }, treasury: 2 })
    const plan = dividendPlan(g, 'express', 50, 'withhold')
    expect(plan.newPrice).toBe(0)
    const next = applyDividend(g, plan)
    expect(next.companies.express.status).toBe('closed')
    expect(next.track.flat()).not.toContain('express')
  })

  it('refuses a company that already acted this Operating Round (review focus 3)', () => {
    const g = express(80)
    const once = applyDividend(g, dividendPlan(g, 'express', 120, 'payout'))
    expect(() => dividendPlan(once, 'express', 120, 'payout')).toThrow()
  })
})
