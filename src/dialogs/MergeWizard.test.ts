import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MergeWizard from './MergeWizard.vue'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const [J, K] = ['p1', 'p2']

/** Spec D3 test 7. */
function test7(): Game {
  let g = put(testGame(), 'tunneling', { price: 70, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
  g = put(g, 'express', { price: 80, president: K, holdings: { [J]: 1, [K]: 1 }, treasury: 1 })
  return g
}

/** The MergeChoice board: the tied players preside over neither minor. */
function choiceGame(): Game {
  let g = testGame(['Haoran', 'Ari', 'John', 'James'])
  g = put(g, 'resourceful', { price: 60, president: 'p1', holdings: { p3: 3 } })
  g = put(g, 'express', { price: 110, president: 'p2', holdings: { p4: 3 } })
  return g
}

const open = (game: Game) => mount(MergeWizard, { props: { visible: true, game } })
const next = (w: VueWrapper) => w.get('[data-testid="next"]')
const confirm = (w: VueWrapper) => w.get('[data-testid="confirm-merge"]')
const isDisabled = (b: ReturnType<VueWrapper['get']>) => b.attributes('disabled') !== undefined

async function toPreview(w: VueWrapper, a: string, b: string, major: string) {
  await w.get(`[data-testid="minor-${a}"]`).trigger('click')
  await w.get(`[data-testid="minor-${b}"]`).trigger('click')
  await next(w).trigger('click')
  await w.get(`[data-testid="major-${major}"]`).trigger('click')
  await next(w).trigger('click')
}

function merged(w: VueWrapper): Game {
  const events = w.emitted('merge')
  if (!events) throw new Error('merge was not emitted')
  return events[0][0] as Game
}

describe('MergeWizard', () => {
  it('lists active minors in turn order and needs two of them', async () => {
    const w = open(put(test7(), 'union', { price: 100, president: J, treasury: 8 }))
    const ids = w.findAll('[data-testid^="minor-"]').map((b) => b.attributes('data-testid'))
    expect(ids).toEqual(['minor-express', 'minor-tunneling'])
    expect(isDisabled(next(w))).toBe(true)
    await w.get('[data-testid="minor-express"]').trigger('click')
    expect(isDisabled(next(w))).toBe(true)
    await w.get('[data-testid="minor-tunneling"]').trigger('click')
    expect(isDisabled(next(w))).toBe(false)
    expect(w.get('[data-testid="minor-express"]').text()).toContain('A')
    expect(w.get('[data-testid="minor-tunneling"]').text()).toContain('B')
  })

  it('disables a major that has already started', async () => {
    const w = open(put(test7(), 'union', { price: 100, president: J, treasury: 8 }))
    await w.get('[data-testid="minor-express"]').trigger('click')
    await w.get('[data-testid="minor-tunneling"]').trigger('click')
    await next(w).trigger('click')
    expect(isDisabled(w.get('[data-testid="major-union"]'))).toBe(true)
    expect(isDisabled(w.get('[data-testid="major-system"]'))).toBe(false)
    expect(isDisabled(next(w))).toBe(true)
  })

  it('previews and applies a merge (spec D3 test 7)', async () => {
    const w = open(test7())
    await toPreview(w, 'tunneling', 'express', 'union')
    const preview = w.get('[data-testid="preview"]')
    expect(preview.get('[data-testid="new-president"]').text()).toContain('K')
    expect(preview.get('[data-testid="new-price"]').text()).toContain('70')
    expect(preview.text()).toContain('Average of 70 and 80 is 75, snapped down to 70')
    expect(preview.text()).toContain('K holds the most shares (4) and becomes president.')
    expect(preview.get('[data-testid="total-m"]').text()).toBe('10')

    await confirm(w).trigger('click')
    const game = merged(w)
    expect(game.companies.union).toMatchObject({ status: 'active', president: K, holdings: { [J]: 3, [K]: 2 } })
    expect(game.companies.tunneling.status).toBe('merged')
    expect(game.track[7]).toEqual(['union'])
    expect(w.emitted('update:visible')).toEqual([[false]])
  })

  it('explains a tie-break', async () => {
    let g = testGame(['Haoran', 'Ari', 'John', 'James'])
    g = put(g, 'tunneling', { price: 90, president: 'p4', holdings: { p2: 1 }, treasury: 1, market: 1 })
    g = put(g, 'agricultural', { price: 70, president: 'p2', holdings: { p4: 1 }, market: 2 })
    const w = open(g)
    await toPreview(w, 'tunneling', 'agricultural', 'federation')
    expect(w.get('[data-testid="preview"]').text()).toContain(
      'Ari and James tie at 3 shares. James is president of Tunneling, which acts before Agricultural, so James takes the presidency.',
    )
    expect(w.get('[data-testid="new-price"]').text()).toContain('Average of 90 and 70 is 80.')
  })

  it('requires a choice when the rules cannot decide (spec D3 test 8)', async () => {
    const w = open(choiceGame())
    await toPreview(w, 'resourceful', 'express', 'federation')
    expect(w.text()).toContain('John and James tie at 3 shares.')
    expect(w.text()).toContain('Choose the new president.')
    expect(isDisabled(confirm(w))).toBe(true)
    expect(w.findAll('[data-testid^="choose-"]').map((b) => b.attributes('data-testid'))).toEqual(['choose-p3', 'choose-p4'])

    await w.get('[data-testid="choose-p4"]').trigger('click')
    expect(isDisabled(confirm(w))).toBe(false)
    await confirm(w).trigger('click')
    expect(merged(w).companies.federation.president).toBe('p4')
    expect(merged(w).companies.federation.holdings).toEqual({ p1: 2, p2: 2, p3: 3, p4: 1 })
  })

  it('lets the user pick the second name of a major', async () => {
    const w = open(test7())
    await w.get('[data-testid="minor-tunneling"]').trigger('click')
    await w.get('[data-testid="minor-express"]').trigger('click')
    await next(w).trigger('click')
    expect(w.find('[data-testid="name-federation-1"]').exists()).toBe(false)
    await w.get('[data-testid="name-system-1"]').trigger('click')
    await w.get('[data-testid="major-system"]').trigger('click')
    expect(w.get('[data-testid="major-system"]').text()).toContain('Syndicate')
    await next(w).trigger('click')
    expect(w.get('[data-testid="preview"]').text()).toContain('Syndicate')
    await confirm(w).trigger('click')
    expect(merged(w).companies.system.identity).toBe(1)
  })

  it('goes back a step and keeps the choices', async () => {
    const w = open(test7())
    await toPreview(w, 'tunneling', 'express', 'union')
    await w.get('[data-testid="back"]').trigger('click')
    expect(w.get('[data-testid="major-union"]').attributes('aria-pressed')).toBe('true')
    await w.get('[data-testid="back"]').trigger('click')
    expect(w.get('[data-testid="minor-tunneling"]').attributes('aria-pressed')).toBe('true')
  })

  it('replaces B when a third minor is picked', async () => {
    const w = open(put(test7(), 'suburban', { price: 60, president: J, treasury: 3 }))
    await w.get('[data-testid="minor-express"]').trigger('click')
    await w.get('[data-testid="minor-tunneling"]').trigger('click')
    await w.get('[data-testid="minor-suburban"]').trigger('click')
    expect(w.get('[data-testid="minor-tunneling"]').attributes('aria-pressed')).toBe('false')
    expect(w.get('[data-testid="minor-suburban"]').text()).toContain('B')
  })

  // Review Focus 5.
  it('shows a total that is not 10 for broken share counts', async () => {
    let g = put(testGame(), 'tunneling', { price: 70, president: J, treasury: 2 })
    g = put(g, 'express', { price: 80, president: K, treasury: 3 })
    const w = open(g)
    await toPreview(w, 'tunneling', 'express', 'union')
    expect(w.get('[data-testid="total-m"]').text()).toBe('9')
    expect(w.get('[data-testid="total-m"]').classes()).toContain('bad')
    expect(w.text()).toContain('The shares do not total 10')
  })
})
