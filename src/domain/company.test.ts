import { describe, expect, it } from 'vitest'
import { closeCompany, startCompany } from './company'
import { validate } from './shares'
import { put, testGame } from './fixtures'

const [J, K] = ['p1', 'p2']

describe('startCompany', () => {
  it('gives the president card to the player and 3 shares to the treasury', () => {
    const g = startCompany(testGame(), 'express', K, 80, 120)
    expect(g.companies.express).toEqual({
      id: 'express',
      status: 'active',
      president: K,
      holdings: {},
      treasuryShares: 3,
      marketShares: 0,
    })
    expect(g.track[8]).toEqual(['express'])
    expect(validate(g).filter((w) => w.companyId)).toEqual([])
  })

  it('joins the back of the queue', () => {
    let g = startCompany(testGame(), 'express', J, 80, 120)
    g = startCompany(g, 'tunneling', K, 80, 120)
    expect(g.track[8]).toEqual(['express', 'tunneling'])
  })

  it('deducts the winning bid from the president’s cash', () => {
    const rich = { ...testGame(), players: testGame().players.map((p) => ({ ...p, cash: 275 })) }
    const g = startCompany(rich, 'express', J, 80, 160)
    expect(g.players.map((p) => p.cash)).toEqual([115, 275])
    expect(rich.players[0].cash).toBe(275)
  })

  it('lets cash go negative, which validation then flags', () => {
    const g = startCompany(testGame(), 'express', J, 60, 120)
    expect(g.players[0].cash).toBe(-120)
    expect(validate(g).map((w) => w.code)).toEqual(['negative-cash'])
  })

  it('rejects a bid that is not a number or is negative', () => {
    expect(() => startCompany(testGame(), 'express', J, 80, Number.NaN)).toThrow()
    expect(() => startCompany(testGame(), 'express', J, 80, -5)).toThrow()
  })

  it('rejects a major, a started company, an unknown player, and an off-track price', () => {
    const g = startCompany(testGame(), 'express', J, 80, 120)
    expect(() => startCompany(g, 'union', J, 80, 120)).toThrow()
    expect(() => startCompany(g, 'express', J, 80, 120)).toThrow()
    expect(() => startCompany(g, 'tunneling', 'p9', 80, 120)).toThrow()
    expect(() => startCompany(g, 'tunneling', J, 85, 120)).toThrow()
    expect(() => startCompany(g, 'tunneling', J, 0, 120)).toThrow()
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
