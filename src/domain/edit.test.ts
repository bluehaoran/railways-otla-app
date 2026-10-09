import { describe, expect, it } from 'vitest'
import {
  canChangeShortGame,
  renameGame,
  setCash,
  setHolding,
  setLive,
  setMainView,
  setMarketShares,
  setPhase,
  setPresident,
  setShortGame,
  setTreasuryShares,
} from './edit'
import { startCompany } from './company'
import { put, testGame } from './fixtures'

const [J, K] = ['p1', 'p2']

describe('setCash', () => {
  it('sets a whole number and allows a negative value', () => {
    expect(setCash(testGame(), J, 142).players[0].cash).toBe(142)
    expect(setCash(testGame(), J, -5).players[0].cash).toBe(-5)
    expect(setCash(testGame(), J, 10.6).players[0].cash).toBe(11)
  })

  // Review Focus 1: a cleared input reports null.
  it('treats a cleared or non-number value as 0', () => {
    const g = setCash(testGame(), J, 300)
    expect(setCash(g, J, null).players[0].cash).toBe(0)
    expect(setCash(g, J, Number.NaN).players[0].cash).toBe(0)
    expect(setCash(g, J, undefined as unknown as number).players[0].cash).toBe(0)
  })
})

describe('share setters', () => {
  const base = () => put(testGame(), 'express', { price: 80, president: J, treasury: 3 })

  it('set regular cards, treasury and market counts', () => {
    let g = setHolding(base(), 'express', K, 2)
    g = setTreasuryShares(g, 'express', 1)
    g = setMarketShares(g, 'express', 1)
    expect(g.companies.express.holdings).toEqual({ [K]: 2 })
    expect(g.companies.express.treasuryShares).toBe(1)
    expect(g.companies.express.marketShares).toBe(1)
  })

  it('never go below 0 and treat a cleared value as 0', () => {
    expect(setHolding(base(), 'express', K, -1).companies.express.holdings[K]).toBe(0)
    expect(setTreasuryShares(base(), 'express', null).companies.express.treasuryShares).toBe(0)
    expect(setMarketShares(base(), 'express', Number.NaN).companies.express.marketShares).toBe(0)
  })

  it('set or clear the president without moving any cards', () => {
    expect(setPresident(base(), 'express', K).companies.express.president).toBe(K)
    expect(setPresident(base(), 'express', null).companies.express.president).toBeNull()
    expect(setPresident(base(), 'express', K).companies.express.holdings).toEqual({})
  })
})

describe('settings', () => {
  it('turns live mode on and off without touching anything else', () => {
    const g = testGame()
    const off = setLive(g, false)
    expect(off.settings.live).toBe(false)
    expect({ ...off, settings: { ...off.settings, live: true } }).toEqual(g)
  })

  it('sets the phase, the main view and the name', () => {
    expect(setPhase(testGame(), 'green').settings.phase).toBe('green')
    expect(setMainView(testGame(), 'scoreboard').settings.mainView).toBe('scoreboard')
    expect(renameGame(testGame(), '  Friday  ').name).toBe('Friday')
    expect(renameGame(testGame(), '   ').name).toBe('Test')
  })

  it('switches to a Short Game before the first company starts', () => {
    const short = setShortGame(testGame(), true)
    expect(short.settings.shortGame).toBe(true)
    expect(['adaptive', 'overnight', 'bridging', 'spacious'].map((id) => short.companies[id].status)).toEqual([
      'unavailable', 'unavailable', 'unavailable', 'unavailable',
    ])
    const long = setShortGame(short, false)
    expect(long.companies.adaptive.status).toBe('unstarted')
  })

  it('locks the Short Game flag once a company has started', () => {
    const g = startCompany(testGame(), 'express', J, 80, 120)
    expect(canChangeShortGame(testGame())).toBe(true)
    expect(canChangeShortGame(g)).toBe(false)
    expect(() => setShortGame(g, true)).toThrow()
  })
})

describe('share setters and saved games', () => {
  it('cap a count at 99, the most a saved game accepts', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, treasury: 3 })
    expect(setTreasuryShares(g, 'express', 500).companies.express.treasuryShares).toBe(99)
    expect(setHolding(g, 'express', K, 100).companies.express.holdings[K]).toBe(99)
  })
})
