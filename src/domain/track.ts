import type { CompanyId, Game, Phase } from './types'

export const TRACK: readonly number[] = [
  0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200, 220, 245, 270, 300, 330, 360, 400,
  450, 500,
]
export const TOP = TRACK.length - 1

export type Zone = 'closed' | 'none' | 'yellow' | 'green' | 'purple'

export function zoneOf(price: number): Zone {
  if (price === 0) return 'closed'
  if (price >= 60 && price <= 90) return 'yellow'
  if (price >= 100 && price <= 110) return 'green'
  if (price >= 120 && price <= 135) return 'purple'
  return 'none'
}

export const START_MIN = 60
export const PHASE_MAX: Record<Phase, number> = { yellow: 90, green: 110, purple: 135 }

/** Track prices a new company may start at in this phase. */
export function startPrices(phase: Phase): number[] {
  return TRACK.filter((p) => p >= START_MIN && p <= PHASE_MAX[phase])
}

/** Highest track value at or below `value`. 0 for anything below 10. */
export function snapDown(value: number): number {
  let result = 0
  for (const p of TRACK) if (p <= value) result = p
  return result
}

export interface TokenPos {
  index: number
  slot: number
}

export function findToken(game: Game, id: CompanyId): TokenPos | null {
  for (let index = 0; index < game.track.length; index++) {
    const slot = game.track[index].indexOf(id)
    if (slot !== -1) return { index, slot }
  }
  return null
}

export function priceOf(game: Game, id: CompanyId): number | null {
  const pos = findToken(game, id)
  return pos ? TRACK[pos.index] : null
}

export type MoveResult = { kind: 'moved'; game: Game } | { kind: 'close'; companyId: CompanyId }

/**
 * Puts a token at track position `index`, at queue slot `slot` (default: the back).
 * Position 0 does not move the token: it returns a close request for the caller to confirm.
 */
export function placeToken(game: Game, id: CompanyId, index: number, slot?: number): MoveResult {
  if (!Number.isInteger(index) || index < 0 || index > TOP) throw new RangeError(`No track position ${index}`)
  if (index === 0) return { kind: 'close', companyId: id }
  const track = game.track.map((queue) => queue.filter((c) => c !== id))
  const queue = track[index]
  const at = slot === undefined ? queue.length : Math.max(0, Math.min(slot, queue.length))
  track[index] = [...queue.slice(0, at), id, ...queue.slice(at)]
  return { kind: 'moved', game: { ...game, track } }
}

/**
 * Moves a token by `steps` positions (negative = down). Clamps at 500.
 * The token always joins the back of the target queue, also when it stays in place.
 */
export function moveToken(game: Game, id: CompanyId, steps: number): MoveResult {
  const pos = findToken(game, id)
  if (!pos) throw new Error(`${id} is not on the track`)
  const target = Math.max(0, Math.min(TOP, pos.index + steps))
  return placeToken(game, id, target)
}

/** Start price for a winning bid: half the bid, snapped down, clamped to the phase maximum. */
export function startPrice(bid: number, phase: Phase): number {
  if (!Number.isInteger(bid) || bid < 120 || bid % 5 !== 0) {
    throw new RangeError('A bid is at least 120, in steps of 5')
  }
  return Math.min(snapDown(bid / 2), PHASE_MAX[phase])
}
