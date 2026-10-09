import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import PhaseDialog from './PhaseDialog.vue'
import { testGame, withRound } from '../domain/fixtures'
import type { Game } from '../domain/types'

const open = (game: Game, exportStep = false) => mount(PhaseDialog, { props: { visible: true, game, exportStep } })
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

describe('PhaseDialog', () => {
  it('changes the phase at once', async () => {
    const w = open(testGame())
    await button(w, 'Purple').trigger('click')
    expect(lastUpdate(w).settings.phase).toBe('purple')
  })

  it('explains the phase when it is opened from the round bar', () => {
    const w = open(testGame())
    expect(w.text()).toContain('start price')
    expect(w.text()).not.toContain('Export a train')
  })

  it('shows the Export a train reminder for the cycle that just ended', () => {
    const w = open(withRound(testGame(), 3, 'SR'), true)
    expect(w.text()).toContain('Export a train')
    expect(w.text()).toContain('Cycle 2 is over')
    expect(w.text()).toContain('Merger Round')
  })

  it('closes with Done and changes nothing by itself', async () => {
    const w = open(testGame(), true)
    await w.get('[data-testid="phase-done"]').trigger('click')
    expect(w.emitted('update')).toBeUndefined()
    expect(w.emitted('update:visible')?.[0]).toEqual([false])
  })
})
