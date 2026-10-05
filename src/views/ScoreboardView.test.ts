import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ScoreboardView from './ScoreboardView.vue'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const [J, K, L] = ['p1', 'p2', 'p3']

function withCash(game: Game, cash: number[]): Game {
  return { ...game, players: game.players.map((p, i) => ({ ...p, cash: cash[i] })) }
}

/** Spec D3 test 5: J has 100 cash, 3 shares of Express at 80 and 1 share of Union at 60. */
function sample(): Game {
  let g = withCash(testGame(), [100, 0])
  g = put(g, 'express', { price: 80, president: J, holdings: { [J]: 1 }, treasury: 2 })
  g = put(g, 'union', { price: 60, president: K, holdings: { [J]: 1 }, treasury: 7 })
  return g
}

const view = (game: Game) => mount(ScoreboardView, { props: { game } })
const cell = (w: VueWrapper, rowSelector: string, player: string) =>
  w.get(`${rowSelector} [data-player="${player}"]`)
const lastUpdate = (w: VueWrapper) => {
  const events = w.emitted('update')
  if (!events) throw new Error('update was not emitted')
  return events[events.length - 1][0] as Game
}

describe('ScoreboardView', () => {
  it('shows each total (spec D3 test 5)', () => {
    const w = view(sample())
    expect(cell(w, '[data-row="total"]', J).text()).toBe('400')
    expect(cell(w, '[data-row="total"]', K).text()).toBe('120')
  })

  it('shows shares times price with the count and the price', () => {
    const w = view(sample())
    expect(cell(w, '[data-row="express"]', J).text()).toContain('240')
    expect(cell(w, '[data-row="express"]', J).text()).toContain('3 × 80')
    expect(cell(w, '[data-row="express"]', K).text()).toBe('–')
    expect(cell(w, '[data-row="union"]', K).text()).toContain('2 × 60')
  })

  it('lists company rows in turn order', () => {
    const rows = view(sample()).findAll('[data-row]').map((r) => r.attributes('data-row'))
    expect(rows).toEqual(['cash', 'express', 'union', 'total'])
  })

  it('ranks the players and highlights the leader', () => {
    const w = view(sample())
    const cards = w.findAll('[data-rank-card]')
    expect(cards.map((c) => c.attributes('data-rank-card'))).toEqual([J, K])
    expect(cards[0].text()).toContain('1')
    expect(cards[0].text()).toContain('400')
    expect(cards[0].text()).toContain('Leader')
    expect(cards[0].classes()).toContain('lead')
    expect(cards[1].classes()).not.toContain('lead')
    expect(cell(w, '[data-row="total"]', J).classes()).toContain('lead')
    expect(cell(w, '[data-row="total"]', K).classes()).not.toContain('lead')
  })

  it('names the tie-break rule when it decides the order (spec D3 test 6)', () => {
    let g = withCash(testGame(), [40, 0])
    g = put(g, 'tunneling', { price: 70, president: J, treasury: 3 })
    g = put(g, 'express', { price: 90, president: K, treasury: 3 })
    const w = view(g)
    expect(w.findAll('[data-rank-card]').map((c) => c.attributes('data-rank-card'))).toEqual([K, J])
    expect(w.get('[data-rank-card="p2"]').text()).toContain('Leader, won the tie-break')
    expect(w.text()).toContain('K ranks higher: K is president of Express, which acts before Tunneling')
  })

  it('shows the same rank for players that stay tied', () => {
    const w = view(withCash(testGame(['J', 'K', 'L']), [100, 50, 100]))
    expect(w.get(`[data-rank-card="${J}"] .rank`).text()).toBe('1')
    expect(w.get(`[data-rank-card="${L}"] .rank`).text()).toBe('1')
    expect(w.get(`[data-rank-card="${K}"] .rank`).text()).toBe('3')
    expect(w.text()).toContain('Neither is president of a company, so they stay tied.')
  })

  it('commits a cash edit as one update', () => {
    const w = view(sample())
    const inputs = w.findAllComponents({ name: 'InputNumber' })
    expect(inputs).toHaveLength(2)
    inputs[1].vm.$emit('update:modelValue', 275)
    expect(lastUpdate(w).players.map((p) => p.cash)).toEqual([100, 275])
    expect(w.emitted('update')).toHaveLength(1)
  })

  // Review Focus 1.
  it('turns a cleared cash field into 0', () => {
    const w = view(sample())
    w.findAllComponents({ name: 'InputNumber' })[0].vm.$emit('update:modelValue', null)
    expect(lastUpdate(w).players[0].cash).toBe(0)
  })

  it('flags negative cash', () => {
    const w = view(withCash(testGame(), [-20, 0]))
    expect(cell(w, '[data-row="cash"]', J).text()).toContain('Negative')
    expect(cell(w, '[data-row="cash"]', K).text()).not.toContain('Negative')
  })
})
