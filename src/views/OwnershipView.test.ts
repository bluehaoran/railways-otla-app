import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import OwnershipView from './OwnershipView.vue'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const [J, K] = ['p1', 'p2']

function sample(): Game {
  let g = put(testGame(), 'tunneling', { price: 70, president: K, treasury: 3 })
  g = put(g, 'express', { price: 80, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
  g = put(g, 'union', { price: 100, president: K, holdings: { [J]: 2 }, treasury: 4, market: 2 })
  return g
}

const view = (game: Game, editMode = false) => mount(OwnershipView, { props: { game, editMode } })
const row = (w: VueWrapper, id: string) => w.get(`[data-company="${id}"]`)
const kinds = (w: VueWrapper, id: string, holder: string) =>
  row(w, id).get(`[data-holder="${holder}"]`).findAll('.share').map((s) => s.attributes('data-kind'))
const lastUpdate = (w: VueWrapper) => {
  const events = w.emitted('update')
  if (!events) throw new Error('update was not emitted')
  return events[events.length - 1][0] as Game
}

describe('OwnershipView', () => {
  it('has a key toggle that is collapsed by default and wired to the key', async () => {
    const w = view(sample())
    const toggle = w.get('[data-testid="key-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(w.get('#ownership-key').classes()).not.toContain('open')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(w.get('#ownership-key').classes()).toContain('open')
  })

  it('lists active companies in turn order', () => {
    const w = view(sample())
    expect(w.findAll('[data-company]').map((r) => r.attributes('data-company'))).toEqual(['union', 'express', 'tunneling'])
    expect(row(w, 'express').text()).toContain('Express')
    expect(row(w, 'express').text()).toContain('80')
    expect(row(w, 'express').text()).toContain('acts 2nd')
  })

  it('shows each holding as circles', () => {
    const w = view(sample())
    expect(kinds(w, 'express', J)).toEqual(['president'])
    expect(kinds(w, 'express', K)).toEqual(['share'])
    expect(kinds(w, 'express', 'treasury')).toEqual(['treasury'])
    expect(kinds(w, 'express', 'market')).toEqual(['market'])
    expect(kinds(w, 'union', J)).toEqual(['share', 'share'])
    expect(kinds(w, 'union', 'treasury')).toHaveLength(4)
    expect(kinds(w, 'tunneling', J)).toEqual([])
    expect(row(w, 'tunneling').get(`[data-holder="${J}"]`).text()).toBe('–')
  })

  it('shows the share check per row', () => {
    const w = view(sample())
    expect(row(w, 'express').get('.check').text()).toContain('5/5')
    expect(row(w, 'union').get('.check').text()).toContain('10/10')
    expect(row(w, 'express').classes()).not.toContain('warn')
  })

  it('marks a row with warnings', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, treasury: 2 })
    const w = view(g)
    expect(row(w, 'express').classes()).toContain('warn')
    expect(row(w, 'express').get('.check').text()).toContain('4/5')
    expect(row(w, 'express').get('.check').text()).toContain('shares total 4 of 5')
  })

  it('offers a one-tap presidency transfer', async () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 3 } })
    const w = view(g)
    expect(row(w, 'express').text()).toContain('K has 3, president J has 2')
    await row(w, 'express').get('[data-testid="transfer"]').trigger('click')
    expect(lastUpdate(w).companies.express.president).toBe(K)
    expect(lastUpdate(w).companies.express.holdings).toEqual({ [J]: 2, [K]: 1 })
  })

  it('has no transfer button when the president holds the most', () => {
    expect(view(sample()).find('[data-testid="transfer"]').exists()).toBe(false)
  })

  it('edits share counts with steppers in edit mode', async () => {
    const w = view(sample(), true)
    await w.get('[aria-label="Increase Express, K"]').trigger('click')
    expect(lastUpdate(w).companies.express.holdings[K]).toBe(2)
    await w.get('[aria-label="Decrease Express, treasury"]').trigger('click')
    expect(lastUpdate(w).companies.express.treasuryShares).toBe(0)
    await w.get('[aria-label="Increase Express, market"]').trigger('click')
    expect(lastUpdate(w).companies.express.marketShares).toBe(2)
    expect(w.emitted('update')).toHaveLength(3)
  })

  it('marks the president card next to the stepper in edit mode', () => {
    const w = view(sample(), true)
    expect(row(w, 'express').get(`[data-holder="${J}"]`).text()).toContain('+2 card')
    expect(row(w, 'express').get(`[data-holder="${K}"]`).text()).not.toContain('+2 card')
  })

  it('sets the president from the picker in edit mode', () => {
    const w = view(sample(), true)
    const picker = row(w, 'express').getComponent({ name: 'Select' })
    picker.vm.$emit('update:modelValue', K)
    expect(lastUpdate(w).companies.express.president).toBe(K)
    picker.vm.$emit('update:modelValue', null)
    expect(lastUpdate(w).companies.express.president).toBeNull()
  })

  it('has no steppers outside edit mode', () => {
    expect(view(sample()).find('[aria-label^="Increase"]').exists()).toBe(false)
  })

  it('explains an empty board', () => {
    expect(view(testGame()).text()).toContain('No active companies')
  })
})
