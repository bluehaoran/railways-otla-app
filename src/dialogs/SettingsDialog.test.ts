import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SettingsDialog from './SettingsDialog.vue'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const open = (game: Game, editMode = false) => mount(SettingsDialog, { props: { visible: true, game, editMode } })
const button = (w: VueWrapper, text: string) => {
  const found = w.findAll('button').find((b) => b.text().includes(text))
  if (!found) throw new Error(`No button "${text}"`)
  return found
}
const lastUpdate = (w: VueWrapper) => {
  const events = w.emitted('update')
  if (!events) throw new Error('update was not emitted')
  return events[events.length - 1][0] as Game
}

describe('SettingsDialog', () => {
  it('changes the phase', async () => {
    const w = open(testGame())
    await button(w, 'Green').trigger('click')
    expect(lastUpdate(w).settings.phase).toBe('green')
  })

  it('changes the default view', async () => {
    const w = open(testGame())
    await button(w, 'Scoreboard').trigger('click')
    expect(lastUpdate(w).settings.mainView).toBe('scoreboard')
  })

  it('renames the game when the field loses focus', async () => {
    const w = open(testGame())
    const input = w.get('[data-testid="settings-name"]')
    await input.setValue('Friday game')
    expect(w.emitted('update')).toBeUndefined()
    await input.trigger('blur')
    expect(lastUpdate(w).name).toBe('Friday game')
    await w.setProps({ game: lastUpdate(w) })
    await input.trigger('blur')
    expect(w.emitted('update')).toHaveLength(1)
  })

  it('keeps the old name when the field is left empty', async () => {
    const w = open(testGame())
    const input = w.get('[data-testid="settings-name"]')
    await input.setValue('   ')
    await input.trigger('blur')
    expect(w.emitted('update')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('Test')
  })

  it('locks the game length outside edit mode', () => {
    const w = open(testGame())
    expect(button(w, 'Short').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Turn on edit mode to change the game length')
  })

  it('changes the game length in edit mode before a company starts', async () => {
    const w = open(testGame(), true)
    await button(w, 'Short').trigger('click')
    expect(lastUpdate(w).settings.shortGame).toBe(true)
    expect(lastUpdate(w).companies.adaptive.status).toBe('unavailable')
  })

  it('locks the game length once a company has started', () => {
    const w = open(put(testGame(), 'express', { price: 80, president: 'p1', treasury: 3 }), true)
    expect(button(w, 'Short').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('fixed once a company has started')
  })
})
