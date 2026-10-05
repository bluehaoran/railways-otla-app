import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import TrackView from './TrackView.vue'
import TrackQueue from '../components/TrackQueue.vue'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const confirmRequire = vi.fn()
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }))

const [J, K] = ['p1', 'p2']

function sample(): Game {
  let g = put(testGame(), 'northernPort', { price: 90, president: J, treasury: 3 })
  g = put(g, 'tunneling', { price: 90, president: K, treasury: 3 })
  g = put(g, 'resourceful', { price: 60, president: J, treasury: 3 })
  return g
}

const view = (game: Game, editMode = false) => mount(TrackView, { props: { game, editMode } })
const prices = (w: VueWrapper) => w.findAll('.pos').map((p) => Number(p.attributes('data-price')))
const tokens = (w: VueWrapper) => w.findAll('.token').map((t) => t.attributes('data-id'))
const lastUpdate = (w: VueWrapper) => {
  const events = w.emitted('update')
  if (!events) throw new Error('update was not emitted')
  return events[events.length - 1][0] as Game
}
const button = (w: VueWrapper, text: string) => {
  const found = w.findAll('button').find((b) => b.text().includes(text))
  if (!found) throw new Error(`No button "${text}"`)
  return found
}

beforeEach(() => confirmRequire.mockReset())

describe('TrackView', () => {
  it('shows the occupied positions plus one each side, highest first', () => {
    expect(prices(view(sample()))).toEqual([100, 90, 80, 70, 60, 50])
  })

  it('shows 100 to 50 when the track is empty', () => {
    expect(prices(view(testGame()))).toEqual([100, 90, 80, 70, 60, 50])
  })

  it('shows all 27 positions with the full track toggle', async () => {
    const w = view(sample())
    await w.get('[data-testid="full-track"] input').setValue(true)
    expect(prices(w)).toHaveLength(27)
    expect(prices(w)[0]).toBe(500)
    expect(prices(w)[26]).toBe(0)
  })

  it('lists tokens in turn order with a rank badge in a shared queue', () => {
    const w = view(sample())
    expect(tokens(w)).toEqual(['northernPort', 'tunneling', 'resourceful'])
    expect(w.findAll('.rank').map((r) => r.text())).toEqual(['1', '2'])
    expect(w.get('[data-id="tunneling"]').attributes('aria-label')).toBe('Tunneling at 90, president K')
  })

  it('shows the dock for the selected token', async () => {
    const w = view(sample())
    expect(w.find('[data-testid="dock"]').exists()).toBe(false)
    await w.get('[data-id="tunneling"]').trigger('click')
    const dock = w.get('[data-testid="dock"]')
    expect(dock.text()).toContain('Tunneling at 90')
    expect(dock.text()).toContain('President K')
    expect(dock.text()).toContain('acts 2nd of 3')
    expect(dock.find('[aria-label="Up to 100"]').exists()).toBe(true)
    expect(dock.find('[aria-label="Down to 80"]').exists()).toBe(true)
  })

  it('moves the selected token one step per tap', async () => {
    const w = view(sample())
    await w.get('[data-id="northernPort"]').trigger('click')
    await w.get('[aria-label="Up to 100"]').trigger('click')
    expect(lastUpdate(w).track[10]).toEqual(['northernPort'])
    expect(lastUpdate(w).track[9]).toEqual(['tunneling'])
    await w.get('[aria-label="Down to 80"]').trigger('click')
    expect(w.emitted('update')).toHaveLength(2)
  })

  it('asks before closing a company that reaches 0', async () => {
    const g = put(testGame(), 'express', { price: 10, president: J, treasury: 3 })
    const w = view(g)
    await w.get('[data-id="express"]').trigger('click')
    await w.get('[aria-label="Down to 0, close"]').trigger('click')
    expect(w.emitted('update')).toBeUndefined()
    expect(confirmRequire).toHaveBeenCalledTimes(1)
    expect(confirmRequire.mock.calls[0][0].message).toContain('Express')

    confirmRequire.mock.calls[0][0].accept()
    expect(lastUpdate(w).companies.express.status).toBe('closed')
    expect(lastUpdate(w).track[1]).toEqual([])
  })

  it('keeps a token at 500 and sends it to the back', async () => {
    let g = put(testGame(), 'express', { price: 500, president: J, treasury: 3 })
    g = put(g, 'tunneling', { price: 500, president: K, treasury: 3 })
    const w = view(g)
    await w.get('[data-id="express"]').trigger('click')
    await w.get('[aria-label="Stay at 500"]').trigger('click')
    expect(lastUpdate(w).track[26]).toEqual(['tunneling', 'express'])
  })

  it('offers the edit actions only in edit mode', async () => {
    const plain = view(sample())
    await plain.get('[data-id="tunneling"]').trigger('click')
    expect(plain.find('[data-testid="edit-actions"]').exists()).toBe(false)

    const w = view(sample(), true)
    await w.get('[data-id="tunneling"]').trigger('click')
    await button(w, 'To front').trigger('click')
    expect(lastUpdate(w).track[9]).toEqual(['tunneling', 'northernPort'])
    await button(w, 'To back').trigger('click')
    expect(lastUpdate(w).track[9]).toEqual(['northernPort', 'tunneling'])
  })

  it('moves a token to any price in edit mode', async () => {
    const w = view(sample(), true)
    await w.get('[data-id="resourceful"]').trigger('click')
    await button(w, 'Move to price').trigger('click')
    await w.get('[data-testid="price-245"]').trigger('click')
    expect(lastUpdate(w).track[19]).toEqual(['resourceful'])
  })

  it('closes a company from the edit actions after a confirm', async () => {
    const w = view(sample(), true)
    await w.get('[data-id="resourceful"]').trigger('click')
    await button(w, 'Close company').trigger('click')
    expect(confirmRequire).toHaveBeenCalledTimes(1)
    confirmRequire.mock.calls[0][0].accept()
    expect(lastUpdate(w).companies.resourceful.status).toBe('closed')
  })

  it('places a dragged token at the dropped position and slot', async () => {
    const w = view(sample(), true)
    const queue = w.findAllComponents(TrackQueue).find((q) => q.props('index') === 9)!
    queue.vm.$emit('drop', { id: 'resourceful', index: 9, slot: 1 })
    expect(lastUpdate(w).track[9]).toEqual(['northernPort', 'resourceful', 'tunneling'])
    expect(lastUpdate(w).track[6]).toEqual([])
  })

  it('clears the selection when the selected company leaves the track', async () => {
    const w = view(sample())
    await w.get('[data-id="resourceful"]').trigger('click')
    const next = { ...sample(), track: sample().track.map((q) => q.filter((id) => id !== 'resourceful')) }
    await w.setProps({ game: next })
    expect(w.find('[data-testid="dock"]').exists()).toBe(false)
  })
})
