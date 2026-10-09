import { describe, expect, it } from 'vitest'
import { checkShareAction, issueShare, redeemShare } from './issue'
import { put, testGame } from './fixtures'
import { validate } from './shares'
import { priceOf } from './track'

const [J, K] = ['p1', 'p2']
const g110 = () => put(testGame(), 'express', { price: 110, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })

describe('issue (spec D3 test 18)', () => {
  it('gives the company 110, moves a share to the bank pool and drops the price to 100', () => {
    const next = issueShare(g110(), 'express')
    expect(next.companies.express.treasuryCash).toBe(110)
    expect(next.companies.express.treasuryShares).toBe(0)
    expect(next.companies.express.marketShares).toBe(2)
    expect(priceOf(next, 'express')).toBe(100)
    expect(next.companies.express.ledger).toHaveLength(1)
    expect(next.operating.issuedOrRedeemed).toEqual(['express'])
  })

  it('needs a share in the treasury', () => {
    const g = put(testGame(), 'express', { price: 110, president: J, holdings: { [K]: 3 }, market: 0 })
    expect(checkShareAction(g, 'express', 'issue')).toEqual({ ok: false, reason: 'no-treasury-share' })
    expect(() => issueShare(g, 'express')).toThrow()
  })

  it('warns, and does not block, when the bank pool would go over 50%', () => {
    const g = put(testGame(), 'express', { price: 110, president: J, holdings: { [K]: 1 }, treasury: 1, market: 2 })
    expect(checkShareAction(g, 'express', 'issue')).toEqual({ ok: true, overLimit: true })
    const next = issueShare(g, 'express')
    expect(validate(next).some((w) => w.code === 'market-limit')).toBe(true)
  })

  it('closes the company when the price drops to 0', () => {
    const g = put(testGame(), 'express', { price: 10, president: J, holdings: { [K]: 1 }, treasury: 2 })
    const next = issueShare(g, 'express')
    expect(next.companies.express.status).toBe('closed')
    expect(next.track.flat()).not.toContain('express')
  })
})

describe('redeem (spec D3 test 18)', () => {
  it('takes 110 from the treasury, moves a share back and keeps the price and queue place', () => {
    let g = g110()
    g = put(g, 'tunneling', { price: 110, president: K, treasury: 3 })
    g = { ...g, companies: { ...g.companies, express: { ...g.companies.express, treasuryCash: 200 } } }
    const next = redeemShare(g, 'express')
    expect(next.companies.express.treasuryCash).toBe(90)
    expect(next.companies.express.marketShares).toBe(0)
    expect(next.companies.express.treasuryShares).toBe(2)
    expect(priceOf(next, 'express')).toBe(110)
    expect(next.track[11]).toEqual(['express', 'tunneling'])
  })

  it('is rejected when the bank pool is empty', () => {
    const g = put(testGame(), 'express', { price: 110, president: J, holdings: { [K]: 1 }, treasury: 2 })
    expect(checkShareAction(g, 'express', 'redeem')).toEqual({ ok: false, reason: 'no-market-share' })
    expect(() => redeemShare(g, 'express')).toThrow()
  })
})

describe('one action per Operating Round (review focus 3, rulebook R1)', () => {
  it('refuses a second issue and a redeem after an issue', () => {
    const next = issueShare(g110(), 'express')
    expect(checkShareAction(next, 'express', 'issue')).toEqual({ ok: false, reason: 'already-acted' })
    expect(checkShareAction(next, 'express', 'redeem')).toEqual({ ok: false, reason: 'already-acted' })
  })

  it('refuses once the company has operated', () => {
    const g = { ...g110(), operating: { acted: ['express'], issuedOrRedeemed: [] } }
    expect(checkShareAction(g, 'express', 'issue')).toEqual({ ok: false, reason: 'already-operated' })
  })

  it('refuses a company that is not active', () => {
    expect(checkShareAction(testGame(), 'express', 'issue')).toEqual({ ok: false, reason: 'not-active' })
  })
})
