import { beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import App from './App.vue'
import { useGame } from './state/game'
import { useSaves } from './state/saves'
import { put, testGame } from './domain/fixtures'
import type { Game } from './domain/types'

const [J, K] = ['p1', 'p2']

function sample(): Game {
  let g = put(testGame(['Haoran', 'Ari']), 'tunneling', { price: 70, president: J, treasury: 3 })
  g = put(g, 'express', { price: 80, president: K, treasury: 3 })
  return { ...g, name: 'Friday game' }
}

const button = (w: VueWrapper, text: string) => {
  const found = w.findAll('button').find((b) => b.text().includes(text))
  if (!found) throw new Error(`No button "${text}"`)
  return found
}

beforeEach(() => {
  const saves = useSaves()
  useGame().close()
  for (const entry of [...saves.index.value]) saves.remove(entry.id)
  localStorage.clear()
})

describe('App without a game', () => {
  it('shows the app name when no game is open', () => {
    const w = mount(App)
    expect(w.text()).toContain('Lost Atlas Tracker')
    expect(w.text()).toContain('New game')
    expect(w.find('header').exists()).toBe(false)
  })

  it('opens the setup dialog from New game and starts a game', async () => {
    const w = mount(App)
    await w.get('[data-testid="home-new"]').trigger('click')
    const names = w.findAll('[data-testid="player-name"]')
    await names[0].setValue('Haoran')
    await names[1].setValue('Ari')
    await w.get('[data-testid="start-game"]').trigger('click')
    expect(useGame().game.value?.players.map((p) => p.name)).toEqual(['Haoran', 'Ari'])
    expect(w.find('header').exists()).toBe(true)
  })

  it('lists a saved game on the home screen and opens it', async () => {
    useGame().create(sample())
    useGame().close()
    const w = mount(App)
    expect(w.text()).toContain('Friday game')
    await w.get('[aria-label="Open g1"]').trigger('click')
    expect(w.get('header').text()).toContain('Friday game')
  })
})

describe('App with a game', () => {
  beforeEach(() => useGame().create(sample()))

  it('shows the game name, phase and length, and the Track view', () => {
    const w = mount(App)
    expect(w.get('header').text()).toContain('Friday game')
    expect(w.get('header').text()).toContain('Yellow · Long game')
    expect(w.findAll('.token')).toHaveLength(2)
  })

  it('reopens the last game on launch', () => {
    useGame().close()
    useSaves().setCurrent('g1')
    const w = mount(App)
    expect(w.get('header').text()).toContain('Friday game')
  })

  it('switches views', async () => {
    const w = mount(App)
    await button(w, 'Ownership').trigger('click')
    expect(w.find('[data-company="express"]').exists()).toBe(true)
    await button(w, 'Scoreboard').trigger('click')
    expect(w.find('[data-row="total"]').exists()).toBe(true)
  })

  it('starts on the view from the settings', () => {
    useGame().create({ ...sample(), settings: { ...sample().settings, mainView: 'scoreboard' } })
    const w = mount(App)
    expect(w.find('[data-row="total"]').exists()).toBe(true)
  })

  it('commits a view action and undoes it', async () => {
    const w = mount(App)
    const undo = w.get('[aria-label="Undo"]')
    expect(undo.attributes('disabled')).toBeDefined()
    await w.get('[data-id="express"]').trigger('click')
    await w.get('[aria-label="Up to 90"]').trigger('click')
    expect(useGame().game.value!.track[9]).toEqual(['express'])
    expect(undo.attributes('disabled')).toBeUndefined()
    await undo.trigger('click')
    expect(useGame().game.value!.track[8]).toEqual(['express'])
    await w.get('[aria-label="Redo"]').trigger('click')
    expect(useGame().game.value!.track[9]).toEqual(['express'])
  })

  it('shows the edit banner and frame in edit mode', async () => {
    const w = mount(App)
    expect(w.find('.edit-banner').exists()).toBe(false)
    await w.get('[aria-label="Edit mode"]').trigger('click')
    expect(w.find('.edit-banner').exists()).toBe(true)
    expect(w.find('.frame').exists()).toBe(true)
    expect(w.get('[aria-label="Edit mode"]').attributes('aria-pressed')).toBe('true')
    await button(w, 'Done').trigger('click')
    expect(w.find('.edit-banner').exists()).toBe(false)
  })

  it('enables Merge only with two active minors and a free major', () => {
    const w = mount(App)
    expect(w.get('[data-testid="merge"]').attributes('disabled')).toBeUndefined()
    useGame().create(put(testGame(), 'express', { price: 80, president: J, treasury: 3 }))
    const single = mount(App)
    expect(single.get('[data-testid="merge"]').attributes('disabled')).toBeDefined()
  })

  it('opens the start company dialog and commits the new company', async () => {
    const w = mount(App)
    await w.get('[data-testid="start"]').trigger('click')
    await w.get('[data-testid="company-suburban"]').trigger('click')
    await w.get('[data-testid="president-p1"]').trigger('click')
    await w.get('[data-testid="start-company"]').trigger('click')
    expect(useGame().game.value!.companies.suburban.status).toBe('active')
    expect(useSaves().read('g1')?.game.companies.suburban.status).toBe('active')
  })

  it('shows a warning badge on Ownership', async () => {
    useGame().create(put(testGame(), 'express', { price: 80, president: J, treasury: 1 }))
    const w = mount(App)
    expect(button(w, 'Ownership').find('.badge').text()).toBe('1')
    expect(button(w, 'Scoreboard').find('.badge').exists()).toBe(false)
  })
})
