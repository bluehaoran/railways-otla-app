import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import EndStockRoundDialog from './EndStockRoundDialog.vue'
import { put, testGame } from '../domain/fixtures'
import { priceOf } from '../domain/track'
import type { Game } from '../domain/types'

const [J, K] = ['p1', 'p2']
const open = (game: Game) => mount(EndStockRoundDialog, { props: { visible: true, game } })
const lastUpdate = (w: VueWrapper) => {
  const events = w.emitted('update')
  if (!events) throw new Error('update was not emitted')
  return events[events.length - 1][0] as Game
}
/** express and tunneling are fully owned by players. resourceful has treasury shares. */
function game() {
  let g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 3 } })
  g = put(g, 'tunneling', { price: 70, president: K, holdings: { [J]: 3 } })
  return put(g, 'resourceful', { price: 90, president: J, treasury: 3 })
}

describe('EndStockRoundDialog', () => {
  it('lists the companies that rise and what they move to', () => {
    const w = open(game())
    expect(w.text()).toContain('Express')
    expect(w.text()).toContain('Tunneling')
    expect(w.text()).not.toContain('Resourceful')
    expect(w.text()).toContain('80')
    expect(w.text()).toContain('90')
  })

  it('applies the rises and moves to the first Operating Round', async () => {
    const w = open(game())
    await w.get('[data-testid="end-sr-confirm"]').trigger('click')
    const next = lastUpdate(w)
    expect(priceOf(next, 'express')).toBe(90)
    expect(priceOf(next, 'tunneling')).toBe(80)
    expect(next.round).toEqual({ cycle: 1, type: 'OR1' })
  })

  it('leaves an unchecked company where it is', async () => {
    const w = open(game())
    await w.get('[data-testid="riser-express"] input').setValue(false)
    await w.get('[data-testid="end-sr-confirm"]').trigger('click')
    const next = lastUpdate(w)
    expect(priceOf(next, 'express')).toBe(80)
    expect(priceOf(next, 'tunneling')).toBe(80)
  })

  it('still works when nothing rises (review focus 3)', async () => {
    const w = open(put(testGame(), 'resourceful', { price: 90, president: J, treasury: 3 }))
    expect(w.text()).toContain('No company is fully owned by players')
    await w.get('[data-testid="end-sr-confirm"]').trigger('click')
    expect(lastUpdate(w).round.type).toBe('OR1')
  })
})
