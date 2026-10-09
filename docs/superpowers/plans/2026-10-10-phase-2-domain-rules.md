# Phase 2 Domain Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Phase 2 game rules as pure, tested domain functions (treasury ledger, dividends, issue and redeem, Stock Round turns, rounds), with no UI.

**Architecture:** One module per rule family in `src/domain/`, each taking a `Game` and returning a new `Game` or a plan. A "plan" function previews an action (problems, cash, price moves, closes, presidency exchanges) without changing anything. An "apply" function does the whole action in one return value, so one user action is one history entry (P2-04). The shared Phase 1 functions `startCompany`, `applyMerge` and `closeCompany` gain `settings.live` handling; the new Phase 2 functions are only called by live-mode UI and do not check the flag.

**Tech Stack:** TypeScript (strict, `noUnusedLocals`), Vitest.

**Spec:** `docs/design/lost-atlas-tracker-design-spec.md` (A4 rules, B4 domain functions, D3 tests 15 to 20). List items: P2-03, P2-04, P2-25 (domain half), P2-31, P2-32, P2-33, P2-40, P2-41, P2-50 (domain half), P2-90, P2-91, P2-93, P2-94 in `docs/design/phase-2-implementation-list.md`. Rulebook: `docs/reference/RailwaysRulebook-CleanFonts.pdf`, printed pp.10 to 19. Roadmap and rulebook cross-check R1 to R9: `docs/superpowers/plans/2026-10-10-phase-2-roadmap.md`.

## Global Constraints

- Domain code is pure TypeScript with no Vue imports. Every function returns a new `Game` and never mutates (spread copies).
- Always count shares through `shares()` in `shares.ts`. `Company.holdings` is regular cards only.
- Move tokens only through `moveToken` and `placeToken` in `track.ts`. A move to position 0 returns `{ kind: 'close' }`; close the company with `closeCompany`.
- Treasury cash is never scored (`playerTotal` does not read it).
- Money amounts are whole numbers. Earnings are multiples of 10 (decision D5 A). Per-share payouts are computed as `earnings / TOTAL_SHARES[kind]` (integer division is exact), never `earnings * 0.2`.
- Warnings never block an action. Rule violations a user cannot override (selling more shares than held, buying from an empty pool) are returned as `problems`, not thrown, by plan functions.
- `startCompany`, `applyMerge` and `closeCompany` run in both modes. They touch treasury cash and the ledger only when `game.settings.live` is true. The Phase 1 bid deduction from the president's cash stays in both modes.
- Issue and redeem are one action per company per OR (R1). The next company to act is derived from the track and `operating.acted`, never from a stored list (R7).
- `npm test` and `npm run typecheck` must both pass before each commit. No linter.
- Commit locally with the `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` trailer. Do not push.

## Review Focus

1. A turn with a problem must leave the game untouched: `planTurn` returns the input `Game` and `applyTurn` throws, so a half-applied sale can never be committed. Test in Task 5.
2. Earnings that are not a multiple of 10, are negative, or are `NaN` must raise `RangeError`, never produce `NaN` or fractional cash. Test in Task 3.
3. A dividend, issue or redeem on a company that already acted this OR must be refused (a double click must not pay twice). Tests in Tasks 3 and 4.
4. A non-live game must not get ledger entries or treasury cash from `startCompany` or `applyMerge`. Test in Task 2.
5. A token at 500 that rises, and a token at 10 that drops, must not crash: the first stays at 500 and joins the back, the second closes. Tests in Tasks 3 and 7.

---

### Task 1: Treasury ledger helpers, negative-treasury warning, fixtures

**Files:**
- Create: `src/domain/treasury.ts`
- Create: `src/domain/treasury.test.ts`
- Modify: `src/domain/shares.ts` (`WarningCode`, `validate`)
- Modify: `src/domain/shares.test.ts`
- Modify: `src/domain/fixtures.ts`

**Interfaces:**
- Produces:
  - `MANUAL_REASONS: readonly ['Train', 'Track tile', 'Hub token', 'Other']`, `type ManualReason`
  - `addCash(game: Game, id: CompanyId, delta: number, what: string, auto?: boolean): Game` (auto defaults to true; a zero delta returns `game` unchanged)
  - `manualEntry(game: Game, id: CompanyId, kind: 'spend' | 'receive', reason: ManualReason, amount: number): Game` (throws `RangeError` unless `amount` is a finite number above 0)
  - `WarningCode` gains `'negative-treasury'`
  - fixtures: `withRound(game: Game, cycle: number, type: RoundType): Game`

- [ ] **Step 1: Write the failing tests**

`src/domain/treasury.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addCash, manualEntry } from './treasury'
import { put, testGame, withRound } from './fixtures'
import { validate } from './shares'

const base = () => withRound(put(testGame(), 'express', { price: 80, president: 'p1', treasury: 3 }), 2, 'OR1')

describe('addCash', () => {
  it('adds to the treasury and records an automatic entry in the current round', () => {
    const g = addCash(base(), 'express', 80, 'Share bought')
    expect(g.companies.express.treasuryCash).toBe(80)
    expect(g.companies.express.ledger).toEqual([{ cycle: 2, round: 'OR1', what: 'Share bought', delta: 80, auto: true }])
  })

  it('records a negative delta and keeps a running balance', () => {
    let g = addCash(base(), 'express', 100, 'In')
    g = addCash(g, 'express', -40, 'Out')
    expect(g.companies.express.treasuryCash).toBe(60)
    expect(g.companies.express.ledger.map((e) => e.delta)).toEqual([100, -40])
  })

  it('does nothing for a zero delta', () => {
    const g = base()
    expect(addCash(g, 'express', 0, 'Nothing')).toBe(g)
  })

  it('does not change the input game', () => {
    const g = base()
    addCash(g, 'express', 10, 'x')
    expect(g.companies.express.treasuryCash).toBe(0)
    expect(g.companies.express.ledger).toEqual([])
  })
})

describe('manualEntry', () => {
  it('spends and receives with the reason as the text, marked as not automatic', () => {
    let g = manualEntry(base(), 'express', 'receive', 'Other', 200)
    g = manualEntry(g, 'express', 'spend', 'Train', 100)
    expect(g.companies.express.treasuryCash).toBe(100)
    expect(g.companies.express.ledger.map((e) => [e.what, e.delta, e.auto])).toEqual([
      ['Other', 200, false],
      ['Train', -100, false],
    ])
  })

  it.each([0, -5, NaN, Infinity])('rejects the amount %s', (amount) => {
    expect(() => manualEntry(base(), 'express', 'spend', 'Train', amount)).toThrow(RangeError)
  })
})

describe('validate: negative treasury', () => {
  it('warns when a company treasury is below 0, and not at 0', () => {
    const g = base()
    expect(validate(g).some((w) => w.code === 'negative-treasury')).toBe(false)
    const spent = manualEntry(g, 'express', 'spend', 'Train', 30)
    const warning = validate(spent).find((w) => w.code === 'negative-treasury')
    expect(warning?.companyId).toBe('express')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain/treasury.test.ts`
Expected: FAIL (`./treasury` does not exist, `withRound` is not exported).

- [ ] **Step 3: Implement**

`src/domain/treasury.ts`:

```ts
import type { CompanyId, Game, LedgerEntry } from './types'

export const MANUAL_REASONS = ['Train', 'Track tile', 'Hub token', 'Other'] as const
export type ManualReason = (typeof MANUAL_REASONS)[number]

/**
 * Adds `delta` to a company's treasury cash and records it in the ledger, stamped with the
 * current cycle and round. A zero delta changes nothing.
 */
export function addCash(game: Game, id: CompanyId, delta: number, what: string, auto = true): Game {
  if (delta === 0) return game
  const company = game.companies[id]
  const entry: LedgerEntry = { cycle: game.round.cycle, round: game.round.type, what, delta, auto }
  return {
    ...game,
    companies: {
      ...game.companies,
      [id]: { ...company, treasuryCash: company.treasuryCash + delta, ledger: [...company.ledger, entry] },
    },
  }
}

/** A manual ledger entry: money the company spent or received. `amount` is above 0. */
export function manualEntry(
  game: Game,
  id: CompanyId,
  kind: 'spend' | 'receive',
  reason: ManualReason,
  amount: number,
): Game {
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('The amount must be more than 0')
  return addCash(game, id, kind === 'spend' ? -amount : amount, reason, false)
}
```

`src/domain/shares.ts`: add `| 'negative-treasury'` to `WarningCode`, and inside `validate`'s company loop, after the `market-limit` check:

```ts
    if (company.treasuryCash < 0) {
      out.push({ code: 'negative-treasury', companyId, message: `${name}: treasury cash is ${company.treasuryCash}` })
    }
```

`src/domain/fixtures.ts`: add the import `RoundType` to the type import and:

```ts
/** Sets the cycle and round. */
export function withRound(game: Game, cycle: number, type: RoundType): Game {
  return { ...game, round: { cycle, type } }
}
```

If `npm run typecheck` reports an exhaustiveness error on `WarningCode` in a view or component, add a case for `'negative-treasury'` that reuses the wording of the neighbouring warning cases.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add treasury ledger helpers and a negative-treasury warning

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Start company and merge handle treasury cash in live games

**Files:**
- Modify: `src/domain/company.ts`
- Modify: `src/domain/merge.ts` (`applyMerge`)
- Test: `src/domain/company.test.ts`, `src/domain/merge.test.ts`

**Interfaces:**
- Consumes: `addCash` from `./treasury` (Task 1).
- Produces: no new exports. Behavior: `startCompany` in a live game puts the bid in the new company's treasury with one automatic ledger entry. `applyMerge` always sums the treasury cash of A and B into M, and in a live game adds one automatic ledger entry for the sum.

- [ ] **Step 1: Write the failing tests**

In `src/domain/company.test.ts`, inside `describe('startCompany', ...)`:

```ts
  it('puts the bid in the company treasury in a live game, with one ledger entry', () => {
    const g = startCompany(testGame(), 'express', K, 80, 120)
    expect(g.settings.live).toBe(true)
    expect(g.companies.express.treasuryCash).toBe(120)
    expect(g.companies.express.ledger).toHaveLength(1)
    expect(g.companies.express.ledger[0]).toMatchObject({ delta: 120, auto: true, cycle: 1, round: 'SR' })
  })

  it('leaves the treasury and ledger alone in a manual game (spec P2-93)', () => {
    const manual = { ...testGame(), settings: { ...testGame().settings, live: false } }
    const g = startCompany(manual, 'express', K, 80, 120)
    expect(g.companies.express.treasuryCash).toBe(0)
    expect(g.companies.express.ledger).toEqual([])
    expect(g.players.find((p) => p.id === K)?.cash).toBe(-120)
  })
```

In `src/domain/merge.test.ts`, next to the other `applyMerge` tests (they use `test7()`):

```ts
  it('combines the treasuries of A and B, with a ledger entry in a live game (P2-94)', () => {
    let g = test7()
    g = { ...g, companies: { ...g.companies, tunneling: { ...g.companies.tunneling, treasuryCash: 90 } } }
    g = { ...g, companies: { ...g.companies, express: { ...g.companies.express, treasuryCash: 60 } } }
    const merged = applyMerge(g, mergePlan(g, 'tunneling', 'express', 'union'))
    expect(merged.companies.union.treasuryCash).toBe(150)
    expect(merged.companies.union.ledger).toHaveLength(1)
    expect(merged.companies.union.ledger[0]).toMatchObject({ delta: 150, auto: true })
    expect(merged.companies.tunneling.treasuryCash).toBe(0)
  })

  it('combines treasuries but writes no ledger entry in a manual game (P2-93)', () => {
    let g = test7()
    g = { ...g, settings: { ...g.settings, live: false } }
    g = { ...g, companies: { ...g.companies, tunneling: { ...g.companies.tunneling, treasuryCash: 90 } } }
    const merged = applyMerge(g, mergePlan(g, 'tunneling', 'express', 'union'))
    expect(merged.companies.union.treasuryCash).toBe(90)
    expect(merged.companies.union.ledger).toEqual([])
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain/company.test.ts src/domain/merge.test.ts`
Expected: FAIL (treasury stays 0, no ledger entry).

- [ ] **Step 3: Implement**

`src/domain/company.ts`: import `addCash` from `./treasury`. Rewrite the tail of `startCompany` and its doc comment:

```ts
/**
 * Starts a minor: the president gets the president card (2 shares), the 3 regular
 * cards go to the company treasury, and the token joins the back of the queue at `price`.
 * The president pays the winning bid from cash. The cash may go negative; validation flags it.
 * In a live game the bid also goes into the company treasury, with a ledger entry.
 */
export function startCompany(game: Game, id: CompanyId, presidentId: PlayerId, price: number, bid: number): Game {
  const company = game.companies[id]
  if (!company || COMPANIES[id].kind !== 'minor') throw new Error(`${id} is not a minor company`)
  if (company.status !== 'unstarted') throw new Error(`${id} cannot be started`)
  if (!game.players.some((p) => p.id === presidentId)) throw new Error(`No player ${presidentId}`)
  const index = TRACK.indexOf(price)
  if (index < 1) throw new RangeError(`${price} is not a track price`)
  if (!Number.isFinite(bid) || bid < 0) throw new RangeError('The bid must be a number, 0 or more')
  const started: Game = {
    ...game,
    players: game.players.map((p) => (p.id === presidentId ? { ...p, cash: p.cash - bid } : p)),
    companies: {
      ...game.companies,
      [id]: { ...blankCompany(id, 'active'), president: presidentId, treasuryShares: 3 },
    },
    track: game.track.map((queue, i) => (i === index ? [...queue, id] : queue)),
  }
  return game.settings.live ? addCash(started, id, bid, 'Start: winning bid') : started
}
```

`src/domain/merge.ts`: import `addCash` from `./treasury` and `displayName` from `./companies` (extend the existing `./companies` import). In `applyMerge`, build the merged game as today into a local `merged`, then:

```ts
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
```

(`merged` is the object `applyMerge` returned before; the existing `return { ... }` becomes `const merged: Game = { ... }`.)

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: start company and merge move treasury cash in live games

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Dividends

**Files:**
- Create: `src/domain/dividend.ts`
- Create: `src/domain/dividend.test.ts`

**Interfaces:**
- Consumes: `addCash` (Task 1), `closeCompany` (`company.ts`), `shares`, `TOTAL_SHARES` (`shares.ts`), `findToken`, `moveToken`, `TRACK`, `TOP` (`track.ts`).
- Produces:
  - `type DividendChoice = 'payout' | 'withhold' | 'no-train'`
  - `interface DividendPlan { companyId: CompanyId; choice: DividendChoice; earnings: number; price: number; players: Record<PlayerId, number>; treasury: number; bank: number; steps: -1 | 0 | 1 | 2; newPrice: number }`
  - `dividendPlan(game: Game, id: CompanyId, earnings: number, choice: DividendChoice): DividendPlan` (throws `Error` for an inactive company or one that already acted; `RangeError` for earnings that are not a whole multiple of 10 at or above 0)
  - `applyDividend(game: Game, plan: DividendPlan): Game`

Rules (rulebook pp.14 to 15, R2): a payout of 0 counts as No train. `no-train` ignores the earnings passed in. Payout: each share gets `earnings / TOTAL_SHARES[kind]`, the president card counts 2, treasury shares pay the company treasury, bank pool shares pay nobody (`bank` is only the value shown). Price: payout with `0 < E < P` is `steps 0` (token to the back of its queue), `P <= E < 2P` is `+1`, `E >= 2P` is `+2`; withhold and no train are `-1`. A withhold puts `E` in the treasury.

- [ ] **Step 1: Write the failing tests**

`src/domain/dividend.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyDividend, dividendPlan } from './dividend'
import { put, testGame } from './fixtures'
import { priceOf } from './track'

const [J, K] = ['p1', 'p2']
/** A minor: J president (2), K 1 share, 1 in the treasury, 1 in the bank pool. */
const express = (price = 80) => put(testGame(), 'express', { price, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })

describe('dividendPlan payouts (spec D3 test 15)', () => {
  it('pays the worked example: J 48, K 24, treasury 24, bank 24', () => {
    const plan = dividendPlan(express(), 'express', 120, 'payout')
    expect(plan.players).toEqual({ [J]: 48, [K]: 24 })
    expect(plan.treasury).toBe(24)
    expect(plan.bank).toBe(24)
  })

  it('pays 62 per minor share on earnings of 310 (rulebook example)', () => {
    const plan = dividendPlan(express(), 'express', 310, 'payout')
    expect(plan.players).toEqual({ [J]: 124, [K]: 62 })
    expect(plan.treasury).toBe(62)
  })

  it('pays a tenth per major share and double for the president card', () => {
    const g = put(testGame(), 'federation', { price: 100, president: J, holdings: { [K]: 3 }, treasury: 4, market: 1 })
    const plan = dividendPlan(g, 'federation', 100, 'payout')
    expect(plan.players).toEqual({ [J]: 20, [K]: 30 })
    expect(plan.treasury).toBe(40)
    expect(plan.bank).toBe(10)
  })

  it('does not crash when the company has no president', () => {
    const g = put(testGame(), 'express', { price: 80, president: null, holdings: { [K]: 3 }, treasury: 2 })
    expect(dividendPlan(g, 'express', 50, 'payout').players).toEqual({ [K]: 30 })
  })
})

describe('dividendPlan price effect', () => {
  it.each([
    [30, 'payout', 0, 80],
    [80, 'payout', 1, 90],
    [150, 'payout', 1, 90],
    [160, 'payout', 2, 100],
    [120, 'withhold', -1, 70],
    [120, 'no-train', -1, 70],
  ] as const)('earnings %i, %s: %i steps to %i', (earnings, choice, steps, newPrice) => {
    const plan = dividendPlan(express(80), 'express', earnings, choice)
    expect(plan.steps).toBe(steps)
    expect(plan.newPrice).toBe(newPrice)
  })

  it('treats a payout of 0 as no train: price drops 1 and nobody is paid (rulebook p.11)', () => {
    const plan = dividendPlan(express(), 'express', 0, 'payout')
    expect(plan.choice).toBe('no-train')
    expect(plan.steps).toBe(-1)
    expect(plan.players).toEqual({})
  })

  it('withholds earnings into the treasury and pays nobody', () => {
    const plan = dividendPlan(express(), 'express', 120, 'withhold')
    expect(plan.players).toEqual({})
    expect(plan.treasury).toBe(120)
  })

  it('ignores the earnings for no train', () => {
    const plan = dividendPlan(express(), 'express', 999990, 'no-train')
    expect([plan.earnings, plan.treasury, plan.players]).toEqual([0, 0, {}])
  })

  it('stays at 500 on a rise (review focus 5)', () => {
    const g = put(testGame(), 'express', { price: 500, president: J, treasury: 3 })
    expect(dividendPlan(g, 'express', 1000, 'payout').newPrice).toBe(500)
  })

  it.each([125, -10, NaN, 15.5, Infinity])('rejects earnings of %s (review focus 2)', (earnings) => {
    expect(() => dividendPlan(express(), 'express', earnings, 'payout')).toThrow(RangeError)
  })

  it('rejects a company that is not active', () => {
    expect(() => dividendPlan(testGame(), 'express', 10, 'payout')).toThrow()
  })
})

describe('applyDividend', () => {
  it('credits players and the treasury, raises the price and marks the company as operated', () => {
    const g = express(80)
    const next = applyDividend(g, dividendPlan(g, 'express', 120, 'payout'))
    expect(next.players.map((p) => p.cash)).toEqual([48, 24])
    expect(next.companies.express.treasuryCash).toBe(24)
    expect(next.companies.express.ledger).toHaveLength(1)
    expect(next.companies.express.operated).toBe(true)
    expect(next.operating.acted).toEqual(['express'])
    expect(priceOf(next, 'express')).toBe(90)
  })

  it('puts a token that keeps its price at the back of its queue', () => {
    let g = express(80)
    g = put(g, 'tunneling', { price: 80, president: K, treasury: 3 })
    expect(g.track[8]).toEqual(['express', 'tunneling'])
    const next = applyDividend(g, dividendPlan(g, 'express', 30, 'payout'))
    expect(next.track[8]).toEqual(['tunneling', 'express'])
  })

  it('withholding adds the earnings to the treasury with a ledger entry and drops the price', () => {
    const g = express(80)
    const next = applyDividend(g, dividendPlan(g, 'express', 120, 'withhold'))
    expect(next.companies.express.treasuryCash).toBe(120)
    expect(next.players.map((p) => p.cash)).toEqual([0, 0])
    expect(priceOf(next, 'express')).toBe(70)
  })

  it('closes the company when the price reaches 0 (spec D3 test 19)', () => {
    const g = put(testGame(), 'express', { price: 10, president: J, holdings: { [K]: 1 }, treasury: 2 })
    const plan = dividendPlan(g, 'express', 50, 'withhold')
    expect(plan.newPrice).toBe(0)
    const next = applyDividend(g, plan)
    expect(next.companies.express.status).toBe('closed')
    expect(next.track.flat()).not.toContain('express')
  })

  it('refuses a company that already acted this Operating Round (review focus 3)', () => {
    const g = express(80)
    const once = applyDividend(g, dividendPlan(g, 'express', 120, 'payout'))
    expect(() => dividendPlan(once, 'express', 120, 'payout')).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain/dividend.test.ts`
Expected: FAIL (`./dividend` does not exist).

- [ ] **Step 3: Implement**

`src/domain/dividend.ts`:

```ts
import { kindOf } from './companies'
import { closeCompany } from './company'
import { TOTAL_SHARES, shares } from './shares'
import { TOP, TRACK, findToken, moveToken } from './track'
import { addCash } from './treasury'
import type { CompanyId, Game, PlayerId } from './types'

export type DividendChoice = 'payout' | 'withhold' | 'no-train'

export interface DividendPlan {
  companyId: CompanyId
  /** What the company really did. A payout of 0 counts as no train (rulebook p.11). */
  choice: DividendChoice
  earnings: number
  /** The share price before the move. */
  price: number
  /** Cash each player receives. Players who receive nothing are absent. */
  players: Record<PlayerId, number>
  /** Cash that goes to the company treasury: the payout on its own shares, or the withheld earnings. */
  treasury: number
  /** The payout on bank pool shares. Nobody receives it. Shown for the total. */
  bank: number
  /** Price steps: -1, 0 (unchanged, the token goes to the back), 1 or 2. */
  steps: -1 | 0 | 1 | 2
  /** The price after the move. 0 means the company closes. */
  newPrice: number
}

/**
 * Previews a dividend decision. Does not change the game.
 * `earnings` is a whole multiple of 10 (decision D5). No train ignores it.
 */
export function dividendPlan(game: Game, id: CompanyId, earnings: number, choice: DividendChoice): DividendPlan {
  const company = game.companies[id]
  const pos = findToken(game, id)
  if (!company || company.status !== 'active' || !pos) throw new Error(`${id} is not an active company`)
  if (game.operating.acted.includes(id)) throw new Error(`${id} has already operated this round`)
  if (!Number.isInteger(earnings) || earnings < 0 || earnings % 10 !== 0) {
    throw new RangeError('Earnings are a multiple of 10, 0 or more')
  }

  const price = TRACK[pos.index]
  const effective: DividendChoice = choice === 'payout' && earnings === 0 ? 'no-train' : choice
  const e = effective === 'no-train' ? 0 : earnings

  let steps: DividendPlan['steps'] = -1
  if (effective === 'payout') steps = e < price ? 0 : e < 2 * price ? 1 : 2

  const players: Record<PlayerId, number> = {}
  let treasury = 0
  let bank = 0
  if (effective === 'payout') {
    const each = e / TOTAL_SHARES[kindOf(id)]
    for (const p of game.players) {
      const n = shares(company, p.id)
      if (n > 0) players[p.id] = n * each
    }
    treasury = company.treasuryShares * each
    bank = company.marketShares * each
  } else if (effective === 'withhold') {
    treasury = e
  }

  const index = Math.max(0, Math.min(TOP, pos.index + steps))
  return { companyId: id, choice: effective, earnings: e, price, players, treasury, bank, steps, newPrice: TRACK[index] }
}

/** Applies a plan as one step: cash, treasury, the price move, and the company's acted flags. */
export function applyDividend(game: Game, plan: DividendPlan): Game {
  const id = plan.companyId
  let g: Game = {
    ...game,
    players: game.players.map((p) => ({ ...p, cash: p.cash + (plan.players[p.id] ?? 0) })),
    companies: { ...game.companies, [id]: { ...game.companies[id], operated: true } },
    operating: { ...game.operating, acted: [...game.operating.acted, id] },
  }
  if (plan.treasury > 0) {
    g = addCash(g, id, plan.treasury, plan.choice === 'withhold' ? 'Earnings withheld' : 'Dividend on treasury shares')
  }
  const moved = moveToken(g, id, plan.steps)
  return moved.kind === 'close' ? closeCompany(g, id) : moved.game
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add dividend plan and apply

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Issue and redeem

**Files:**
- Create: `src/domain/issue.ts`
- Create: `src/domain/issue.test.ts`

**Interfaces:**
- Consumes: `addCash` (Task 1), `closeCompany`, `MARKET_LIMIT` (`shares.ts`), `moveToken`, `priceOf`.
- Produces:
  - `type ShareAction = 'issue' | 'redeem'`
  - `type ShareActionCheck = { ok: true; overLimit: boolean } | { ok: false; reason: 'not-active' | 'already-operated' | 'already-issued-or-redeemed' | 'no-treasury-share' | 'no-market-share' }`
  - `checkShareAction(game: Game, id: CompanyId, action: ShareAction): ShareActionCheck`
  - `issueShare(game: Game, id: CompanyId): Game` and `redeemShare(game: Game, id: CompanyId): Game` (both throw `Error` when `checkShareAction` is not ok)

Rules (rulebook p.12, R1, R3, R4): one issue or redeem per company per OR, before it operates. Issue needs a treasury share. Issue puts a treasury share in the bank pool, the company receives the price paid before the drop, price drops 1, and the company closes at 0. Redeem needs a bank pool share, the company pays the current price, price does not change and the token does not move. `overLimit` is true when an issue would take the bank pool above 50%. It is a warning, not a block.

- [ ] **Step 1: Write the failing tests**

`src/domain/issue.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { checkShareAction, issueShare, redeemShare } from './issue'
import { put, testGame } from './fixtures'
import { validate } from './shares'
import { priceOf } from './track'

const [J, K] = ['p1', 'p2']
const g110 = () => put(testGame(), 'express', { price: 110, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })

describe('issue (spec D3 test 18)', () => {
  it('gives the company 110, moves a share to the bank pool and drops the price to 100', () => {
    const next = issueShare(g110(), 'express')
    expect(next.companies.express.treasuryCash).toBe(110)
    expect(next.companies.express.treasuryShares).toBe(0)
    expect(next.companies.express.marketShares).toBe(2)
    expect(priceOf(next, 'express')).toBe(100)
    expect(next.companies.express.ledger).toHaveLength(1)
    expect(next.operating.issuedOrRedeemed).toEqual(['express'])
  })

  it('needs a share in the treasury', () => {
    const g = put(testGame(), 'express', { price: 110, president: J, holdings: { [K]: 3 }, market: 0 })
    expect(checkShareAction(g, 'express', 'issue')).toEqual({ ok: false, reason: 'no-treasury-share' })
    expect(() => issueShare(g, 'express')).toThrow()
  })

  it('warns, and does not block, when the bank pool would go over 50%', () => {
    const g = put(testGame(), 'express', { price: 110, president: J, holdings: { [K]: 1 }, treasury: 1, market: 2 })
    expect(checkShareAction(g, 'express', 'issue')).toEqual({ ok: true, overLimit: true })
    const next = issueShare(g, 'express')
    expect(validate(next).some((w) => w.code === 'market-limit')).toBe(true)
  })

  it('closes the company when the price drops to 0', () => {
    const g = put(testGame(), 'express', { price: 10, president: J, holdings: { [K]: 1 }, treasury: 2 })
    const next = issueShare(g, 'express')
    expect(next.companies.express.status).toBe('closed')
    expect(next.track.flat()).not.toContain('express')
  })
})

describe('redeem (spec D3 test 18)', () => {
  it('takes 110 from the treasury, moves a share back and keeps the price and queue place', () => {
    let g = g110()
    g = put(g, 'tunneling', { price: 110, president: K, treasury: 3 })
    g = { ...g, companies: { ...g.companies, express: { ...g.companies.express, treasuryCash: 200 } } }
    const next = redeemShare(g, 'express')
    expect(next.companies.express.treasuryCash).toBe(90)
    expect(next.companies.express.marketShares).toBe(0)
    expect(next.companies.express.treasuryShares).toBe(2)
    expect(priceOf(next, 'express')).toBe(110)
    expect(next.track[11]).toEqual(['express', 'tunneling'])
  })

  it('is rejected when the bank pool is empty', () => {
    const g = put(testGame(), 'express', { price: 110, president: J, holdings: { [K]: 1 }, treasury: 2 })
    expect(checkShareAction(g, 'express', 'redeem')).toEqual({ ok: false, reason: 'no-market-share' })
    expect(() => redeemShare(g, 'express')).toThrow()
  })
})

describe('one action per Operating Round (review focus 3, rulebook R1)', () => {
  it('refuses a second issue and a redeem after an issue', () => {
    const next = issueShare(g110(), 'express')
    expect(checkShareAction(next, 'express', 'issue')).toEqual({ ok: false, reason: 'already-issued-or-redeemed' })
    expect(checkShareAction(next, 'express', 'redeem')).toEqual({ ok: false, reason: 'already-issued-or-redeemed' })
  })

  it('refuses once the company has operated', () => {
    const g = { ...g110(), operating: { acted: ['express'], issuedOrRedeemed: [] } }
    expect(checkShareAction(g, 'express', 'issue')).toEqual({ ok: false, reason: 'already-operated' })
  })

  it('refuses a company that is not active', () => {
    expect(checkShareAction(testGame(), 'express', 'issue')).toEqual({ ok: false, reason: 'not-active' })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain/issue.test.ts`
Expected: FAIL (`./issue` does not exist).

- [ ] **Step 3: Implement**

`src/domain/issue.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add issue and redeem

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Stock Round turn, selling

**Files:**
- Create: `src/domain/stock.ts`
- Create: `src/domain/stock.test.ts`

**Interfaces:**
- Consumes: `moveToken`, `priceOf` (`track.ts`), `closeCompany`, `MARKET_LIMIT`, `shares` (`shares.ts`), `displayName`, `kindOf` (`companies.ts`).
- Produces (Task 6 extends the same file):
  - `type BuySource = 'treasury' | 'market'`
  - `interface StockTurn { playerId: PlayerId; sells: Record<CompanyId, number>; buy?: { companyId: CompanyId; source: BuySource } }`
  - `type TurnProblemCode = 'not-active' | 'bad-count' | 'not-held' | 'not-operated' | 'market-full' | 'sold-this-round' | 'nothing-to-buy' | 'player-limit' | 'no-cash'`
  - `interface TurnProblem { code: TurnProblemCode; companyId: CompanyId; message: string }`
  - `interface TurnPlan { problems: TurnProblem[]; game: Game; cashBefore: number; cashAfter: number; sold: CompanyId[]; closes: CompanyId[]; presidency: { companyId: CompanyId; from: PlayerId; to: PlayerId }[] }`
  - `planTurn(game: Game, turn: StockTurn): TurnPlan`
  - `applyTurn(game: Game, turn: StockTurn): Game` (throws `Error` joining the problem messages)

This task implements sales only (`turn.buy` is ignored until Task 6), the close handling, and the `soldThisRound` record. Rules (rulebook pp.10 to 11): sell any number of regular shares; the cash is the price before the drop; the price drops 1 step per company sold however many shares; a minor that has not operated cannot be sold; the bank pool holds at most 50% (minor 2, major 5); the president card is not in `holdings`, so it cannot be sold. Sales are processed in the key order of `turn.sells`. A sale that takes a price to 0 closes the company at the end of the turn (listed in `closes`).

- [ ] **Step 1: Write the failing tests**

`src/domain/stock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyTurn, planTurn } from './stock'
import { put, testGame } from './fixtures'
import { setCash } from './edit'
import { priceOf } from './track'

const [J, K] = ['p1', 'p2']

/** J presides over two minors. K holds 1 share of each and has 500 cash. */
function base() {
  let g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 1 }, treasury: 2 })
  g = put(g, 'tunneling', { price: 70, president: J, holdings: { [K]: 1 }, treasury: 2 })
  return setCash(g, K, 500)
}

describe('selling (spec D3 test 16)', () => {
  it('drops each company sold by 1 and pays the price before the drop', () => {
    const turn = { playerId: K, sells: { express: 1, tunneling: 1 } }
    const plan = planTurn(base(), turn)
    expect(plan.problems).toEqual([])
    expect(plan.cashBefore).toBe(500)
    expect(plan.cashAfter).toBe(650)
    expect(plan.sold).toEqual(['express', 'tunneling'])
    const next = applyTurn(base(), turn)
    expect(priceOf(next, 'express')).toBe(70)
    expect(priceOf(next, 'tunneling')).toBe(60)
    expect(next.players.find((p) => p.id === K)?.cash).toBe(650)
    expect(next.companies.express.marketShares).toBe(1)
    expect(next.companies.express.holdings[K]).toBe(0)
  })

  it('drops a company once when several of its shares are sold', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 2 }, treasury: 1 })
    const next = applyTurn(g, { playerId: K, sells: { express: 2 } })
    expect(priceOf(next, 'express')).toBe(70)
    expect(next.players.find((p) => p.id === K)?.cash).toBe(160)
    expect(next.companies.express.marketShares).toBe(2)
  })

  it('cannot sell the president card', () => {
    const plan = planTurn(base(), { playerId: J, sells: { express: 1 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['not-held'])
  })

  it('cannot sell more than held', () => {
    const plan = planTurn(base(), { playerId: K, sells: { express: 2 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['not-held'])
  })

  it('cannot sell a minor that has not operated yet', () => {
    const g = base()
    const fresh = { ...g, companies: { ...g.companies, tunneling: { ...g.companies.tunneling, operated: false } } }
    const plan = planTurn(fresh, { playerId: K, sells: { tunneling: 1 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['not-operated'])
  })

  it('cannot take the bank pool above 50%', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 1 }, market: 2, treasury: 0 })
    const plan = planTurn(g, { playerId: K, sells: { express: 1 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['market-full'])
  })

  it('rejects a count that is not a whole number above 0', () => {
    const plan = planTurn(base(), { playerId: K, sells: { express: 1.5 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['bad-count'])
  })

  it('rejects a company that is not active', () => {
    const plan = planTurn(base(), { playerId: K, sells: { adaptive: 1 } })
    expect(plan.problems.map((p) => p.code)).toEqual(['not-active'])
  })

  it('ignores a company with a count of 0', () => {
    const plan = planTurn(base(), { playerId: K, sells: { express: 0 } })
    expect(plan.problems).toEqual([])
    expect(plan.sold).toEqual([])
  })

  it('records what the player sold for the rest of the Stock Round', () => {
    const next = applyTurn(base(), { playerId: K, sells: { express: 1 } })
    expect(next.soldThisRound).toEqual({ [K]: ['express'] })
    const again = applyTurn(next, { playerId: K, sells: { tunneling: 1 } })
    expect(again.soldThisRound[K]).toEqual(['express', 'tunneling'])
  })

  it('closes a company whose price drops to 0, after the turn (spec D3 test 19)', () => {
    const g = setCash(put(testGame(), 'express', { price: 10, president: J, holdings: { [K]: 1 }, treasury: 2 }), K, 500)
    const turn = { playerId: K, sells: { express: 1 } }
    const plan = planTurn(g, turn)
    expect(plan.closes).toEqual(['express'])
    expect(plan.cashAfter).toBe(510)
    const next = applyTurn(g, turn)
    expect(next.companies.express.status).toBe('closed')
    expect(next.track.flat()).not.toContain('express')
    expect(next.players.find((p) => p.id === K)?.cash).toBe(510)
  })

  it('leaves the game untouched when there is a problem (review focus 1)', () => {
    const g = base()
    const turn = { playerId: K, sells: { express: 1, tunneling: 5 } }
    const plan = planTurn(g, turn)
    expect(plan.problems).toHaveLength(1)
    expect(plan.game).toBe(g)
    expect(plan.cashAfter).toBe(plan.cashBefore)
    expect(() => applyTurn(g, turn)).toThrow()
  })

  it('moves the presidency when a sale leaves another player with more shares (P2-91)', () => {
    const g = put(testGame(), 'federation', { price: 100, president: J, holdings: { [J]: 4, [K]: 4 } })
    const turn = { playerId: J, sells: { federation: 3 } }
    const plan = planTurn(g, turn)
    expect(plan.presidency).toEqual([{ companyId: 'federation', from: J, to: K }])
    const next = applyTurn(g, turn)
    expect(next.companies.federation.president).toBe(K)
    expect(next.companies.federation.holdings).toEqual({ [J]: 3, [K]: 2 })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain/stock.test.ts`
Expected: FAIL (`./stock` does not exist).

- [ ] **Step 3: Implement**

`src/domain/stock.ts`:

```ts
import { displayName, kindOf } from './companies'
import { closeCompany } from './company'
import { presidencyCandidate, transferPresidency } from './presidency'
import { MARKET_LIMIT } from './shares'
import { moveToken, priceOf } from './track'
import type { CompanyId, Game, PlayerId } from './types'

export type BuySource = 'treasury' | 'market'

export interface StockTurn {
  playerId: PlayerId
  /** Regular shares to sell per company. Sold in the key order. */
  sells: Record<CompanyId, number>
  buy?: { companyId: CompanyId; source: BuySource }
}

export type TurnProblemCode =
  | 'not-active'
  | 'bad-count'
  | 'not-held'
  | 'not-operated'
  | 'market-full'
  | 'sold-this-round'
  | 'nothing-to-buy'
  | 'player-limit'
  | 'no-cash'

export interface TurnProblem {
  code: TurnProblemCode
  companyId: CompanyId
  message: string
}

export interface TurnPlan {
  problems: TurnProblem[]
  /** The game after the turn, presidency exchanges and closes included. The input game when there are problems. */
  game: Game
  cashBefore: number
  cashAfter: number
  /** Companies sold. Each drops 1 step. */
  sold: CompanyId[]
  /** Companies that close because the drop reaches 0. The UI confirms before applying. */
  closes: CompanyId[]
  /** Presidency exchanges the rules require after this turn. */
  presidency: { companyId: CompanyId; from: PlayerId; to: PlayerId }[]
}

/** Previews one Stock Round turn: sell, then buy at most one share. Does not change the game. */
export function planTurn(game: Game, turn: StockTurn): TurnPlan {
  const player = game.players.find((p) => p.id === turn.playerId)
  if (!player) throw new Error(`No player ${turn.playerId}`)

  const problems: TurnProblem[] = []
  const problem = (code: TurnProblemCode, companyId: CompanyId, message: string) =>
    problems.push({ code, companyId, message })

  let g = game
  let cash = player.cash
  const sold: CompanyId[] = []
  const closing: CompanyId[] = []

  for (const [companyId, count] of Object.entries(turn.sells)) {
    if (count === 0) continue
    const company = g.companies[companyId]
    if (!company || company.status !== 'active' || priceOf(g, companyId) === null) {
      problem('not-active', companyId, `${companyId} is not in play`)
      continue
    }
    const name = displayName(company)
    const kind = kindOf(companyId)
    const held = company.holdings[turn.playerId] ?? 0
    if (!Number.isInteger(count) || count < 1) {
      problem('bad-count', companyId, `${name}: sell a whole number of shares`)
    } else if (held < count) {
      problem('not-held', companyId, `${name}: ${player.code} holds ${held} shares that can be sold`)
    } else if (kind === 'minor' && !company.operated) {
      problem('not-operated', companyId, `${name} has not operated yet, so its shares cannot be sold`)
    } else if (company.marketShares + count > MARKET_LIMIT[kind]) {
      problem('market-full', companyId, `${name}: the bank pool would hold more than 50%`)
    } else {
      cash += (priceOf(g, companyId) as number) * count
      g = {
        ...g,
        companies: {
          ...g.companies,
          [companyId]: {
            ...company,
            holdings: { ...company.holdings, [turn.playerId]: held - count },
            marketShares: company.marketShares + count,
          },
        },
      }
      const moved = moveToken(g, companyId, -1)
      if (moved.kind === 'close') closing.push(companyId)
      else g = moved.game
      sold.push(companyId)
    }
  }

  if (problems.length > 0) {
    return { problems, game, cashBefore: player.cash, cashAfter: player.cash, sold: [], closes: [], presidency: [] }
  }

  g = {
    ...g,
    players: g.players.map((p) => (p.id === turn.playerId ? { ...p, cash } : p)),
    soldThisRound:
      sold.length === 0
        ? g.soldThisRound
        : {
            ...g.soldThisRound,
            [turn.playerId]: [...new Set([...(g.soldThisRound[turn.playerId] ?? []), ...sold])],
          },
  }

  const presidency: TurnPlan['presidency'] = []
  for (const companyId of sold) {
    if (closing.includes(companyId)) continue
    const to = presidencyCandidate(g, companyId)
    const from = g.companies[companyId].president
    if (to !== null && from !== null) {
      presidency.push({ companyId, from, to })
      g = transferPresidency(g, companyId, to)
    }
  }
  for (const companyId of closing) g = closeCompany(g, companyId)

  return { problems, game: g, cashBefore: player.cash, cashAfter: cash, sold, closes: closing, presidency }
}

/** Applies a turn as one step. Throws when the turn has problems. */
export function applyTurn(game: Game, turn: StockTurn): Game {
  const plan = planTurn(game, turn)
  if (plan.problems.length > 0) throw new Error(plan.problems.map((p) => p.message).join('; '))
  return plan.game
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add the Stock Round turn: sales, closes and presidency

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Stock Round turn, buying

**Files:**
- Modify: `src/domain/stock.ts` (`planTurn`)
- Modify: `src/domain/stock.test.ts`

**Interfaces:**
- Consumes: `StockTurn.buy`, `TurnProblemCode` values `'sold-this-round' | 'nothing-to-buy' | 'player-limit' | 'no-cash'` (Task 5), `addCash` (Task 1), `PLAYER_LIMIT`, `shares` (`shares.ts`).
- Produces: the same functions, now handling `turn.buy`. The presidency check also covers the company bought.

Rules (rulebook p.11): at most one share per turn, after selling. From the treasury: the price is paid into that company's treasury (ledger entry). From the bank pool: the price goes to the bank (no entry). A player holds at most 60% (minor 3 shares, major 6). A player cannot buy a company they sold this Stock Round, in this turn or an earlier one (`soldThisRound`). Sale proceeds from this turn can pay for the purchase. Cash may not go below 0.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/stock.test.ts` (reusing `base()`, `J`, `K` from Task 5):

```ts
describe('buying (spec D3 test 16)', () => {
  it('buys from the treasury: the price goes to the company treasury with a ledger entry', () => {
    const turn = { playerId: K, sells: {}, buy: { companyId: 'tunneling', source: 'treasury' as const } }
    const next = applyTurn(base(), turn)
    expect(next.players.find((p) => p.id === K)?.cash).toBe(430)
    expect(next.companies.tunneling.holdings[K]).toBe(2)
    expect(next.companies.tunneling.treasuryShares).toBe(1)
    expect(next.companies.tunneling.treasuryCash).toBe(70)
    expect(next.companies.tunneling.ledger).toHaveLength(1)
  })

  it('buys from the bank pool: the price goes to the bank, not to a treasury', () => {
    let g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
    g = setCash(g, K, 100)
    const next = applyTurn(g, { playerId: K, sells: {}, buy: { companyId: 'express', source: 'market' } })
    expect(next.players.find((p) => p.id === K)?.cash).toBe(20)
    expect(next.companies.express.marketShares).toBe(0)
    expect(next.companies.express.treasuryCash).toBe(0)
    expect(next.companies.express.ledger).toEqual([])
  })

  it('refuses a source with nothing in it', () => {
    const plan = planTurn(base(), { playerId: K, sells: {}, buy: { companyId: 'express', source: 'market' } })
    expect(plan.problems.map((p) => p.code)).toEqual(['nothing-to-buy'])
  })

  it('refuses a fourth share of a minor (60% limit)', () => {
    const g = setCash(put(testGame(), 'express', { price: 80, president: null, holdings: { [K]: 3 }, treasury: 1, market: 1 }), K, 500)
    const plan = planTurn(g, { playerId: K, sells: {}, buy: { companyId: 'express', source: 'treasury' } })
    expect(plan.problems.map((p) => p.code)).toEqual(['player-limit'])
  })

  it('refuses a company sold in the same turn', () => {
    const plan = planTurn(base(), {
      playerId: K,
      sells: { express: 1 },
      buy: { companyId: 'express', source: 'treasury' },
    })
    expect(plan.problems.map((p) => p.code)).toEqual(['sold-this-round'])
  })

  it('refuses a company sold in an earlier turn of this Stock Round', () => {
    const g = { ...base(), soldThisRound: { [K]: ['express'] } }
    const plan = planTurn(g, { playerId: K, sells: {}, buy: { companyId: 'express', source: 'treasury' } })
    expect(plan.problems.map((p) => p.code)).toEqual(['sold-this-round'])
  })

  it('refuses when the player cannot pay', () => {
    const g = setCash(base(), K, 50)
    const plan = planTurn(g, { playerId: K, sells: {}, buy: { companyId: 'tunneling', source: 'treasury' } })
    expect(plan.problems.map((p) => p.code)).toEqual(['no-cash'])
  })

  it('lets the cash from this turn’s sale pay for the purchase', () => {
    const g = setCash(base(), K, 50)
    const next = applyTurn(g, { playerId: K, sells: { express: 1 }, buy: { companyId: 'tunneling', source: 'treasury' } })
    expect(next.players.find((p) => p.id === K)?.cash).toBe(60)
    expect(next.soldThisRound).toEqual({ [K]: ['express'] })
  })

  it('moves the presidency when a purchase leaves another player with more shares (P2-91)', () => {
    const g = setCash(
      put(testGame(), 'federation', { price: 100, president: J, holdings: { [J]: 2, [K]: 4 }, treasury: 1, market: 1 }),
      K,
      500,
    )
    const turn = { playerId: K, sells: {}, buy: { companyId: 'federation', source: 'treasury' as const } }
    const plan = planTurn(g, turn)
    expect(plan.presidency).toEqual([{ companyId: 'federation', from: J, to: K }])
    const next = applyTurn(g, turn)
    expect(next.companies.federation.president).toBe(K)
    expect(next.companies.federation.holdings).toEqual({ [J]: 4, [K]: 3 })
    expect(next.players.find((p) => p.id === K)?.cash).toBe(400)
  })

  it('does not apply a sale when the purchase has a problem (review focus 1)', () => {
    const g = base()
    const turn = { playerId: K, sells: { express: 1 }, buy: { companyId: 'express', source: 'treasury' as const } }
    expect(planTurn(g, turn).game).toBe(g)
    expect(() => applyTurn(g, turn)).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain/stock.test.ts`
Expected: FAIL (the purchase is ignored, so cash and shares do not change and no problem is raised).

- [ ] **Step 3: Implement**

In `src/domain/stock.ts` extend the imports with `PLAYER_LIMIT`, `shares` (from `./shares`) and `addCash` (from `./treasury`). In `planTurn`, add a `bought` variable next to `closing`:

```ts
  let bought: CompanyId | null = null
```

and, between the sales loop and the `if (problems.length > 0)` block, the purchase:

```ts
  if (turn.buy) {
    const { companyId, source } = turn.buy
    const company = g.companies[companyId]
    if (!company || company.status !== 'active' || priceOf(g, companyId) === null) {
      problem('not-active', companyId, `${companyId} is not in play`)
    } else {
      const name = displayName(company)
      const kind = kindOf(companyId)
      const price = priceOf(g, companyId) as number
      const soldEarlier = (game.soldThisRound[turn.playerId] ?? []).includes(companyId)
      if (sold.includes(companyId) || closing.includes(companyId) || soldEarlier) {
        problem('sold-this-round', companyId, `${name}: ${player.code} sold it this Stock Round`)
      } else if ((source === 'treasury' ? company.treasuryShares : company.marketShares) < 1) {
        problem('nothing-to-buy', companyId, `${name}: no share in the ${source === 'treasury' ? 'treasury' : 'bank pool'}`)
      } else if (shares(company, turn.playerId) + 1 > PLAYER_LIMIT[kind]) {
        problem('player-limit', companyId, `${name}: ${player.code} would hold more than 60%`)
      } else if (cash < price) {
        problem('no-cash', companyId, `${name}: ${player.code} has ${cash}, the price is ${price}`)
      } else {
        cash -= price
        g = {
          ...g,
          companies: {
            ...g.companies,
            [companyId]: {
              ...company,
              holdings: { ...company.holdings, [turn.playerId]: (company.holdings[turn.playerId] ?? 0) + 1 },
              treasuryShares: company.treasuryShares - (source === 'treasury' ? 1 : 0),
              marketShares: company.marketShares - (source === 'market' ? 1 : 0),
            },
          },
        }
        if (source === 'treasury') g = addCash(g, companyId, price, `Share bought: ${name}`)
        bought = companyId
      }
    }
  }
```

Change the presidency loop to include the company bought:

```ts
  const touched = bought === null ? sold : [...sold, bought]
  for (const companyId of touched) {
    if (closing.includes(companyId)) continue
    ...
```

(the loop body is unchanged). The returned plan's `sold` stays the sold list only.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add buying to the Stock Round turn

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rounds, end of Stock Round, snapshots, action gating

**Files:**
- Create: `src/domain/rounds.ts`
- Create: `src/domain/rounds.test.ts`

**Interfaces:**
- Consumes: `turnOrder`, `playerTotal` (`scoring.ts`), `moveToken` (`track.ts`), `canMerge` (`merge.ts`).
- Produces:
  - `cycleCount(game: Game): number` (4 for a Short Game, 6 for a Long Game)
  - `isGameOver(game: Game): boolean` (`round.cycle > cycleCount`)
  - `hasMergerRound(game: Game): boolean` (phase is not yellow)
  - `saveSnapshot(game: Game): Game` (stores every player's total at `cycleScores[cycle - 1]`, replacing a snapshot for that cycle)
  - `advanceRound(game: Game): Game` (throws when the game is over)
  - `stockRoundRisers(game: Game): CompanyId[]`
  - `endStockRound(game: Game, skip?: CompanyId[]): Game` (applies the +1 step, then advances to OR1)
  - `nextToOperate(game: Game): CompanyId | null`
  - `interface Actions { stock: boolean; startCompany: boolean; dividend: boolean; issueRedeem: boolean; merge: boolean }`
  - `actionsAllowed(game: Game): Actions`

Rules (rulebook pp.11, 12, 18, 19; spec A3 and A4): a cycle is SR, OR1, OR2, then MR only when the phase is green or later, then the Export a train reminder (not a state), then the next cycle's SR. Entering an OR clears `operating`. Entering an SR clears `soldThisRound`. A snapshot is saved when a cycle ends. After the last cycle the round is `{ cycle: cycleCount + 1, type: 'SR' }`, which `isGameOver` reports. End of Stock Round: a company with no treasury and no bank pool shares rises 1 step and joins the back of its new queue; several risers are processed in current turn order (decision D8); a token at 500 stays and goes to the back. A manual (non-live) game has no gating: every action is allowed.

- [ ] **Step 1: Write the failing tests**

`src/domain/rounds.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  actionsAllowed,
  advanceRound,
  cycleCount,
  endStockRound,
  hasMergerRound,
  isGameOver,
  nextToOperate,
  saveSnapshot,
  stockRoundRisers,
} from './rounds'
import { put, testGame, withRound } from './fixtures'
import { setCash, setPhase } from './edit'
import { priceOf } from './track'

const [J, K] = ['p1', 'p2']
const roundOf = (g: ReturnType<typeof testGame>) => `${g.round.cycle}${g.round.type}`

describe('round order (spec D3 test 20)', () => {
  it('skips the Merger Round in the yellow phase', () => {
    let g = testGame()
    const seen = [roundOf(g)]
    for (let i = 0; i < 3; i++) {
      g = advanceRound(g)
      seen.push(roundOf(g))
    }
    expect(seen).toEqual(['1SR', '1OR1', '1OR2', '2SR'])
    expect(hasMergerRound(g)).toBe(false)
  })

  it('plays the Merger Round from the green phase', () => {
    let g = setPhase(testGame(), 'green')
    const seen = [roundOf(g)]
    for (let i = 0; i < 4; i++) {
      g = advanceRound(g)
      seen.push(roundOf(g))
    }
    expect(seen).toEqual(['1SR', '1OR1', '1OR2', '1MR', '2SR'])
  })

  it('plays no Merger Round when the phase turns green after the Operating Rounds (Export a train)', () => {
    let g = withRound(testGame(), 1, 'OR2')
    g = advanceRound(g)
    g = setPhase(g, 'green')
    expect(roundOf(g)).toBe('2SR')
  })

  it('has 4 cycles in a Short Game and 6 in a Long Game, and ends after the last (review focus 5 style)', () => {
    const long = testGame()
    expect(cycleCount(long)).toBe(6)
    const short = { ...testGame(), settings: { ...testGame().settings, shortGame: true } }
    expect(cycleCount(short)).toBe(4)
    const last = withRound(short, 4, 'OR2')
    expect(isGameOver(last)).toBe(false)
    const over = advanceRound(last)
    expect(isGameOver(over)).toBe(true)
    expect(over.round).toEqual({ cycle: 5, type: 'SR' })
    expect(() => advanceRound(over)).toThrow()
    expect(over.cycleScores).toHaveLength(4)
  })

  it('clears the Operating Round state on entering an OR and the sales record on entering an SR', () => {
    let g = { ...testGame(), operating: { acted: ['express'], issuedOrRedeemed: ['express'] }, soldThisRound: { [K]: ['express'] } }
    g = advanceRound(g)
    expect(g.round.type).toBe('OR1')
    expect(g.operating).toEqual({ acted: [], issuedOrRedeemed: [] })
    g = { ...withRound(g, 1, 'OR2'), soldThisRound: { [K]: ['express'] } }
    g = advanceRound(g)
    expect(g.round.type).toBe('SR')
    expect(g.soldThisRound).toEqual({})
  })
})

describe('snapshots', () => {
  const game = () => setCash(setCash(put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 }), J, 100), K, 0)

  it('stores every player total at the end of a cycle', () => {
    const next = advanceRound(withRound(game(), 1, 'OR2'))
    expect(next.cycleScores).toEqual([{ [J]: 260, [K]: 80 }])
  })

  it('replaces the snapshot for the same cycle when saved again', () => {
    let g = withRound(game(), 2, 'OR1')
    g = saveSnapshot(g)
    g = setCash(g, K, 50)
    g = saveSnapshot(g)
    expect(g.cycleScores).toHaveLength(2)
    expect(g.cycleScores[1]).toEqual({ [J]: 260, [K]: 130 })
    expect(g.cycleScores[0]).toEqual({})
  })
})

describe('end of Stock Round (spec D3 test 17)', () => {
  const full = (price: number, id: string, g = testGame()) => put(g, id, { price, president: J, holdings: { [K]: 3 } })

  it('raises only the companies fully owned by players, to the back of the new queue', () => {
    let g = full(80, 'express')
    g = put(g, 'tunneling', { price: 70, president: J, holdings: { [K]: 1 }, treasury: 2 })
    g = put(g, 'resourceful', { price: 90, president: K, treasury: 3 })
    expect(stockRoundRisers(g)).toEqual(['express'])
    const next = endStockRound(g)
    expect(priceOf(next, 'express')).toBe(90)
    expect(next.track[9]).toEqual(['resourceful', 'express'])
    expect(priceOf(next, 'tunneling')).toBe(70)
  })

  it('does not rise a company with a share in the bank pool', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 2 }, market: 1 })
    expect(stockRoundRisers(g)).toEqual([])
  })

  it('stacks several risers in turn order (decision D8)', () => {
    let g = full(80, 'express')
    g = full(80, 'tunneling', g)
    expect(g.track[8]).toEqual(['express', 'tunneling'])
    const next = endStockRound(g)
    expect(next.track[9]).toEqual(['express', 'tunneling'])
  })

  it('keeps the companies in the skip list where they are', () => {
    let g = full(80, 'express')
    g = full(80, 'tunneling', g)
    const next = endStockRound(g, ['tunneling'])
    expect(priceOf(next, 'express')).toBe(90)
    expect(priceOf(next, 'tunneling')).toBe(80)
  })

  it('stays at 500 and goes to the back (review focus 5)', () => {
    let g = full(500, 'express')
    g = put(g, 'tunneling', { price: 500, president: K, treasury: 3 })
    const next = endStockRound(g)
    expect(next.track[26]).toEqual(['tunneling', 'express'])
  })

  it('then moves to the first Operating Round', () => {
    const next = endStockRound(testGame())
    expect(roundOf(next)).toBe('1OR1')
  })
})

describe('who operates next (rulebook p.11 to 12)', () => {
  const ors = () => withRound(put(put(testGame(), 'express', { price: 80, president: J, treasury: 3 }), 'tunneling', { price: 70, president: K, treasury: 3 }), 1, 'OR1')

  it('is the highest price that has not acted', () => {
    expect(nextToOperate(ors())).toBe('express')
    expect(nextToOperate({ ...ors(), operating: { acted: ['express'], issuedOrRedeemed: [] } })).toBe('tunneling')
    expect(nextToOperate({ ...ors(), operating: { acted: ['express', 'tunneling'], issuedOrRedeemed: [] } })).toBeNull()
  })

  it('follows a price change during the round', () => {
    let g = ors()
    g = { ...g, track: g.track.map((q, i) => (i === 8 ? [] : i === 6 ? ['express'] : q)) }
    expect(nextToOperate(g)).toBe('tunneling')
  })

  it('is null outside an Operating Round', () => {
    expect(nextToOperate(withRound(ors(), 1, 'SR'))).toBeNull()
    expect(nextToOperate(withRound(ors(), 1, 'MR'))).toBeNull()
  })
})

describe('actionsAllowed', () => {
  const none = { stock: false, startCompany: false, dividend: false, issueRedeem: false, merge: false }

  it('allows stock actions only in a Stock Round', () => {
    expect(actionsAllowed(testGame())).toEqual({ ...none, stock: true, startCompany: true })
  })

  it('allows dividend and issue only in an Operating Round', () => {
    expect(actionsAllowed(withRound(testGame(), 1, 'OR2'))).toEqual({ ...none, dividend: true, issueRedeem: true })
  })

  it('allows a merge only in the Merger Round, and only from the green phase', () => {
    const mr = withRound(setPhase(testGame(), 'green'), 1, 'MR')
    expect(actionsAllowed(mr)).toEqual({ ...none, merge: true })
    expect(actionsAllowed(setPhase(mr, 'yellow')).merge).toBe(false)
  })

  it('allows nothing when the game is over', () => {
    expect(actionsAllowed(withRound(testGame(), 7, 'SR'))).toEqual(none)
  })

  it('allows everything in a manual game (Phase 1 behavior, P2-93)', () => {
    const manual = { ...testGame(), settings: { ...testGame().settings, live: false } }
    expect(actionsAllowed(manual)).toEqual({ stock: true, startCompany: true, dividend: true, issueRedeem: true, merge: true })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain/rounds.test.ts`
Expected: FAIL (`./rounds` does not exist).

- [ ] **Step 3: Implement**

`src/domain/rounds.ts`:

```ts
import { playerTotal, turnOrder } from './scoring'
import { moveToken } from './track'
import type { CompanyId, Game, PlayerId, RoundType } from './types'

export function cycleCount(game: Game): number {
  return game.settings.shortGame ? 4 : 6
}

/** True once the last cycle has ended. `advanceRound` then moves the round to `cycleCount + 1`. */
export function isGameOver(game: Game): boolean {
  return game.round.cycle > cycleCount(game)
}

/** The Merger Round happens only from the green phase (rulebook p.18). */
export function hasMergerRound(game: Game): boolean {
  return game.settings.phase !== 'yellow'
}

/** Stores every player's total for the current cycle, replacing an earlier snapshot of that cycle. */
export function saveSnapshot(game: Game): Game {
  const totals: Record<PlayerId, number> = {}
  for (const p of game.players) totals[p.id] = playerTotal(game, p.id)
  const scores = [...game.cycleScores]
  while (scores.length < game.round.cycle - 1) scores.push({})
  scores[game.round.cycle - 1] = totals
  return { ...game, cycleScores: scores }
}

function enter(game: Game, cycle: number, type: RoundType): Game {
  const next: Game = { ...game, round: { cycle, type } }
  if (type === 'SR') return { ...next, soldThisRound: {} }
  if (type === 'OR1' || type === 'OR2') return { ...next, operating: { acted: [], issuedOrRedeemed: [] } }
  return next
}

/** Moves to the next round. The cycle ends after OR2 or the Merger Round, which saves a snapshot. */
export function advanceRound(game: Game): Game {
  if (isGameOver(game)) throw new Error('The game is over')
  const { cycle, type } = game.round
  if (type === 'SR') return enter(game, cycle, 'OR1')
  if (type === 'OR1') return enter(game, cycle, 'OR2')
  if (type === 'OR2' && hasMergerRound(game)) return enter(game, cycle, 'MR')
  return enter(saveSnapshot(game), cycle + 1, 'SR')
}

/** Active companies that are fully owned by players, in turn order (rulebook p.11, decision D8). */
export function stockRoundRisers(game: Game): CompanyId[] {
  return turnOrder(game).filter((id) => {
    const c = game.companies[id]
    return c.status === 'active' && c.treasuryShares === 0 && c.marketShares === 0
  })
}

/** The end-of-Stock-Round bonus (+1 step, to the back), then the first Operating Round. */
export function endStockRound(game: Game, skip: CompanyId[] = []): Game {
  let g = game
  for (const id of stockRoundRisers(game)) {
    if (skip.includes(id)) continue
    const moved = moveToken(g, id, 1)
    if (moved.kind === 'moved') g = moved.game
  }
  return advanceRound(g)
}

/** The next company to act: highest price first, then queue order, skipping those that acted. */
export function nextToOperate(game: Game): CompanyId | null {
  if (game.round.type !== 'OR1' && game.round.type !== 'OR2') return null
  return turnOrder(game).find((id) => !game.operating.acted.includes(id)) ?? null
}

export interface Actions {
  stock: boolean
  startCompany: boolean
  dividend: boolean
  issueRedeem: boolean
  merge: boolean
}

/** Which actions the current round allows. A manual game allows everything (Phase 1 behavior). */
export function actionsAllowed(game: Game): Actions {
  if (!game.settings.live) return { stock: true, startCompany: true, dividend: true, issueRedeem: true, merge: true }
  const none: Actions = { stock: false, startCompany: false, dividend: false, issueRedeem: false, merge: false }
  if (isGameOver(game)) return none
  switch (game.round.type) {
    case 'SR':
      return { ...none, stock: true, startCompany: true }
    case 'OR1':
    case 'OR2':
      return { ...none, dividend: true, issueRedeem: true }
    case 'MR':
      return { ...none, merge: hasMergerRound(game) }
  }
}
```

Merge also needs `canMerge` (two minors and an unstarted major). Keep that check where it is (`merge.ts`); `actionsAllowed` answers only "is it the right round".

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add rounds, end of Stock Round, snapshots and action gating

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/design/phase-2-implementation-list.md`
- Modify: `docs/design/lost-atlas-tracker-design-spec.md` (A4 and D4 only)

- [ ] **Step 1: CLAUDE.md**

In the `src/domain/` section add one bullet per module, in the file's style:

```markdown
- Phase 2 rule modules (pure, live-mode only; the UI calls them, they do not check `settings.live`): `treasury.ts` (`addCash`, `manualEntry`, the ledger), `dividend.ts` (`dividendPlan`, `applyDividend`), `issue.ts` (`checkShareAction`, `issueShare`, `redeemShare`), `stock.ts` (`planTurn`, `applyTurn`: sell, then buy one share; presidency exchanges and closes are part of the turn), `rounds.ts` (`advanceRound`, `endStockRound`, `saveSnapshot`, `nextToOperate`, `actionsAllowed`). A plan function previews and returns `problems`; an apply function is one history entry.
- `startCompany`, `applyMerge` and `closeCompany` run in both modes and touch treasury cash and the ledger only when `settings.live` is true.
```

- [ ] **Step 2: The list**

Mark P2-03, P2-04, P2-90, P2-91, P2-93 and P2-94 "Done in Plan 2" using the wording already used for the Plan 1 items. Add "Domain done in Plan 2" to P2-25, P2-31, P2-32, P2-33, P2-40, P2-41, P2-50. In P2-31 and P2-34 add that a payout of 0 counts as No train (price drops 1). In P2-32 add that Issue needs a treasury share and that issue and redeem together are one action per company per OR. In P2-26 add that several risers stack in turn order (D8).

- [ ] **Step 3: The spec**

In A4 "Dividends", under Choice 1, add one line: "A payout of 0 (a company that has a train but earns nothing) counts as No train: the price drops 1 (rulebook p.11, failure to generate revenue)." Under "Operating Round, issue and redeem", add: "A company issues or redeems at most one share per Operating Round, and issue needs a share in the treasury." In D4 item 6, replace the sentence about the 50% limit with: "The rulebook words the 50% bank pool limit 'at any time' (p.10), so it applies to issue too. The app warns and does not block." Touch nothing else.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add CLAUDE.md docs
git commit -m "docs: record the Phase 2 domain rule modules

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage:** D3 test 15 (Task 3), 16 (Tasks 5 and 6), 17 (Task 7), 18 (Task 4), 19 (Tasks 3, 4 and 5), 20 (Task 7). P2-91 (Tasks 5 and 6), P2-93 (Tasks 2 and 7), P2-94 (Task 2), P2-04 (each apply function returns one `Game`). P2-92 and P2-95 were Plan 1 and F2.
- **Not in this plan:** ledger correction (P2-42, Plan 5), `setRound` and the other edit-mode setters (P2-60, Plan 6), the Setup `live` toggle and every UI (Plans 3 to 6), the merge UI gating (`actionsAllowed` is the domain half of P2-13 and P2-51).
- **Types:** `StockTurn`, `TurnPlan`, `DividendPlan`, `ShareActionCheck`, `Actions` are defined once and used with the same names. `operating.issuedOrRedeemed` matches `types.ts`. `addCash` has the signature `(game, id, delta, what, auto?)` everywhere.
- **Assumptions that could be wrong:** the Task 5 and 6 tests assume `put(...)` can seat a holder without a president (`president: null`), that `'federation'` is a major id, and that `'adaptive'` is an unstarted minor in a Long Game. All three match the existing tests and `companies.json`; an implementer who finds otherwise should report it rather than change the fixture.
