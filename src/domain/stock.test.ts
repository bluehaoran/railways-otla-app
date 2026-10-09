import { describe, expect, it } from 'vitest'
import { applyTurn, planTurn } from './stock'
import { put, testGame } from './fixtures'
import { setCash } from './edit'
import { priceOf } from './track'

const [J, K] = ['p1', 'p2']

/** J presides over two minors. K holds 1 share of each and has 500 cash. */
function base() {
  let g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 1 }, treasury: 2 })
  g = put(g, 'tunneling', { price: 70, president: J, holdings: { [K]: 1 }, treasury: 2 })
  return setCash(g, K, 500)
}

describe('selling (spec D3 test 16)', () => {
  it('drops each company sold by 1 and pays the price before the drop', () => {
    const turn = { playerId: K, sells: { express: 1, tunneling: 1 } }
    const plan = planTurn(base(), turn)
    expect(plan.problems).toEqual([])
    expect(plan.cashBefore).toBe(500)
    expect(plan.cashAfter).toBe(650)
    expect(plan.sold).toEqual(['express', 'tunneling'])
    const next = applyTurn(base(), turn)
    expect(priceOf(next, 'express')).toBe(70)
    expect(priceOf(next, 'tunneling')).toBe(60)
    expect(next.players.find((p) => p.id === K)?.cash).toBe(650)
    expect(next.companies.express.marketShares).toBe(1)
    expect(next.companies.express.holdings[K]).toBe(0)
  })

  it('drops a company once when several of its shares are sold', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 2 }, treasury: 1 })
    const next = applyTurn(g, { playerId: K, sells: { express: 2 } })
    expect(priceOf(next, 'express')).toBe(70)
    expect(next.players.find((p) => p.id === K)?.cash).toBe(160)
    expect(next.companies.express.marketShares).toBe(2)
  })

  it('cannot sell the president card', () => {
    const plan = planTurn(base(), { playerId: J, sells: { express: 1 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['not-held'])
  })

  it('cannot sell more than held', () => {
    const plan = planTurn(base(), { playerId: K, sells: { express: 2 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['not-held'])
  })

  it('cannot sell a minor that has not operated yet', () => {
    const g = base()
    const fresh = { ...g, companies: { ...g.companies, tunneling: { ...g.companies.tunneling, operated: false } } }
    const plan = planTurn(fresh, { playerId: K, sells: { tunneling: 1 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['not-operated'])
  })

  it('cannot take the bank pool above 50%', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 1 }, market: 2, treasury: 0 })
    const plan = planTurn(g, { playerId: K, sells: { express: 1 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['market-full'])
  })

  it('rejects a count that is not a whole number above 0', () => {
    const plan = planTurn(base(), { playerId: K, sells: { express: 1.5 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['bad-count'])
  })

  it('rejects a company that is not active', () => {
    const plan = planTurn(base(), { playerId: K, sells: { adaptive: 1 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['not-active'])
  })

  it('ignores a company with a count of 0', () => {
    const plan = planTurn(base(), { playerId: K, sells: { express: 0 } })
    expect(plan.problems).toEqual([])
    expect(plan.sold).toEqual([])
  })

  it('records what the player sold for the rest of the Stock Round', () => {
    const next = applyTurn(base(), { playerId: K, sells: { express: 1 } })
    expect(next.soldThisRound).toEqual({ [K]: ['express'] })
    const again = applyTurn(next, { playerId: K, sells: { tunneling: 1 } })
    expect(again.soldThisRound[K]).toEqual(['express', 'tunneling'])
  })

  it('closes a company whose price drops to 0, after the turn (spec D3 test 19)', () => {
    const g = setCash(put(testGame(), 'express', { price: 10, president: J, holdings: { [K]: 1 }, treasury: 2 }), K, 500)
    const turn = { playerId: K, sells: { express: 1 } }
    const plan = planTurn(g, turn)
    expect(plan.closes).toEqual(['express'])
    expect(plan.cashAfter).toBe(510)
    const next = applyTurn(g, turn)
    expect(next.companies.express.status).toBe('closed')
    expect(next.track.flat()).not.toContain('express')
    expect(next.players.find((p) => p.id === K)?.cash).toBe(510)
  })

  it('leaves the game untouched when there is a problem (review focus 1)', () => {
    const g = base()
    const turn = { playerId: K, sells: { express: 1, tunneling: 5 } }
    const plan = planTurn(g, turn)
    expect(plan.problems).toHaveLength(1)
    expect(plan.game).toBe(g)
    expect(plan.cashAfter).toBe(plan.cashBefore)
    expect(() => applyTurn(g, turn)).toThrow()
  })

  it('moves the presidency when a sale leaves another player with more shares (P2-91)', () => {
    const g = put(testGame(), 'federation', { price: 100, president: J, holdings: { [J]: 4, [K]: 4 } })
    const turn = { playerId: J, sells: { federation: 3 } }
    const plan = planTurn(g, turn)
    expect(plan.presidency).toEqual([{ companyId: 'federation', from: J, to: K }])
    const next = applyTurn(g, turn)
    expect(next.companies.federation.president).toBe(K)
    expect(next.companies.federation.holdings).toEqual({ [J]: 3, [K]: 2 })
  })
})

describe('buying (spec D3 test 16)', () => {
  it('buys from the treasury: the price goes to the company treasury with a ledger entry', () => {
    const turn = { playerId: K, sells: {}, buy: { companyId: 'tunneling', source: 'treasury' as const } }
    const next = applyTurn(base(), turn)
    expect(next.players.find((p) => p.id === K)?.cash).toBe(430)
    expect(next.companies.tunneling.holdings[K]).toBe(2)
    expect(next.companies.tunneling.treasuryShares).toBe(1)
    expect(next.companies.tunneling.treasuryCash).toBe(70)
    expect(next.companies.tunneling.ledger).toHaveLength(1)
  })

  it('buys from the bank pool: the price goes to the bank, not to a treasury', () => {
    let g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
    g = setCash(g, K, 100)
    const next = applyTurn(g, { playerId: K, sells: {}, buy: { companyId: 'express', source: 'market' } })
    expect(next.players.find((p) => p.id === K)?.cash).toBe(20)
    expect(next.companies.express.marketShares).toBe(0)
    expect(next.companies.express.treasuryCash).toBe(0)
    expect(next.companies.express.ledger).toEqual([])
  })

  it('refuses a source with nothing in it', () => {
    const plan = planTurn(base(), { playerId: K, sells: {}, buy: { companyId: 'express', source: 'market' } })
    expect(plan.problems.map((p) => p.code)).toEqual(['nothing-to-buy'])
  })

  it('refuses a fourth share of a minor (60% limit)', () => {
    const g = setCash(put(testGame(), 'express', { price: 80, president: null, holdings: { [K]: 3 }, treasury: 1, market: 1 }), K, 500)
    const plan = planTurn(g, { playerId: K, sells: {}, buy: { companyId: 'express', source: 'treasury' } })
    expect(plan.problems.map((p) => p.code)).toEqual(['player-limit'])
  })

  it('refuses a company sold in the same turn', () => {
    const plan = planTurn(base(), {
      playerId: K,
      sells: { express: 1 },
      buy: { companyId: 'express', source: 'treasury' },
    })
    expect(plan.problems.map((p) => p.code)).toEqual(['sold-this-round'])
  })

  it('refuses a company sold in an earlier turn of this Stock Round', () => {
    const g = { ...base(), soldThisRound: { [K]: ['express'] } }
    const plan = planTurn(g, { playerId: K, sells: {}, buy: { companyId: 'express', source: 'treasury' } })
    expect(plan.problems.map((p) => p.code)).toEqual(['sold-this-round'])
  })

  it('refuses when the player cannot pay', () => {
    const g = setCash(base(), K, 50)
    const plan = planTurn(g, { playerId: K, sells: {}, buy: { companyId: 'tunneling', source: 'treasury' } })
    expect(plan.problems.map((p) => p.code)).toEqual(['no-cash'])
  })

  it('lets the cash from this turn’s sale pay for the purchase', () => {
    const g = setCash(base(), K, 50)
    const next = applyTurn(g, { playerId: K, sells: { express: 1 }, buy: { companyId: 'tunneling', source: 'treasury' } })
    expect(next.players.find((p) => p.id === K)?.cash).toBe(60)
    expect(next.soldThisRound).toEqual({ [K]: ['express'] })
  })

  it('moves the presidency when a purchase leaves another player with more shares (P2-91)', () => {
    const g = setCash(
      put(testGame(), 'federation', { price: 100, president: J, holdings: { [J]: 2, [K]: 4 }, treasury: 1, market: 1 }),
      K,
      500,
    )
    const turn = { playerId: K, sells: {}, buy: { companyId: 'federation', source: 'treasury' as const } }
    const plan = planTurn(g, turn)
    expect(plan.presidency).toEqual([{ companyId: 'federation', from: J, to: K }])
    const next = applyTurn(g, turn)
    expect(next.companies.federation.president).toBe(K)
    expect(next.companies.federation.holdings).toEqual({ [J]: 4, [K]: 3 })
    expect(next.players.find((p) => p.id === K)?.cash).toBe(400)
  })

  it('does not apply a sale when the purchase has a problem (review focus 1)', () => {
    const g = base()
    const turn = { playerId: K, sells: { express: 1 }, buy: { companyId: 'express', source: 'treasury' as const } }
    expect(planTurn(g, turn).game).toBe(g)
    expect(() => applyTurn(g, turn)).toThrow()
  })
})
