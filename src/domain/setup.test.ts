import { describe, expect, it } from 'vitest'
import { STARTING_CASH, defaultShortGame, newGame } from './setup'
import { displayName } from './companies'

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Player ${i + 1}`, code: `P${i + 1}`, cash: STARTING_CASH[n] }))

describe('setup', () => {
  it('uses the starting cash table', () => {
    expect([STARTING_CASH[2], STARTING_CASH[3], STARTING_CASH[4], STARTING_CASH[5]]).toEqual([450, 300, 275, 220])
  })

  it('defaults 2 players to Short and 3 to 5 players to Long', () => {
    expect([2, 3, 4, 5].map(defaultShortGame)).toEqual([true, false, false, false])
  })

  it('creates an empty game with ids p1..pn and 27 empty queues', () => {
    const g = newGame({ name: 'Friday game', players: players(3), shortGame: false, phase: 'yellow' }, 'g1', '2026-10-05T00:00:00.000Z')
    expect(g.schemaVersion).toBe(1)
    expect(g.id).toBe('g1')
    expect(g.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(g.players.map((p) => p.cash)).toEqual([300, 300, 300])
    expect(g.track).toHaveLength(27)
    expect(g.track.every((q) => q.length === 0)).toBe(true)
    expect(g.settings).toEqual({ shortGame: false, phase: 'yellow', mainView: 'track' })
    expect(Object.keys(g.companies)).toHaveLength(18)
    expect(Object.values(g.companies).every((c) => c.status === 'unstarted')).toBe(true)
  })

  it('marks four minors unavailable in a Short Game and keeps all majors', () => {
    const g = newGame({ name: 'Short', players: players(2), shortGame: true, phase: 'yellow' })
    const unavailable = Object.values(g.companies).filter((c) => c.status === 'unavailable').map((c) => c.id)
    expect(unavailable.sort()).toEqual(['adaptive', 'bridging', 'overnight', 'spacious'])
    expect(g.companies.consortium.status).toBe('unstarted')
  })

  it('gives each new game a different id', () => {
    const opts = { name: 'A', players: players(2), shortGame: true, phase: 'yellow' as const }
    expect(newGame(opts).id).not.toBe(newGame(opts).id)
  })

  it('names a major by its chosen identity', () => {
    const g = newGame({ name: 'A', players: players(2), shortGame: true, phase: 'yellow' })
    expect(displayName(g.companies.system)).toBe('System')
    expect(displayName({ ...g.companies.system, identity: 1 })).toBe('Syndicate')
    expect(displayName({ ...g.companies.federation, identity: 1 })).toBe('Federation')
    expect(displayName(g.companies.easternMining)).toBe('Eastern Mining')
  })
})
