import type { Game, PlayerId } from './types'

export interface HistoryRow {
  playerId: PlayerId
  total: number | null
  rank: number | null
  /** Total minus the same player's total in the previous snapshot. Null when there is none. */
  change: number | null
}

export interface HistoryColumn {
  /** 1-based cycle number. */
  cycle: number
  /** In `game.players` order. */
  rows: HistoryRow[]
}

/** One column per saved snapshot. A snapshot with no player total is skipped. */
export function cycleHistory(game: Game): HistoryColumn[] {
  const columns: HistoryColumn[] = []
  game.cycleScores.forEach((scores, index) => {
    const totals = game.players.map((p) => scores[p.id] ?? null)
    if (totals.every((t) => t === null)) return
    const before = game.cycleScores[index - 1]
    const rows = game.players.map((p, i): HistoryRow => {
      const total = totals[i]
      if (total === null) return { playerId: p.id, total: null, rank: null, change: null }
      const rank = 1 + totals.filter((t) => t !== null && t > total).length
      const previous = before?.[p.id]
      return { playerId: p.id, total, rank, change: typeof previous === 'number' ? total - previous : null }
    })
    columns.push({ cycle: index + 1, rows })
  })
  return columns
}
