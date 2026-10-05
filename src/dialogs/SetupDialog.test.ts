import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SetupDialog from './SetupDialog.vue'
import type { Game } from '../domain/types'

function open() {
  return mount(SetupDialog, { props: { visible: true } })
}

async function setNames(w: VueWrapper, names: string[]) {
  while (w.findAll('[data-testid="player-name"]').length < names.length) {
    await w.get('[data-testid="add-player"]').trigger('click')
  }
  const inputs = w.findAll('[data-testid="player-name"]')
  for (let i = 0; i < names.length; i++) await inputs[i].setValue(names[i])
}

async function start(w: VueWrapper): Promise<Game> {
  await w.get('[data-testid="start-game"]').trigger('click')
  const events = w.emitted('start')
  if (!events) throw new Error('start was not emitted')
  return events[events.length - 1][0] as Game
}

const button = (w: VueWrapper, text: string) => {
  const found = w.findAll('button').find((b) => b.text().includes(text))
  if (!found) throw new Error(`No button "${text}"`)
  return found
}

const codes = (w: VueWrapper) =>
  w.findAll('[data-testid="player-code"]').map((i) => (i.element as HTMLInputElement).value)

describe('SetupDialog (spec D3 test 12)', () => {
  it('opens with 2 players and keeps Start disabled until the names are filled', async () => {
    const w = open()
    expect(w.findAll('[data-testid="player-name"]')).toHaveLength(2)
    expect(w.get('[data-testid="start-game"]').attributes('disabled')).toBeDefined()
    await setNames(w, ['Haoran', 'Ari'])
    expect(w.get('[data-testid="start-game"]').attributes('disabled')).toBeUndefined()
  })

  it('defaults 2 players to 450 each and a Short Game', async () => {
    const w = open()
    await setNames(w, ['Haoran', 'Ari'])
    const game = await start(w)
    expect(game.players.map((p) => p.cash)).toEqual([450, 450])
    expect(game.settings.shortGame).toBe(true)
    expect(game.companies.adaptive.status).toBe('unavailable')
    expect(game.settings.phase).toBe('yellow')
    expect(w.emitted('update:visible')).toEqual([[false]])
  })

  it('defaults 3, 4 and 5 players to 300, 275 and 220, and a Long Game', async () => {
    for (const [names, cash] of [
      [['A', 'B', 'C'], 300],
      [['A', 'B', 'C', 'D'], 275],
      [['A', 'B', 'C', 'D', 'E'], 220],
    ] as const) {
      const w = open()
      await setNames(w, [...names])
      const game = await start(w)
      expect(game.players.map((p) => p.cash)).toEqual(names.map(() => cash))
      expect(game.settings.shortGame).toBe(false)
      expect(game.companies.adaptive.status).toBe('unstarted')
    }
  })

  it('allows at most 5 players and at least 2', async () => {
    const w = open()
    expect(w.findAll('[aria-label="Remove player"]').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    await setNames(w, ['A', 'B', 'C', 'D', 'E'])
    expect(w.get('[data-testid="add-player"]').attributes('disabled')).toBeDefined()
    await w.findAll('[aria-label="Remove player"]')[0].trigger('click')
    expect(w.findAll('[data-testid="player-name"]')).toHaveLength(4)
    expect((await start(w)).players.map((p) => p.name)).toEqual(['B', 'C', 'D', 'E'])
  })

  it('keeps a game length the user picked when the player count changes', async () => {
    const w = open()
    await setNames(w, ['A', 'B', 'C'])
    await button(w, 'Short').trigger('click')
    await setNames(w, ['A', 'B', 'C', 'D'])
    expect((await start(w)).settings.shortGame).toBe(true)
  })

  it('generates codes from the names', async () => {
    const w = open()
    await setNames(w, ['Haoran', 'Ari', 'John', 'James'])
    expect(codes(w)).toEqual(['H', 'A', 'Jo', 'Ja'])
    expect((await start(w)).players.map((p) => p.code)).toEqual(['H', 'A', 'Jo', 'Ja'])
  })

  it('keeps a code the user edited and rejects a duplicate code', async () => {
    const w = open()
    await setNames(w, ['Haoran', 'Ari'])
    await w.findAll('[data-testid="player-code"]')[1].setValue('h')
    expect(w.text()).toContain('This code is already used')
    expect(w.get('[data-testid="start-game"]').attributes('disabled')).toBeDefined()

    await w.findAll('[data-testid="player-code"]')[1].setValue('X')
    await setNames(w, ['Haoran', 'Ariadne'])
    expect(codes(w)).toEqual(['H', 'X'])
    expect(w.get('[data-testid="start-game"]').attributes('disabled')).toBeUndefined()
  })

  it('uses the chosen phase and game name', async () => {
    const w = open()
    await setNames(w, ['A', 'B'])
    await w.get('[data-testid="game-name"]').setValue('Friday game')
    await button(w, 'Green').trigger('click')
    const game = await start(w)
    expect(game.name).toBe('Friday game')
    expect(game.settings.phase).toBe('green')
  })

  it('trims names and blocks a name that is only spaces', async () => {
    const w = open()
    await setNames(w, ['  Haoran ', '   '])
    expect(w.get('[data-testid="start-game"]').attributes('disabled')).toBeDefined()
    await setNames(w, ['  Haoran ', 'Ari'])
    expect((await start(w)).players.map((p) => p.name)).toEqual(['Haoran', 'Ari'])
  })

  // Bug: tabbing through a cash field made it stop following the player count.
  // The number input reports its value when it loses focus, even when nothing was typed.
  it('keeps updating a cash field that was only focused, not edited', async () => {
    const w = open()
    await setNames(w, ['Haoran', 'Ari'])
    const first = w.findAllComponents({ name: 'InputNumber' })[0]
    first.vm.$emit('update:modelValue', 450)
    await setNames(w, ['Haoran', 'Ari', 'John'])
    expect((await start(w)).players.map((p) => p.cash)).toEqual([300, 300, 300])
  })

  it('keeps a cash value the user changed when the player count changes', async () => {
    const w = open()
    await setNames(w, ['Haoran', 'Ari'])
    w.findAllComponents({ name: 'InputNumber' })[0].vm.$emit('update:modelValue', 500)
    await setNames(w, ['Haoran', 'Ari', 'John'])
    expect((await start(w)).players.map((p) => p.cash)).toEqual([500, 300, 300])
  })

  it('says which minors a long game includes and a short game removes', async () => {
    const w = open()
    await setNames(w, ['A', 'B', 'C'])
    expect(w.text()).toContain('A long game includes:')
    expect(w.text()).not.toContain('A short game would remove:')
    expect(w.findAll('.pill.struck')).toHaveLength(0)
    await button(w, 'Short').trigger('click')
    expect(w.text()).toContain('A short game removes:')
    expect(w.findAll('.pill.struck')).toHaveLength(4)
  })
})
