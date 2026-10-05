import { describe, expect, it } from 'vitest'
import { createGameStore } from './game'
import { createSaves } from './saves'
import { memoryStorage } from './memoryStorage'
import { applyMerge, mergePlan } from '../domain/merge'
import { moveToken } from '../domain/track'
import { setCash } from '../domain/edit'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const [J, K] = ['p1', 'p2']

function twoMinors(): Game {
  let g = put(testGame(), 'tunneling', { price: 70, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
  g = put(g, 'express', { price: 80, president: K, holdings: { [J]: 1, [K]: 1 }, treasury: 1 })
  return g
}

function setup(storage = memoryStorage()) {
  const saves = createSaves(storage)
  return { saves, store: createGameStore(saves), storage }
}

describe('game store', () => {
  it('starts with no game and nothing to undo', () => {
    const { store } = setup()
    expect(store.game.value).toBeNull()
    expect(store.canUndo.value).toBe(false)
    expect(store.canRedo.value).toBe(false)
  })

  it('creates a game with empty history and saves it', () => {
    const { store, saves } = setup()
    store.create(twoMinors())
    expect(store.game.value).toEqual(twoMinors())
    expect(store.canUndo.value).toBe(false)
    expect(saves.read('g1')?.game).toEqual(twoMinors())
    expect(saves.getCurrent()).toBe('g1')
  })

  it('makes one undo step per commit', () => {
    const { store } = setup()
    store.create(twoMinors())
    store.commit(setCash(store.game.value!, J, 10))
    store.commit(setCash(store.game.value!, J, 20))
    store.commit(setCash(store.game.value!, J, 30))
    store.undo()
    expect(store.game.value!.players[0].cash).toBe(20)
    store.undo()
    store.undo()
    expect(store.game.value!.players[0].cash).toBe(0)
    expect(store.canUndo.value).toBe(false)
    expect(store.canRedo.value).toBe(true)
  })

  it('undoes and redoes a merge as one step (spec D3 test 13)', () => {
    const { store } = setup()
    const before = twoMinors()
    store.create(before)
    const merged = applyMerge(before, mergePlan(before, 'tunneling', 'express', 'union'))
    store.commit(merged)
    expect(store.game.value!.companies.union.status).toBe('active')

    store.undo()
    expect(store.game.value).toEqual(before)
    expect(store.game.value!.companies.union.status).toBe('unstarted')
    expect(store.game.value!.companies.tunneling.holdings).toEqual({ [K]: 1 })

    store.redo()
    expect(store.game.value).toEqual(merged)
  })

  it('ignores a commit that changes nothing', () => {
    const { store } = setup()
    store.create(twoMinors())
    store.commit(setCash(store.game.value!, J, 0))
    store.commit(twoMinors())
    expect(store.canUndo.value).toBe(false)
  })

  it('does not let a later change to the committed object leak into the store', () => {
    const { store } = setup()
    const g = twoMinors()
    store.create(g)
    g.players[0].cash = 999
    expect(store.game.value!.players[0].cash).toBe(0)
  })

  it('autosaves every commit, undo and redo', () => {
    const { store, saves } = setup()
    store.create(twoMinors())
    store.commit(setCash(store.game.value!, J, 10))
    expect(saves.read('g1')?.game.players[0].cash).toBe(10)
    expect(saves.read('g1')?.undo).toHaveLength(1)
    store.undo()
    expect(saves.read('g1')?.game.players[0].cash).toBe(0)
    expect(saves.read('g1')?.redo).toHaveLength(1)
  })

  it('restores the game and its history after a restart', () => {
    const storage = memoryStorage()
    const first = setup(storage).store
    first.create(twoMinors())
    first.commit(setCash(first.game.value!, J, 10))
    first.commit(setCash(first.game.value!, J, 20))
    first.undo()

    const second = setup(storage).store
    expect(second.resume()).toBe(true)
    expect(second.game.value!.players[0].cash).toBe(10)
    expect(second.canUndo.value).toBe(true)
    expect(second.canRedo.value).toBe(true)
    second.redo()
    expect(second.game.value!.players[0].cash).toBe(20)
    second.undo()
    second.undo()
    expect(second.game.value!.players[0].cash).toBe(0)
    expect(second.canUndo.value).toBe(false)
  })

  it('has nothing to resume on a first run', () => {
    expect(setup().store.resume()).toBe(false)
  })

  it('caps history at 200 steps', () => {
    const { store } = setup()
    store.create(twoMinors())
    for (let i = 1; i <= 210; i++) store.commit(setCash(store.game.value!, J, i))
    let steps = 0
    while (store.canUndo.value) {
      store.undo()
      steps++
    }
    expect(steps).toBe(200)
    expect(store.game.value!.players[0].cash).toBe(10)
  })

  it('closes the game without deleting the save', () => {
    const { store, saves } = setup()
    store.create(twoMinors())
    store.close()
    expect(store.game.value).toBeNull()
    expect(store.canUndo.value).toBe(false)
    expect(saves.getCurrent()).toBeNull()
    expect(saves.read('g1')).not.toBeNull()
  })

  it('opening a second game does not mix histories', () => {
    const { store, saves } = setup()
    store.create(twoMinors())
    store.commit(setCash(store.game.value!, J, 10))
    store.create({ ...testGame(), id: 'g2' })
    expect(store.canUndo.value).toBe(false)
    store.open(saves.read('g1')!)
    expect(store.game.value!.players[0].cash).toBe(10)
    store.undo()
    expect(store.game.value!.players[0].cash).toBe(0)
  })

  // Review Focus 4.
  it('keeps working and warns when storage fills up', () => {
    const size = JSON.stringify(twoMinors()).length
    const { store } = setup(memoryStorage(size * 6))
    store.create(twoMinors())
    for (let i = 1; i <= 30; i++) {
      const result = moveToken(store.game.value!, 'express', 1)
      if (result.kind === 'moved') store.commit(result.game)
    }
    expect(store.saveWarning.value).toMatch(/Storage is full/)
    expect(store.game.value!.track[26]).toContain('express')
    expect(store.canUndo.value).toBe(true)
  })

  it('warns that the game is not saved when nothing fits', () => {
    const { store } = setup(memoryStorage(50))
    store.create(twoMinors())
    expect(store.saveWarning.value).toMatch(/not being saved/)
    expect(store.game.value).toEqual(twoMinors())
  })
})
