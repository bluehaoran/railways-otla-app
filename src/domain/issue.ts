import { kindOf } from './companies'
import { closeCompany } from './company'
import { MARKET_LIMIT } from './shares'
import { moveToken, priceOf } from './track'
import { addCash } from './treasury'
import type { CompanyId, Game } from './types'

export type ShareAction = 'issue' | 'redeem'

export type ShareActionCheck =
  | { ok: true; overLimit: boolean }
  | { ok: false; reason: 'not-active' | 'already-operated' | 'already-issued-or-redeemed' | 'no-treasury-share' | 'no-market-share' }

/** Whether a company may issue or redeem a share now. A pool over the 50% limit is a warning (`overLimit`). */
export function checkShareAction(game: Game, id: CompanyId, action: ShareAction): ShareActionCheck {
  const company = game.companies[id]
  if (!company || company.status !== 'active' || priceOf(game, id) === null) return { ok: false, reason: 'not-active' }
  if (game.operating.acted.includes(id)) return { ok: false, reason: 'already-operated' }
  if (game.operating.issuedOrRedeemed.includes(id)) return { ok: false, reason: 'already-issued-or-redeemed' }
  if (action === 'issue') {
    if (company.treasuryShares < 1) return { ok: false, reason: 'no-treasury-share' }
    return { ok: true, overLimit: company.marketShares + 1 > MARKET_LIMIT[kindOf(id)] }
  }
  if (company.marketShares < 1) return { ok: false, reason: 'no-market-share' }
  return { ok: true, overLimit: false }
}

function assertAllowed(game: Game, id: CompanyId, action: ShareAction) {
  const check = checkShareAction(game, id, action)
  if (!check.ok) throw new Error(`${id} cannot ${action} a share: ${check.reason}`)
}

/** The company receives the share price and the price drops 1. At 0 the company closes. */
export function issueShare(game: Game, id: CompanyId): Game {
  assertAllowed(game, id, 'issue')
  const price = priceOf(game, id) as number
  const company = game.companies[id]
  let g: Game = {
    ...game,
    companies: {
      ...game.companies,
      [id]: { ...company, treasuryShares: company.treasuryShares - 1, marketShares: company.marketShares + 1 },
    },
    operating: { ...game.operating, issuedOrRedeemed: [...game.operating.issuedOrRedeemed, id] },
  }
  g = addCash(g, id, price, 'Issued a share')
  const moved = moveToken(g, id, -1)
  return moved.kind === 'close' ? closeCompany(g, id) : moved.game
}

/** The company pays the share price to the bank. The price and the token stay as they are. */
export function redeemShare(game: Game, id: CompanyId): Game {
  assertAllowed(game, id, 'redeem')
  const price = priceOf(game, id) as number
  const company = game.companies[id]
  const g: Game = {
    ...game,
    companies: {
      ...game.companies,
      [id]: { ...company, treasuryShares: company.treasuryShares + 1, marketShares: company.marketShares - 1 },
    },
    operating: { ...game.operating, issuedOrRedeemed: [...game.operating.issuedOrRedeemed, id] },
  }
  return addCash(g, id, -price, 'Redeemed a share')
}
