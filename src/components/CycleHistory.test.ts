import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CycleHistory from './CycleHistory.vue'
import { testGame, withRound } from '../domain/fixtures'
import type { Game } from '../domain/types'

const view = (game: Game) => mount(CycleHistory, { props: { game } })
const scored = (): Game => ({
  ...testGame(['Haoran', 'Ari']),
  cycleScores: [
    { p1: 100, p2: 80 },
    { p1: 130, p2: 150 },
  ],
})

describe('CycleHistory', () => {
  it('says so when no cycle has finished', () => {
    expect(view(testGame()).text()).toContain('No cycle has finished yet')
  })

  it('shows total, rank and change per cycle', () => {
    const text = view(scored()).get('[data-testid="cycle-history"]').text()
    expect(text).toContain('Cycle 1')
    expect(text).toContain('Cycle 2')
    expect(text).toContain('130')
    expect(text).toContain('#2')
    expect(text).toContain('+30')
    expect(text).toContain('+70')
  })

  it('shows a fall with a minus sign', () => {
    const g: Game = { ...testGame(), cycleScores: [{ p1: 100, p2: 80 }, { p1: 90, p2: 80 }] }
    expect(view(g).text()).toContain('−10')
  })

  it('shows a dash for a player with no total', () => {
    const g: Game = { ...testGame(), cycleScores: [{ p1: 100 }] }
    expect(view(g).get('[data-testid="cycle-history"]').text()).toContain('–')
  })

  it('saves a snapshot for the current cycle', async () => {
    const w = view(withRound(testGame(), 2, 'OR1'))
    await w.get('[data-testid="save-snapshot"]').trigger('click')
    const next = w.emitted('update')![0][0] as Game
    expect(next.cycleScores).toHaveLength(2)
    expect(next.cycleScores[1]).toEqual({ p1: 0, p2: 0 })
  })
})
