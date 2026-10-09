import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RoundBar from './RoundBar.vue'
import { put, testGame, withRound } from '../domain/fixtures'
import { setPhase } from '../domain/edit'
import type { Game } from '../domain/types'

const bar = (game: Game) => mount(RoundBar, { props: { game } })
const chip = (w: ReturnType<typeof bar>, text: string) => {
  const found = w.findAll('li').find((li) => li.text() === text)
  if (!found) throw new Error(`No chip ${text}`)
  return found
}

describe('RoundBar', () => {
  it('shows the cycle and marks the current round', () => {
    const w = bar(testGame())
    expect(w.text()).toContain('Cycle 1 of 6')
    expect(chip(w, 'SR').attributes('aria-current')).toBe('step')
    expect(chip(w, 'OR1').attributes('aria-current')).toBeUndefined()
  })

  it('counts 4 cycles in a Short Game', () => {
    const g = { ...testGame(), settings: { ...testGame().settings, shortGame: true } }
    expect(bar(g).text()).toContain('Cycle 1 of 4')
  })

  it('marks the Merger Round as skipped in the yellow phase only', () => {
    expect(chip(bar(testGame()), 'MR').classes()).toContain('skipped')
    expect(chip(bar(setPhase(testGame(), 'green')), 'MR').classes()).not.toContain('skipped')
  })

  it('shows who has operated during an Operating Round', () => {
    let g = put(testGame(), 'express', { price: 80, president: 'p1', treasury: 3 })
    g = put(g, 'tunneling', { price: 70, president: 'p2', treasury: 3 })
    g = { ...withRound(g, 1, 'OR1'), operating: { acted: ['express'], issuedOrRedeemed: [] } }
    expect(bar(g).text()).toContain('1 of 2 companies operated')
  })

  it.each([
    ['SR', 'End Stock Round'],
    ['OR1', 'Start Operating Round 2'],
    ['OR2', 'End Operating Rounds'],
    ['MR', 'End Merger Round'],
  ] as const)('labels the main button in %s', (type, label) => {
    expect(bar(withRound(testGame(), 1, type)).get('[data-testid="round-next"]').text()).toBe(label)
  })

  it('emits next and phase', async () => {
    const w = bar(testGame())
    await w.get('[data-testid="round-next"]').trigger('click')
    await w.get('[data-testid="round-phase"]').trigger('click')
    expect(w.emitted('next')).toHaveLength(1)
    expect(w.emitted('phase')).toHaveLength(1)
  })

  it('shows the phase', () => {
    expect(bar(setPhase(testGame(), 'purple')).get('[data-testid="round-phase"]').text()).toContain('Purple')
  })

  it('says the game is over and offers no button after the last cycle', () => {
    const w = bar(withRound(testGame(), 7, 'SR'))
    expect(w.text()).toContain('Game over')
    expect(w.find('[data-testid="round-next"]').exists()).toBe(false)
  })
})
