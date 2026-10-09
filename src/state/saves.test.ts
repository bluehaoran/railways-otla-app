import { describe, expect, it } from 'vitest'
import { ImportError, checkGame, createSaves, exportFileName, exportGame, importGame } from './saves'
import { memoryStorage } from './memoryStorage'
import { legacyV1Game, put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

function sample(id = 'g1', name = 'Friday game'): Game {
  const g = put(testGame(['Haoran', 'Ari']), 'express', { price: 80, president: 'p1', treasury: 3 })
  return { ...g, id, name }
}

const save = (game: Game, undo: Game[] = [], redo: Game[] = []) => ({ schemaVersion: 2 as const, game, undo, redo })

describe('export and import (spec D3 test 14)', () => {
  it('returns an equal game', () => {
    const g = sample()
    expect(importGame(exportGame(g), [])).toEqual(g)
  })

  it('wraps the game with its schema version', () => {
    expect(JSON.parse(exportGame(sample()))).toEqual({ schemaVersion: 2, game: sample() })
  })

  it('assigns a new id when the id already exists', () => {
    const g = sample('g1')
    const imported = importGame(exportGame(g), ['g1'])
    expect(imported.id).not.toBe('g1')
    expect({ ...imported, id: 'g1' }).toEqual(g)
  })

  it('rejects an unknown schema version with a clear message', () => {
    const text = JSON.stringify({ schemaVersion: 3, game: sample() })
    expect(() => importGame(text, [])).toThrow(ImportError)
    expect(() => importGame(text, [])).toThrow('version 3')
  })

  it('names the export file after the game', () => {
    expect(exportFileName(sample('g1', 'Friday game!'))).toBe('friday-game.lost-atlas.json')
    expect(exportFileName(sample('g1', '???'))).toBe('game.lost-atlas.json')
  })
})

// Review Focus 3.
describe('import of a bad file', () => {
  it('rejects text that is not JSON', () => {
    expect(() => importGame('not json at all', [])).toThrow('not valid JSON')
  })

  it('rejects JSON that is not an export', () => {
    expect(() => importGame('{"foo":1}', [])).toThrow(ImportError)
    expect(() => importGame('[1,2,3]', [])).toThrow(ImportError)
    expect(() => importGame('null', [])).toThrow(ImportError)
  })

  it('names the missing field of a hand-edited export', () => {
    const data = JSON.parse(exportGame(sample()))
    delete data.game.players
    expect(() => importGame(JSON.stringify(data), [])).toThrow('players')
  })

  it('leaves saved games unchanged', () => {
    const saves = createSaves(memoryStorage())
    saves.write(save(sample()))
    expect(() => saves.importText('{"schemaVersion":1,"game":{}}')).toThrow(ImportError)
    expect(saves.index.value).toHaveLength(1)
    expect(saves.read('g1')?.game).toEqual(sample())
  })
})

describe('checkGame', () => {
  it('accepts a sound game', () => {
    expect(checkGame(sample())).toBeNull()
  })

  it('reports the first bad field', () => {
    const base = sample()
    expect(checkGame({ ...base, name: 5 })).toBe('name')
    expect(checkGame({ ...base, track: base.track.slice(1) })).toBe('track')
    expect(checkGame({ ...base, players: [base.players[0]] })).toBe('players')
    expect(checkGame({ ...base, settings: { ...base.settings, phase: 'blue' } })).toBe('settings.phase')
    const cash = { ...base, players: [{ ...base.players[0], cash: 'lots' }, base.players[1]] }
    expect(checkGame(cash)).toBe('players')
    const ghost = { ...base, companies: { ...base.companies, express: { ...base.companies.express, president: 'p9' } } }
    expect(checkGame(ghost)).toBe('companies.express')
    const offTrack = { ...base, track: base.track.map(() => []) }
    expect(checkGame(offTrack)).toBe('companies.express.status')
  })
})

describe('saved games', () => {
  it('writes and reads a game with its history', () => {
    const saves = createSaves(memoryStorage())
    const g = sample()
    expect(saves.write(save(g, [testGame()], []))).toEqual({ ok: true, kept: 1 })
    expect(saves.read('g1')).toEqual(save(g, [testGame()], []))
  })

  it('keeps an index with the most recent save first', () => {
    const saves = createSaves(memoryStorage())
    saves.write(save(sample('g1', 'One')))
    saves.write(save(sample('g2', 'Two')))
    saves.write(save(sample('g1', 'One again')))
    expect(saves.index.value.map((e) => [e.id, e.name])).toEqual([['g1', 'One again'], ['g2', 'Two']])
    expect(saves.index.value[0].playerNames).toEqual(['Haoran', 'Ari'])
  })

  it('shares the index between instances on one storage', () => {
    const storage = memoryStorage()
    createSaves(storage).write(save(sample()))
    expect(createSaves(storage).index.value).toHaveLength(1)
  })

  it('renames, duplicates and removes', () => {
    const saves = createSaves(memoryStorage())
    saves.write(save(sample('g1', 'One'), [testGame()]))
    saves.rename('g1', 'Uno')
    expect(saves.read('g1')?.game.name).toBe('Uno')
    expect(saves.read('g1')?.undo).toHaveLength(1)

    const copyId = saves.duplicate('g1')
    expect(copyId).not.toBeNull()
    expect(copyId).not.toBe('g1')
    expect(saves.read(copyId!)?.game.name).toBe('Uno copy')
    expect(saves.index.value).toHaveLength(2)

    saves.setCurrent('g1')
    saves.remove('g1')
    expect(saves.read('g1')).toBeNull()
    expect(saves.index.value.map((e) => e.id)).toEqual([copyId])
    expect(saves.getCurrent()).toBeNull()
  })

  it('remembers the current game', () => {
    const storage = memoryStorage()
    createSaves(storage).setCurrent('g7')
    expect(createSaves(storage).getCurrent()).toBe('g7')
  })

  it('imports a file as a new saved game', () => {
    const saves = createSaves(memoryStorage())
    saves.write(save(sample('g1', 'One')))
    const imported = saves.importText(exportGame(sample('g1', 'One')))
    expect(imported.id).not.toBe('g1')
    expect(saves.index.value).toHaveLength(2)
  })
})

// Review Focus 4.
describe('storage problems', () => {
  it('drops the oldest undo steps when storage is full', () => {
    const g = sample()
    const one = JSON.stringify(g).length
    const saves = createSaves(memoryStorage(one * 12))
    const undo = Array.from({ length: 40 }, (_, i) => ({ ...g, name: `step ${i}` }))
    const result = saves.write(save(g, undo))
    expect(result.ok).toBe(true)
    expect(result.kept).toBeGreaterThan(0)
    expect(result.kept).toBeLessThan(40)
    const back = saves.read('g1')!
    expect(back.game).toEqual(g)
    expect(back.undo).toHaveLength(result.kept)
    expect(back.undo[0].name).toBe('step 0')
  })

  it('reports failure when even the game alone does not fit', () => {
    const saves = createSaves(memoryStorage(100))
    expect(saves.write(save(sample(), [testGame()]))).toEqual({ ok: false, kept: 0 })
    expect(saves.read('g1')).toBeNull()
  })

  it('skips a corrupt entry', () => {
    const storage = memoryStorage()
    const saves = createSaves(storage)
    saves.write(save(sample()))
    storage.setItem('lostAtlas.game.g1', '{broken')
    expect(saves.read('g1')).toBeNull()
    storage.setItem('lostAtlas.game.g1', JSON.stringify({ schemaVersion: 1, game: { id: 'g1' } }))
    expect(saves.read('g1')).toBeNull()
    expect(saves.duplicate('g1')).toBeNull()
  })
})

// Final review fixes.
describe('two tabs on one storage', () => {
  it('keeps a game another tab saved in the list', () => {
    const storage = memoryStorage()
    const tabA = createSaves(storage)
    tabA.write(save(sample('gA', 'A')))
    const tabB = createSaves(storage)
    tabB.write(save(sample('gB', 'B')))
    tabA.write(save(sample('gA', 'A again')))
    expect(tabA.index.value.map((e) => e.id)).toEqual(['gA', 'gB'])
    expect(createSaves(storage).index.value.map((e) => e.id)).toEqual(['gA', 'gB'])
  })

  it('does not drop another tab’s game when removing one', () => {
    const storage = memoryStorage()
    const tabA = createSaves(storage)
    tabA.write(save(sample('gA', 'A')))
    tabA.write(save(sample('gC', 'C')))
    createSaves(storage).write(save(sample('gB', 'B')))
    tabA.remove('gC')
    expect(createSaves(storage).index.value.map((e) => e.id)).toEqual(['gB', 'gA'])
  })
})

describe('storage full with other saved games', () => {
  it('drops the undo history of other games before trimming the game being saved', () => {
    const g = sample()
    const one = JSON.stringify(g).length
    const saves = createSaves(memoryStorage(one * 60))
    const steps = (id: string) => Array.from({ length: 40 }, (_, i) => ({ ...g, id, name: `step ${i}` }))
    expect(saves.write(save({ ...g, id: 'old' }, steps('old')))).toEqual({ ok: true, kept: 40 })
    expect(saves.write(save({ ...g, id: 'live' }, steps('live')))).toEqual({ ok: true, kept: 40 })
    expect(saves.read('old')?.game.id).toBe('old')
    expect(saves.read('old')?.undo).toHaveLength(0)
    expect(saves.read('live')?.undo).toHaveLength(40)
  })
})

describe('import of a file with invalid values', () => {
  const edited = (change: (game: Game) => void) => {
    const data = JSON.parse(exportGame(sample()))
    change(data.game)
    return JSON.stringify(data)
  }

  it('rejects share counts that are negative, fractional or absurd', () => {
    expect(() => importGame(edited((g) => (g.companies.express.treasuryShares = -1)), [])).toThrow('companies.express')
    expect(() => importGame(edited((g) => (g.companies.express.marketShares = 1.5)), [])).toThrow('companies.express')
    expect(() => importGame(edited((g) => (g.companies.express.holdings = { p2: 1e9 })), [])).toThrow('companies.express')
  })

  it('rejects shares held by an unknown player', () => {
    expect(() => importGame(edited((g) => (g.companies.express.holdings = { ghost: 1 })), [])).toThrow('companies.express')
  })

  it('rejects a token on position 0', () => {
    const text = edited((g) => {
      g.track[8] = []
      g.track[0] = ['express']
    })
    expect(() => importGame(text, [])).toThrow('track')
  })
})

describe('refresh', () => {
  it('shows a game that another tab saved', () => {
    const storage = memoryStorage()
    const tabA = createSaves(storage)
    createSaves(storage).write(save(sample('gB', 'B')))
    expect(tabA.index.value).toHaveLength(0)
    tabA.refresh()
    expect(tabA.index.value.map((e) => e.id)).toEqual(['gB'])
  })
})

describe('migration from version 1', () => {
  const file = () => JSON.stringify({ schemaVersion: 1, game: legacyV1Game(sample()) })

  it('imports a version 1 export as a version 2 game with defaults', () => {
    const g = importGame(file(), [])
    expect(g.schemaVersion).toBe(2)
    expect(g.settings.live).toBe(false)
    expect(g.round).toEqual({ cycle: 1, type: 'SR' })
    expect(g.cycleScores).toEqual([])
    expect(g.soldThisRound).toEqual({})
    expect(g.operating).toEqual({ acted: [], issuedOrRedeemed: [] })
    expect(g.players).toEqual(sample().players)
    expect(g.track).toEqual(sample().track)
  })

  it('treats active companies as having operated and the rest as not (D6)', () => {
    const g = importGame(file(), [])
    expect(g.companies.express).toMatchObject({ status: 'active', operated: true, treasuryCash: 0, ledger: [] })
    expect(g.companies.tunneling).toMatchObject({ status: 'unstarted', operated: false })
  })

  it('exports as version 2 and re-imports equal', () => {
    const g = importGame(file(), [])
    expect(importGame(exportGame(g), [])).toEqual(g)
  })
})
