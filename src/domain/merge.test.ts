import { describe, expect, it } from 'vitest'
import { activeMinors, applyMerge, canMerge, mergePlan, unstartedMajors } from './merge'
import { validate } from './shares'
import { priceOf } from './track'
import { put, testGame } from './fixtures'

const [J, K] = ['p1', 'p2']

/** Spec D3 test 7. A is Tunneling at 70, B is Express at 80. */
function test7() {
  let g = put(testGame(), 'tunneling', { price: 70, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
  g = put(g, 'express', { price: 80, president: K, holdings: { [J]: 1, [K]: 1 }, treasury: 1 })
  return g
}

describe('mergePlan', () => {
  it('converts shares 1 to 1 and gives the presidency to the largest holder (spec D3 test 7)', () => {
    const plan = mergePlan(test7(), 'tunneling', 'express', 'union')
    expect(plan.shares).toEqual({ [J]: 3, [K]: 4 })
    expect(plan.newPresident).toBe(K)
    expect(plan.needsChoice).toBe(false)
    expect(plan.reason).toBe('most-shares')
    expect(plan.holdings).toEqual({ [J]: 3, [K]: 2 })
    expect(plan.treasuryShares).toBe(2)
    expect(plan.marketShares).toBe(1)
    expect(plan.total).toBe(10)
    expect(plan.price).toBe(70)
  })

  it('breaks a tie with the president of the minor that acts first (spec D3 test 8)', () => {
    const [H, A, Jo, Ja] = ['p1', 'p2', 'p3', 'p4']
    let g = testGame(['H', 'A', 'Jo', 'Ja'])
    g = put(g, 'tunneling', { price: 90, president: Ja, holdings: { [A]: 1 }, treasury: 1, market: 1 })
    g = put(g, 'agricultural', { price: 70, president: A, holdings: { [Ja]: 1 }, market: 2 })
    const plan = mergePlan(g, 'agricultural', 'tunneling', 'federation')
    expect(plan.tiedPlayers).toEqual([A, Ja])
    expect(plan.newPresident).toBe(Ja)
    expect(plan.reason).toBe('tie-break')
    expect(plan.decidingCompany).toBe('tunneling')
    expect(plan.holdings).toEqual({ [A]: 3, [Ja]: 1 })
    expect(plan.price).toBe(80)
    expect(plan.total).toBe(10)
    expect(H).toBe('p1')
    expect(Jo).toBe('p3')
  })

  it('uses queue order for the tie-break when both minors are at one price', () => {
    let g = put(testGame(), 'express', { price: 80, president: K, treasury: 3 })
    g = put(g, 'tunneling', { price: 80, president: J, treasury: 3 })
    expect(mergePlan(g, 'tunneling', 'express', 'union').newPresident).toBe(K)
  })

  it('needs a choice when the tied players preside over neither minor (spec D3 test 8)', () => {
    const [H, A, Jo, Ja] = ['p1', 'p2', 'p3', 'p4']
    let g = testGame(['H', 'A', 'Jo', 'Ja'])
    g = put(g, 'resourceful', { price: 60, president: H, holdings: { [Jo]: 3 } })
    g = put(g, 'express', { price: 110, president: A, holdings: { [Ja]: 3 } })
    const open = mergePlan(g, 'resourceful', 'express', 'federation')
    expect(open.needsChoice).toBe(true)
    expect(open.newPresident).toBeNull()
    expect(open.reason).toBe('needs-choice')
    expect(open.tiedPlayers).toEqual([Jo, Ja])
    expect(open.price).toBe(80)
    expect(open.total).toBe(10)
    expect(() => applyMerge(g, open)).toThrow()

    const chosen = mergePlan(g, 'resourceful', 'express', 'federation', { president: Ja })
    expect(chosen.needsChoice).toBe(false)
    expect(chosen.reason).toBe('chosen')
    expect(chosen.newPresident).toBe(Ja)
    expect(chosen.holdings).toEqual({ [H]: 2, [A]: 2, [Jo]: 3, [Ja]: 1 })
    expect(chosen.total).toBe(10)

    const notTied = mergePlan(g, 'resourceful', 'express', 'federation', { president: H })
    expect(notTied.needsChoice).toBe(true)
  })

  it('rejects the wrong kinds of company', () => {
    const g = test7()
    expect(() => mergePlan(g, 'tunneling', 'tunneling', 'union')).toThrow()
    expect(() => mergePlan(g, 'tunneling', 'suburban', 'union')).toThrow()
    expect(() => mergePlan(g, 'tunneling', 'express', 'suburban')).toThrow()
    const started = applyMerge(g, mergePlan(g, 'tunneling', 'express', 'union'))
    expect(() => mergePlan(started, 'tunneling', 'express', 'union')).toThrow()
  })

  // Review Focus 5: share counts broken in edit mode.
  it('never produces a negative share count, and reports a total that is not 10', () => {
    let g = put(testGame(), 'tunneling', { price: 70, treasury: 5 })
    g = put(g, 'express', { price: 80, treasury: 5 })
    const open = mergePlan(g, 'tunneling', 'express', 'union')
    expect(open.needsChoice).toBe(true)
    const plan = mergePlan(g, 'tunneling', 'express', 'union', { president: J })
    expect(Object.values(plan.holdings).every((n) => n >= 0)).toBe(true)
    expect(plan.total).toBe(12)
    const merged = applyMerge(g, plan)
    expect(validate(merged).map((w) => w.code)).toEqual(['share-sum'])
  })
})

describe('applyMerge', () => {
  it('starts the major at the back of its queue and retires both minors', () => {
    let g = test7()
    g = put(g, 'suburban', { price: 70, president: J, treasury: 3 })
    const merged = applyMerge(g, mergePlan(g, 'tunneling', 'express', 'union', { identity: 0 }))
    expect(merged.companies.union).toEqual({
      id: 'union',
      status: 'active',
      president: K,
      holdings: { [J]: 3, [K]: 2 },
      treasuryShares: 2,
      marketShares: 1,
      identity: 0,
    })
    expect(merged.track[7]).toEqual(['suburban', 'union'])
    expect(priceOf(merged, 'tunneling')).toBeNull()
    expect(merged.companies.tunneling.status).toBe('merged')
    expect(merged.companies.express.status).toBe('merged')
    expect(merged.companies.express.holdings).toEqual({})
    expect(validate(merged)).toEqual([])
    expect(g.companies.union.status).toBe('unstarted')
  })

  it('stores the chosen name of the major', () => {
    const g = test7()
    const merged = applyMerge(g, mergePlan(g, 'tunneling', 'express', 'system', { identity: 1 }))
    expect(merged.companies.system.identity).toBe(1)
  })
})

describe('merge availability', () => {
  it('needs 2 active minors and 1 unstarted major', () => {
    expect(canMerge(testGame())).toBe(false)
    expect(canMerge(put(testGame(), 'express', { price: 80 }))).toBe(false)
    const g = test7()
    expect(canMerge(g)).toBe(true)
    expect(activeMinors(g)).toEqual(['express', 'tunneling'])
    expect(unstartedMajors(g)).toHaveLength(6)
  })
})
