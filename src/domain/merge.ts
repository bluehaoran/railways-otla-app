import { blankCompany } from './company'
import { COMPANIES, MAJOR_IDS, displayName } from './companies'
import { turnOrder } from './scoring'
import { shares } from './shares'
import { TRACK, priceOf, snapDown } from './track'
import { addCash } from './treasury'
import type { CompanyId, Game, PlayerId } from './types'

export interface MergePlan {
  aId: CompanyId
  bId: CompanyId
  mId: CompanyId
  identity: number
  shares: Record<PlayerId, number>
  newPresident: PlayerId | null
  needsChoice: boolean
  tiedPlayers: PlayerId[]
  reason: 'most-shares' | 'tie-break' | 'chosen' | 'needs-choice'
  decidingCompany: CompanyId | null
  holdings: Record<PlayerId, number>
  treasuryShares: number
  marketShares: number
  total: number
  price: number
}

/** Active minors in turn order. */
export function activeMinors(game: Game): CompanyId[] {
  return turnOrder(game).filter((id) => COMPANIES[id].kind === 'minor')
}

export function unstartedMajors(game: Game): CompanyId[] {
  return MAJOR_IDS.filter((id) => game.companies[id].status === 'unstarted')
}

export function canMerge(game: Game): boolean {
  return activeMinors(game).length >= 2 && unstartedMajors(game).length >= 1
}

/**
 * Works out the merge of minors A and B into major M. Does not change the game.
 * `opts.president` is the user's choice, used only when the rules cannot decide.
 */
export function mergePlan(
  game: Game,
  aId: CompanyId,
  bId: CompanyId,
  mId: CompanyId,
  opts: { identity?: number; president?: PlayerId } = {},
): MergePlan {
  const priceA = priceOf(game, aId)
  const priceB = priceOf(game, bId)
  if (aId === bId) throw new Error('Choose two different minors')
  if (COMPANIES[aId]?.kind !== 'minor' || COMPANIES[bId]?.kind !== 'minor' || priceA === null || priceB === null) {
    throw new Error('Both companies must be active minors')
  }
  if (COMPANIES[mId]?.kind !== 'major' || game.companies[mId].status !== 'unstarted') {
    throw new Error('The major must not have started yet')
  }

  const a = game.companies[aId]
  const b = game.companies[bId]
  const combined: Record<PlayerId, number> = {}
  for (const p of game.players) combined[p.id] = shares(a, p.id) + shares(b, p.id)

  const most = Math.max(...Object.values(combined))
  const tiedPlayers = game.players.filter((p) => combined[p.id] === most).map((p) => p.id)

  let newPresident: PlayerId | null = null
  let reason: MergePlan['reason'] = 'needs-choice'
  let decidingCompany: CompanyId | null = null
  if (tiedPlayers.length === 1) {
    newPresident = tiedPlayers[0]
    reason = 'most-shares'
  } else {
    const order = turnOrder(game)
    const byTurn = [aId, bId].sort((x, y) => order.indexOf(x) - order.indexOf(y))
    for (const id of byTurn) {
      const president = game.companies[id].president
      if (president !== null && tiedPlayers.includes(president)) {
        newPresident = president
        decidingCompany = id
        reason = 'tie-break'
        break
      }
    }
    if (newPresident === null && opts.president !== undefined && tiedPlayers.includes(opts.president)) {
      newPresident = opts.president
      reason = 'chosen'
    }
  }

  const holdings: Record<PlayerId, number> = {}
  for (const p of game.players) {
    const regular = Math.max(0, combined[p.id] - (p.id === newPresident ? 2 : 0))
    if (regular > 0) holdings[p.id] = regular
  }
  const treasuryShares = a.treasuryShares + b.treasuryShares
  const marketShares = a.marketShares + b.marketShares
  const held =
    newPresident === null
      ? Object.values(combined).reduce((sum, n) => sum + n, 0)
      : Object.values(holdings).reduce((sum, n) => sum + n, 0) + 2

  return {
    aId,
    bId,
    mId,
    identity: opts.identity ?? 0,
    shares: combined,
    newPresident,
    needsChoice: newPresident === null,
    tiedPlayers,
    reason,
    decidingCompany,
    holdings,
    treasuryShares,
    marketShares,
    total: held + treasuryShares + marketShares,
    price: snapDown((priceA + priceB) / 2),
  }
}

/** Applies a plan: M becomes active at the back of its queue, A and B become `merged`. */
export function applyMerge(game: Game, plan: MergePlan): Game {
  if (plan.newPresident === null) throw new Error('Choose the new president first')
  const index = TRACK.indexOf(plan.price)
  const retired = (id: CompanyId) => blankCompany(id, 'merged')
  const merged: Game = {
    ...game,
    companies: {
      ...game.companies,
      [plan.aId]: retired(plan.aId),
      [plan.bId]: retired(plan.bId),
      [plan.mId]: {
        ...blankCompany(plan.mId, 'active'),
        president: plan.newPresident,
        holdings: { ...plan.holdings },
        treasuryShares: plan.treasuryShares,
        marketShares: plan.marketShares,
        identity: plan.identity,
        operated: true,
      },
    },
    track: game.track.map((queue, i) => {
      const rest = queue.filter((id) => id !== plan.aId && id !== plan.bId)
      return i === index ? [...rest, plan.mId] : rest
    }),
  }
  const cash = game.companies[plan.aId].treasuryCash + game.companies[plan.bId].treasuryCash
  if (cash === 0) return merged
  if (!game.settings.live) {
    return {
      ...merged,
      companies: { ...merged.companies, [plan.mId]: { ...merged.companies[plan.mId], treasuryCash: cash } },
    }
  }
  const a = displayName(game.companies[plan.aId])
  const b = displayName(game.companies[plan.bId])
  return addCash(merged, plan.mId, cash, `Merged: treasuries of ${a} and ${b}`)
}
