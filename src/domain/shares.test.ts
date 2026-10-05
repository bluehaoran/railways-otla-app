import { describe, expect, it } from 'vitest'
import { MARKET_LIMIT, PLAYER_LIMIT, TOTAL_SHARES, UNIT_PCT, shareTotal, shares, validate } from './shares'
import { put, testGame } from './fixtures'

const [J, K] = ['p1', 'p2']
const codes = (g: ReturnType<typeof testGame>) => validate(g).map((w) => w.code)

describe('share constants', () => {
  it('match the spec', () => {
    expect(UNIT_PCT).toEqual({ minor: 0.2, major: 0.1 })
    expect(TOTAL_SHARES).toEqual({ minor: 5, major: 10 })
    expect(PLAYER_LIMIT).toEqual({ minor: 3, major: 6 })
    expect(MARKET_LIMIT).toEqual({ minor: 2, major: 5 })
  })
})

describe('shares', () => {
  it('counts the president card as 2', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [J]: 1, [K]: 1 }, treasury: 1 })
    expect(shares(g.companies.express, J)).toBe(3)
    expect(shares(g.companies.express, K)).toBe(1)
    expect(shares(g.companies.express, 'nobody')).toBe(0)
    expect(shareTotal(g.companies.express)).toBe(5)
  })
})

describe('validate', () => {
  it('returns nothing for a sound game', () => {
    let g = put(testGame(), 'express', { price: 80, president: J, treasury: 3 })
    g = put(g, 'union', { price: 100, president: K, holdings: { [J]: 2 }, treasury: 4, market: 2 })
    expect(validate(g)).toEqual([])
  })

  it('warns when shares do not total 100%', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, treasury: 2 })
    const w = validate(g)
    expect(w).toHaveLength(1)
    expect(w[0]).toMatchObject({ code: 'share-sum', companyId: 'express' })
    expect(w[0].message).toBe('Express: shares total 4 of 5')
  })

  it('warns above the 60% player limit: 4 of a minor, 7 of a major', () => {
    const minor = put(testGame(), 'express', { price: 80, president: J, holdings: { [J]: 2 }, treasury: 1 })
    expect(codes(minor)).toEqual(['player-limit'])
    const atLimit = put(testGame(), 'express', { price: 80, president: J, holdings: { [J]: 1 }, treasury: 2 })
    expect(codes(atLimit)).toEqual([])
    const major = put(testGame(), 'union', { price: 100, president: J, holdings: { [J]: 5 }, treasury: 3 })
    expect(codes(major)).toEqual(['player-limit'])
    const majorAtLimit = put(testGame(), 'union', { price: 100, president: J, holdings: { [J]: 4 }, treasury: 4 })
    expect(codes(majorAtLimit)).toEqual([])
  })

  it('warns above the 50% market limit: 3 of a minor, 6 of a major', () => {
    expect(codes(put(testGame(), 'express', { price: 80, president: J, market: 3 }))).toEqual(['market-limit'])
    expect(codes(put(testGame(), 'express', { price: 80, president: J, market: 2, treasury: 1 }))).toEqual([])
    expect(codes(put(testGame(), 'union', { price: 100, president: J, market: 6, treasury: 2 }))).toEqual(['market-limit'])
    expect(codes(put(testGame(), 'union', { price: 100, president: J, market: 5, treasury: 3 }))).toEqual([])
  })

  it('warns when the president is missing', () => {
    const g = put(testGame(), 'express', { price: 80, treasury: 5 })
    expect(codes(g)).toEqual(['no-president'])
  })

  it('warns when another player holds more than the president', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 3 } })
    const w = validate(g)
    expect(w.map((x) => x.code)).toEqual(['president-outvoted'])
    expect(w[0]).toMatchObject({ companyId: 'express', playerId: K })
    expect(w[0].message).toBe('Express: K has 3, president J has 2')
  })

  it('warns about negative cash', () => {
    const g = testGame()
    g.players[1].cash = -10
    expect(validate(g)).toEqual([{ code: 'negative-cash', playerId: K, message: 'K has negative cash' }])
  })

  it('ignores companies that are not active', () => {
    const g = testGame()
    g.companies.express = { ...g.companies.express, status: 'closed', treasuryShares: 1 }
    expect(validate(g)).toEqual([])
  })
})
