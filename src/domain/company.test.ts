import { describe, expect, it } from 'vitest'
import { closeCompany, startCompany } from './company'
import { validate } from './shares'
import { put, testGame } from './fixtures'

const [J, K] = ['p1', 'p2']

describe('startCompany', () => {
  it('gives the president card to the player and 3 shares to the treasury', () => {
    const g = startCompany(testGame(), 'express', K, 80)
    expect(g.companies.express).toEqual({
      id: 'express',
      status: 'active',
      president: K,
      holdings: {},
      treasuryShares: 3,
      marketShares: 0,
    })
    expect(g.track[8]).toEqual(['express'])
    expect(validate(g)).toEqual([])
  })

  it('joins the back of the queue', () => {
    let g = startCompany(testGame(), 'express', J, 80)
    g = startCompany(g, 'tunneling', K, 80)
    expect(g.track[8]).toEqual(['express', 'tunneling'])
  })

  it('does not change cash in Phase 1', () => {
    const g = startCompany(testGame(), 'express', J, 80)
    expect(g.players.map((p) => p.cash)).toEqual([0, 0])
  })

  it('rejects a major, a started company, an unknown player, and an off-track price', () => {
    const g = startCompany(testGame(), 'express', J, 80)
    expect(() => startCompany(g, 'union', J, 80)).toThrow()
    expect(() => startCompany(g, 'express', J, 80)).toThrow()
    expect(() => startCompany(g, 'tunneling', 'p9', 80)).toThrow()
    expect(() => startCompany(g, 'tunneling', J, 85)).toThrow()
    expect(() => startCompany(g, 'tunneling', J, 0)).toThrow()
  })
})

describe('closeCompany', () => {
  it('clears the shares and takes the token off the track', () => {
    let g = put(testGame(), 'express', { price: 10, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
    g = put(g, 'tunneling', { price: 10, president: K, treasury: 3 })
    const closed = closeCompany(g, 'express')
    expect(closed.companies.express).toEqual({
      id: 'express',
      status: 'closed',
      president: null,
      holdings: {},
      treasuryShares: 0,
      marketShares: 0,
    })
    expect(closed.track[1]).toEqual(['tunneling'])
    expect(g.track[1]).toEqual(['express', 'tunneling'])
  })
})
