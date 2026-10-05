import { displayName } from './companies'
import { shares } from './shares'
import { TRACK } from './track'
import type { CompanyId, Game, PlayerId } from './types'

/** Active companies in acting order: price descending, then queue order (front first). */
export function turnOrder(game: Game): CompanyId[] {
  const out: CompanyId[] = []
  for (let i = game.track.length - 1; i >= 0; i--) out.push(...game.track[i])
  return out
}

/** Cash plus shares times price over the companies on the track. */
export function playerTotal(game: Game, playerId: PlayerId): number {
  const player = game.players.find((p) => p.id === playerId)
  if (!player) return 0
  let total = player.cash
  game.track.forEach((queue, i) => {
    for (const id of queue) total += shares(game.companies[id], playerId) * TRACK[i]
  })
  return total
}

export interface RankEntry {
  playerId: PlayerId
  total: number
  rank: number
  tieBreakApplied: boolean
}

interface Row {
  playerId: PlayerId
  total: number
  /** Position in turn order of the first company this player presides over. Infinity for none. */
  key: number
  seat: number
}

function rows(game: Game): Row[] {
  const order = turnOrder(game)
  const list = game.players.map((p, seat) => {
    const first = order.findIndex((id) => game.companies[id].president === p.id)
    return { playerId: p.id, total: playerTotal(game, p.id), key: first === -1 ? Infinity : first, seat }
  })
  return list.sort((a, b) => {
    if (a.total !== b.total) return b.total - a.total
    if (a.key !== b.key) return a.key - b.key
    return a.seat - b.seat
  })
}

/**
 * Players sorted best first. A tie on total is broken by the presidency that comes
 * earliest in turn order. Players with no deciding presidency share a rank.
 */
export function ranking(game: Game): RankEntry[] {
  const sorted = rows(game)
  const out: RankEntry[] = []
  sorted.forEach((row, i) => {
    const prev = sorted[i - 1]
    const sameAsPrev = prev !== undefined && prev.total === row.total && prev.key === row.key
    out.push({
      playerId: row.playerId,
      total: row.total,
      rank: sameAsPrev ? out[i - 1].rank : i + 1,
      tieBreakApplied: sorted.some((other) => other.total === row.total && other.key !== row.key),
    })
  })
  return out
}

/** One sentence for each pair of neighbours in the ranking that tie on total. */
export function tieNotes(game: Game): string[] {
  const order = turnOrder(game)
  const sorted = rows(game)
  const code = (id: PlayerId) => game.players.find((p) => p.id === id)?.code ?? id
  const company = (key: number) => displayName(game.companies[order[key]])
  const notes: string[] = []
  for (let i = 1; i < sorted.length; i++) {
    const [a, b] = [sorted[i - 1], sorted[i]]
    if (a.total !== b.total) continue
    const head = `${code(a.playerId)} and ${code(b.playerId)} tie at ${a.total}.`
    if (a.key === b.key) {
      notes.push(`${head} Neither is president of a company, so they stay tied.`)
    } else if (b.key === Infinity) {
      notes.push(
        `${head} ${code(a.playerId)} ranks higher: ${code(a.playerId)} is president of ${company(a.key)}, and ${code(b.playerId)} is president of no company.`,
      )
    } else {
      notes.push(
        `${head} ${code(a.playerId)} ranks higher: ${code(a.playerId)} is president of ${company(a.key)}, which acts before ${company(b.key)}, where ${code(b.playerId)} is president.`,
      )
    }
  }
  return notes
}
