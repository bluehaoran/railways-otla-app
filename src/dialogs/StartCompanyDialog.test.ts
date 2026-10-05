import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import StartCompanyDialog from './StartCompanyDialog.vue'
import { setCash, setPhase, setShortGame } from '../domain/edit'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const open = (game: Game) => mount(StartCompanyDialog, { props: { visible: true, game } })
const startButton = (w: VueWrapper) => w.get('[data-testid="start-company"]')
const disabled = (w: VueWrapper) => startButton(w).attributes('disabled') !== undefined

async function pick(w: VueWrapper, company: string, player: string) {
  await w.get(`[data-testid="company-${company}"]`).trigger('click')
  await w.get(`[data-testid="president-${player}"]`).trigger('click')
}

async function start(w: VueWrapper): Promise<Game> {
  await startButton(w).trigger('click')
  const events = w.emitted('start')
  if (!events) throw new Error('start was not emitted')
  return events[0][0] as Game
}

describe('StartCompanyDialog', () => {
  it('lists only the unstarted minors', () => {
    const long = open(put(testGame(), 'express', { price: 80, president: 'p1', treasury: 3 }))
    expect(long.findAll('[data-testid^="company-"]')).toHaveLength(11)
    expect(long.find('[data-testid="company-express"]').exists()).toBe(false)
    expect(long.find('[data-testid="company-union"]').exists()).toBe(false)

    const short = open(setShortGame(testGame(), true))
    expect(short.findAll('[data-testid^="company-"]')).toHaveLength(8)
    expect(short.find('[data-testid="company-adaptive"]').exists()).toBe(false)
  })

  it('needs a company and a president', async () => {
    const w = open(testGame())
    expect(disabled(w)).toBe(true)
    await w.get('[data-testid="company-express"]').trigger('click')
    expect(disabled(w)).toBe(true)
    await w.get('[data-testid="president-p2"]').trigger('click')
    expect(disabled(w)).toBe(false)
  })

  it('starts at half the default bid of 120 and takes the bid from the president’s cash', async () => {
    const w = open(setCash(setCash(testGame(), 'p1', 275), 'p2', 275))
    await pick(w, 'express', 'p2')
    const game = await start(w)
    expect(game.track[6]).toEqual(['express'])
    expect(game.companies.express).toMatchObject({ status: 'active', president: 'p2', treasuryShares: 3 })
    expect(game.players.map((p) => p.cash)).toEqual([275, 155])
    expect(w.emitted('update:visible')).toEqual([[false]])
  })

  it('shows the price for a bid, snapped down and limited by the phase', async () => {
    const w = open(testGame())
    await pick(w, 'express', 'p1')
    const bid = w.get('[data-testid="bid"]')
    await bid.setValue(175)
    expect(w.get('[data-testid="start-price"]').text()).toBe('80')
    expect(w.text()).toContain('175 ÷ 2 = 87.5, snapped down to 80')
    await bid.setValue(200)
    expect(w.get('[data-testid="start-price"]').text()).toBe('90')
    expect(w.text()).toContain('limited to 90')
    expect((await start(w)).track[9]).toEqual(['express'])
  })

  it('allows a higher price in a later phase', async () => {
    const w = open(setPhase(testGame(), 'green'))
    await pick(w, 'express', 'p1')
    await w.get('[data-testid="bid"]').setValue(200)
    expect(w.get('[data-testid="start-price"]').text()).toBe('100')
  })

  it('changes the bid by 5 and not below 120', async () => {
    const w = open(testGame())
    const bid = () => (w.get('[data-testid="bid"]').element as HTMLInputElement).value
    await w.get('[aria-label="Raise bid by 5"]').trigger('click')
    expect(bid()).toBe('125')
    await w.get('[aria-label="Lower bid by 5"]').trigger('click')
    await w.get('[aria-label="Lower bid by 5"]').trigger('click')
    expect(bid()).toBe('120')
  })

  it('blocks an invalid bid with a message', async () => {
    const w = open(testGame())
    await pick(w, 'express', 'p1')
    await w.get('[data-testid="bid"]').setValue(122)
    expect(disabled(w)).toBe(true)
    expect(w.text()).toContain('A bid is at least 120, in steps of 5')
    await w.get('[data-testid="bid"]').setValue('')
    expect(disabled(w)).toBe(true)
  })

  it('sets the bid to twice a tapped price, and disables prices above the phase maximum', async () => {
    const w = open(testGame())
    await pick(w, 'express', 'p1')
    expect(w.get('[data-testid="pick-100"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="bid"]').setValue(160)
    await w.get('[data-testid="pick-70"]').trigger('click')
    expect((w.get('[data-testid="bid"]').element as HTMLInputElement).value).toBe('140')
    expect(w.get('[data-testid="start-price"]').text()).toBe('70')
    expect(w.text()).toContain('140 ÷ 2 = 70.')
    const game = await start(w)
    expect(game.track[7]).toEqual(['express'])
    expect(game.players[0].cash).toBe(-140)
  })

  it('replaces an invalid bid when a price is tapped', async () => {
    const w = open(testGame())
    await pick(w, 'express', 'p1')
    await w.get('[data-testid="bid"]').setValue(122)
    expect(disabled(w)).toBe(true)
    await w.get('[data-testid="pick-80"]').trigger('click')
    expect((w.get('[data-testid="bid"]').element as HTMLInputElement).value).toBe('160')
    expect(disabled(w)).toBe(false)
  })

  it('shows what the president pays and has left', async () => {
    const w = open(setCash(testGame(), 'p1', 275))
    await pick(w, 'express', 'p1')
    await w.get('[data-testid="bid"]').setValue(160)
    expect(w.get('[data-testid="payment"]').text()).toContain('J pays 160 from cash: 275 becomes 115.')
    await w.get('[data-testid="bid"]').setValue(300)
    expect(w.get('[data-testid="payment"]').text()).toContain('275 becomes -25')
    expect(w.get('[data-testid="payment"]').classes()).toContain('warn')
  })

  it('follows the bid again after a price was tapped', async () => {
    const w = open(testGame())
    await pick(w, 'express', 'p1')
    await w.get('[data-testid="pick-70"]').trigger('click')
    await w.get('[data-testid="bid"]').setValue(160)
    expect(w.get('[data-testid="start-price"]').text()).toBe('80')
  })

  it('says so when every minor has started', () => {
    let g = setShortGame(testGame(), true)
    for (const id of ['tunneling', 'resourceful', 'easternMining', 'agricultural', 'northernPort', 'expansive', 'express', 'suburban']) {
      g = put(g, id, { price: 80, president: 'p1', treasury: 3 })
    }
    const w = open(g)
    expect(w.text()).toContain('Every minor company has started')
    expect(disabled(w)).toBe(true)
  })
})
