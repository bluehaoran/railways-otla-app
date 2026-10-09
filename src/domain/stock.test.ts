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
