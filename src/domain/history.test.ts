import { describe, expect, it } from 'vitest'
import { cycleHistory } from './history'
import { testGame } from './fixtures'

const withScores = (cycleScores: Record<string, number>[], names = ['J', 'K']) => ({ ...testGame(names), cycleScores })

describe('cycleHistory', () => {
  it('has no columns before the first snapshot', () => {
    expect(cycleHistory(testGame())).toEqual([])
  })

  it('gives total, rank and change per cycle', () => {
    const columns = cycleHistory(withScores([{ p1: 100, p2: 80 }, { p1: 130, p2: 150 }]))
    expect(columns).toEqual([
      {
        cycle: 1,
        rows: [
          { playerId: 'p1', total: 100, rank: 1, change: null },
          { playerId: 'p2', total: 80, rank: 2, change: null },
        ],
      },
      {
        cycle: 2,
        rows: [
          { playerId: 'p1', total: 130, rank: 2, change: 30 },
          { playerId: 'p2', total: 150, rank: 1, change: 70 },
        ],
      },
    ])
  })

  it('lets tied players share a rank', () => {
    const [column] = cycleHistory(withScores([{ p1: 100, p2: 100, p3: 50 }], ['J', 'K', 'L']))
    expect(column.rows.map((r) => r.rank)).toEqual([1, 1, 3])
  })

  it('skips an empty snapshot, keeps the cycle number, and has no change after a gap', () => {
    const columns = cycleHistory(withScores([{}, { p1: 5, p2: 6 }]))
    expect(columns.map((c) => c.cycle)).toEqual([2])
    expect(columns[0].rows.map((r) => r.change)).toEqual([null, null])
  })

  it('shows a missing player as null', () => {
    const [column] = cycleHistory(withScores([{ p1: 100 }]))
    expect(column.rows).toEqual([
      { playerId: 'p1', total: 100, rank: 1, change: null },
      { playerId: 'p2', total: null, rank: null, change: null },
    ])
  })
})
