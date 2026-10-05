import { describe, expect, it } from 'vitest'
import { presidencyCandidate, transferPresidency } from './presidency'
import { shares } from './shares'
import { playerTotal } from './scoring'
import { put, testGame } from './fixtures'

const [J, K, L] = ['p1', 'p2', 'p3']

describe('presidencyCandidate', () => {
  it('returns the player with strictly more shares than the president (spec D3 test 9)', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 3 } })
    expect(presidencyCandidate(g, 'express')).toBe(K)
  })

  it('returns null when the president has the most or ties for the most', () => {
    const tie = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 2 }, treasury: 1 })
    expect(presidencyCandidate(tie, 'express')).toBeNull()
    const lead = put(testGame(), 'express', { price: 80, president: J, holdings: { [J]: 1, [K]: 2 } })
    expect(presidencyCandidate(lead, 'express')).toBeNull()
  })

  it('returns null when there is no president', () => {
    const g = put(testGame(), 'express', { price: 80, holdings: { [K]: 3 } })
    expect(presidencyCandidate(g, 'express')).toBeNull()
  })

  it('picks the next tied player clockwise from the old president', () => {
    const fromJ = put(testGame(['J', 'K', 'L']), 'union', { price: 100, president: J, holdings: { [K]: 3, [L]: 3 }, treasury: 2 })
    expect(presidencyCandidate(fromJ, 'union')).toBe(K)
    const fromK = put(testGame(['J', 'K', 'L']), 'union', { price: 100, president: K, holdings: { [J]: 3, [L]: 3 }, treasury: 2 })
    expect(presidencyCandidate(fromK, 'union')).toBe(L)
  })
})

describe('transferPresidency', () => {
  it('swaps the president card for 2 regular cards and keeps every total', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 3 } })
    const after = transferPresidency(g, 'express', K)
    expect(after.companies.express.president).toBe(K)
    expect(after.companies.express.holdings).toEqual({ [J]: 2, [K]: 1 })
    expect(shares(after.companies.express, J)).toBe(2)
    expect(shares(after.companies.express, K)).toBe(3)
    expect(playerTotal(after, J)).toBe(playerTotal(g, J))
    expect(playerTotal(after, K)).toBe(playerTotal(g, K))
    expect(g.companies.express.president).toBe(J)
  })

  it('rejects a new president with fewer than 2 regular cards', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 1 }, treasury: 2 })
    expect(() => transferPresidency(g, 'express', K)).toThrow()
  })
})
