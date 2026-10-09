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
  return { ...g, name: 'Friday game', settings: { ...g.settings, live: false } }
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

describe('App in a live game', () => {
  const live = (patch: Partial<Game> = {}): Game => {
    const g = sample()
    return { ...g, settings: { ...g.settings, live: true }, ...patch }
  }
  const at = (type: 'SR' | 'OR1' | 'OR2' | 'MR', cycle = 1, phase: 'yellow' | 'green' = 'yellow'): Game => {
    const g = live()
    return { ...g, round: { cycle, type }, settings: { ...g.settings, phase } }
  }

  it('shows no round bar in a manual game (review focus 1)', () => {
    useGame().create(sample())
    const w = mount(App)
    expect(w.find('[data-testid="round-bar"]').exists()).toBe(false)
    expect(w.get('[data-testid="start"]').attributes('disabled')).toBeUndefined()
  })

  it('shows the round bar and allows Start company in the Stock Round', () => {
    useGame().create(at('SR'))
    const w = mount(App)
    expect(w.get('[data-testid="round-bar"]').text()).toContain('Cycle 1 of 6')
    expect(w.get('[data-testid="start"]').attributes('disabled')).toBeUndefined()
  })

  it('disables Start company in an Operating Round', () => {
    useGame().create(at('OR1'))
    const w = mount(App)
    expect(w.get('[data-testid="start"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="start"]').attributes('title')).toBe('Companies start in the Stock Round')
  })

  it('enables Merge only in the Merger Round from the green phase', () => {
    useGame().create(at('MR', 1, 'green'))
    expect(mount(App).get('[data-testid="merge"]').attributes('disabled')).toBeUndefined()
    useGame().create(at('OR2', 1, 'green'))
    expect(mount(App).get('[data-testid="merge"]').attributes('disabled')).toBeDefined()
  })

  it('moves from OR1 to OR2 with the main button, and undo rewinds it (review focus 4)', async () => {
    useGame().create(at('OR1'))
    const w = mount(App)
    await w.get('[data-testid="round-next"]').trigger('click')
    expect(useGame().game.value?.round.type).toBe('OR2')
    useGame().undo()
    expect(useGame().game.value?.round.type).toBe('OR1')
  })

  it('ends the Stock Round through the dialog', async () => {
    useGame().create(at('SR'))
    const w = mount(App)
    await w.get('[data-testid="round-next"]').trigger('click')
    await w.get('[data-testid="end-sr-confirm"]').trigger('click')
    expect(useGame().game.value?.round).toEqual({ cycle: 1, type: 'OR1' })
  })

  it('shows the Export a train reminder after the last Operating Round (review focus 2)', async () => {
    useGame().create(at('OR2'))
    const w = mount(App)
    await w.get('[data-testid="round-next"]').trigger('click')
    expect(useGame().game.value?.round).toEqual({ cycle: 2, type: 'SR' })
    expect(useGame().game.value?.cycleScores).toHaveLength(1)
    expect(w.text()).toContain('Export a train')
  })

  it('shows no reminder after the last cycle, and opens the Scoreboard', async () => {
    useGame().create(at('OR2', 6))
    const w = mount(App)
    await w.get('[data-testid="round-next"]').trigger('click')
    expect(useGame().game.value?.round.cycle).toBe(7)
    expect(w.text()).not.toContain('Export a train')
    expect(w.find('[data-testid="final-banner"]').exists()).toBe(true)
  })

  it('opens the phase dialog from the phase chip without the export reminder', async () => {
    useGame().create(at('OR1'))
    const w = mount(App)
    await w.get('[data-testid="round-phase"]').trigger('click')
    expect(w.text()).not.toContain('Export a train')
    expect(w.text()).toContain('start price')
  })

  it('keeps the round when the phase is set from the reminder', async () => {
    useGame().create(at('OR2'))
    const w = mount(App)
    await w.get('[data-testid="round-next"]').trigger('click')
    expect(w.text()).toContain('Export a train')
    await button(w, 'Green').trigger('click')
    const g = useGame().game.value!
    expect(g.settings.phase).toBe('green')
    expect(g.round).toEqual({ cycle: 2, type: 'SR' })
  })

  it('undoes the cycle rollover', async () => {
    useGame().create(at('OR2'))
    const w = mount(App)
    await w.get('[data-testid="round-next"]').trigger('click')
    expect(useGame().game.value?.cycleScores).toHaveLength(1)
    useGame().undo()
    expect(useGame().game.value?.round).toEqual({ cycle: 1, type: 'OR2' })
    expect(useGame().game.value?.cycleScores).toHaveLength(0)
  })

  it('shows a visible reason in the footer for a gated Start company', () => {
    useGame().create(at('OR1'))
    const w = mount(App)
    const hint = w.get('[data-testid="gate-hint"]')
    expect(hint.text()).toContain('Companies start in the Stock Round')
    expect(w.get('footer button').attributes('aria-describedby')).toBe('gate-hint-start')
  })

  it('shows no footer hint, and enables Merge, in a manual game', () => {
    useGame().create(sample())
    const w = mount(App)
    expect(w.find('[data-testid="gate-hint"]').exists()).toBe(false)
    expect(w.get('[data-testid="merge"]').attributes('disabled')).toBeUndefined()
  })
})
