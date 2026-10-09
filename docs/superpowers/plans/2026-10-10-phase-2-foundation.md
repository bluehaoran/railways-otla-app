# Phase 2 Foundation (Schema v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the saved `Game` to schema version 2 with every field Phase 2 needs, so Phase 1 saves and exports load unchanged and later plans only add behavior.

**Architecture:** Add the new fields to `Game` and `Company`, give every place that builds a `Company` one shared `blankCompany()` factory, add a `MIGRATIONS[1]` step plus `checkGame` rules in `saves.ts`, and bump the version. No UI and no rule changes: a game with `settings.live = false` behaves exactly as in Phase 1.

**Tech Stack:** TypeScript (strict, `noUnusedLocals`), Vue 3, VueUse, Vitest.

**Spec:** `docs/design/lost-atlas-tracker-design-spec.md` (B3 data model, B7 saves, A4 treasury cash). List: `docs/design/phase-2-implementation-list.md` items P2-01, P2-02, P2-43, P2-92. Roadmap: `docs/superpowers/plans/2026-10-10-phase-2-roadmap.md`.

## Global Constraints

- Domain code is pure TypeScript with no Vue imports. Every function returns a new `Game` and never mutates.
- A change to the `Game` shape needs a schema version bump, a migration and a matching `checkGame` update (CLAUDE.md).
- `Company.holdings` counts regular cards only. Use `shares()`.
- Treasury cash is never scored. `playerTotal` must not read it (P2-43).
- Phase 1 saved games must load. Phase 1 behavior must not change when `settings.live` is false.
- `npm test` and `npm run typecheck` must both pass before each commit. There is no linter.
- Commit locally on `main` per the repo workflow. Do not push.

## Review Focus

1. A v1 saved game that has undo and redo history: opens with the game intact and empty history, and does not crash. Test in Task 3.
2. A v1 export file imports as a v2 game with `live: false` and every default filled in. Test in Task 2.
3. A v2 file with one bad new field (treasury cash as a string, a ledger entry with no `delta`, round type `'XX'`): rejected with the field name, not accepted and crashing a view later. Test in Task 4.
4. A v1 game that already has active companies: each gets `operated: true`, unstarted and closed ones get `false` (D6). Test in Task 2.
5. A file with a version above 2: still rejected with the version in the message. Update the existing test in Task 2.

---

### Task 1: New fields, factory and domain literals

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/company.ts`
- Modify: `src/domain/setup.ts`
- Modify: `src/domain/merge.ts:124-148`
- Modify: `src/domain/fixtures.ts`
- Test: `src/domain/setup.test.ts`, `src/domain/company.test.ts`, `src/domain/merge.test.ts`

**Interfaces:**
- Produces (later tasks and plans rely on these exact names):
  - `type RoundType = 'SR' | 'OR1' | 'OR2' | 'MR'`
  - `interface LedgerEntry { cycle: number; round: RoundType; what: string; delta: number; auto: boolean }`
  - `Company.treasuryCash: number`, `Company.operated: boolean`, `Company.ledger: LedgerEntry[]`
  - `Game.schemaVersion: 2`, `Game.settings.live: boolean`, `Game.round: { cycle: number; type: RoundType }`, `Game.cycleScores: Record<PlayerId, number>[]`, `Game.soldThisRound: Record<PlayerId, CompanyId[]>`, `Game.operating: { acted: CompanyId[]; issuedOrRedeemed: CompanyId[] }`
  - `blankCompany(id: CompanyId, status: CompanyStatus): Company` exported from `src/domain/company.ts`
  - `NewGameOptions.live?: boolean` (default `true`)

- [ ] **Step 1: Write the failing tests**

In `src/domain/setup.test.ts`, change `expect(g.schemaVersion).toBe(1)` to `toBe(2)` and the settings assertion, then add a test:

```ts
    expect(g.settings).toEqual({ shortGame: false, phase: 'yellow', mainView: 'track', live: true })
```

```ts
  it('starts a new game in the first Stock Round with empty Phase 2 state', () => {
    const g = newGame({ name: 'A', players: players(2), shortGame: true, phase: 'yellow' })
    expect(g.round).toEqual({ cycle: 1, type: 'SR' })
    expect(g.cycleScores).toEqual([])
    expect(g.soldThisRound).toEqual({})
    expect(g.operating).toEqual({ acted: [], issuedOrRedeemed: [] })
    const c = g.companies.express
    expect([c.treasuryCash, c.operated, c.ledger]).toEqual([0, false, []])
  })

  it('can create a manual (not live) game', () => {
    const g = newGame({ name: 'A', players: players(2), shortGame: true, phase: 'yellow', live: false })
    expect(g.settings.live).toBe(false)
  })
```

In `src/domain/company.test.ts`, extend both expected company literals. `startCompany` (line 13):

```ts
    expect(g.companies.express).toEqual({
      id: 'express',
      status: 'active',
      president: K,
      holdings: {},
      treasuryShares: 3,
      marketShares: 0,
      treasuryCash: 0,
      operated: false,
      ledger: [],
    })
```

`closeCompany` (line 64) gets the same three added lines with `status: 'closed'`.

In `src/domain/merge.test.ts`, add inside the existing describe that contains the `applyMerge` tests (next to the test that uses `test7()`):

```ts
  it('marks the new major as operated and the retired minors as not', () => {
    const g = test7()
    const merged = applyMerge(g, mergePlan(g, 'tunneling', 'express', 'union'))
    expect(merged.companies.union.operated).toBe(true)
    expect(merged.companies.union.ledger).toEqual([])
    expect(merged.companies.tunneling).toMatchObject({ status: 'merged', operated: false, treasuryCash: 0 })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/setup.test.ts src/domain/company.test.ts src/domain/merge.test.ts`
Expected: FAIL (schemaVersion is 1, `round` is undefined, `treasuryCash` is undefined).

- [ ] **Step 3: Implement**

`src/domain/types.ts`, replace from `export interface Company` to the end of `Game`:

```ts
export type RoundType = 'SR' | 'OR1' | 'OR2' | 'MR'

/** One change to a company's treasury cash. Positive `delta` is cash in. */
export interface LedgerEntry {
  cycle: number
  round: RoundType
  what: string
  delta: number
  /** True when the app wrote the entry, false when the user typed it. */
  auto: boolean
}

export interface Company {
  id: CompanyId
  status: CompanyStatus
  president: PlayerId | null
  holdings: Record<PlayerId, number> // regular cards only
  treasuryShares: number // regular cards
  marketShares: number // regular cards
  identity?: number // majors: index into the names list (name toggle)
  /** Company treasury cash. Never part of a player's score. */
  treasuryCash: number
  /** False for a minor that has not had its first Operating Round yet. Its shares cannot be sold. */
  operated: boolean
  ledger: LedgerEntry[]
}

export interface Game {
  schemaVersion: 2
  id: string
  name: string
  createdAt: string // ISO
  /** `live`: Phase 2 automation (cash, rounds, ledger) runs only when true. */
  settings: { shortGame: boolean; phase: Phase; mainView: ViewId; live: boolean }
  players: Player[] // order = clockwise seating
  companies: Record<CompanyId, Company>
  track: CompanyId[][] // length 27; track[i] is the queue at TRACK[i]; index 0 is the front
  round: { cycle: number; type: RoundType }
  /** Each player's total at the end of a cycle. Index 0 is cycle 1. */
  cycleScores: Record<PlayerId, number>[]
  /** Companies each player sold in this Stock Round. Cleared when a Stock Round starts. */
  soldThisRound: Record<PlayerId, CompanyId[]>
  /** Companies that have already acted, and that have already issued or redeemed, in this Operating Round. */
  operating: { acted: CompanyId[]; issuedOrRedeemed: CompanyId[] }
}
```

`src/domain/company.ts`, add the import and factory, and use it in both functions:

```ts
import { COMPANIES } from './companies'
import { TRACK } from './track'
import type { Company, CompanyId, CompanyStatus, Game, PlayerId } from './types'

/** A company with no owners, no cash and no history. */
export function blankCompany(id: CompanyId, status: CompanyStatus): Company {
  return { id, status, president: null, holdings: {}, treasuryShares: 0, marketShares: 0, treasuryCash: 0, operated: false, ledger: [] }
}
```

In `startCompany` replace the `[id]: { ... }` literal with:

```ts
      [id]: { ...blankCompany(id, 'active'), president: presidentId, treasuryShares: 3 },
```

In `closeCompany` replace the literal with:

```ts
      [id]: blankCompany(id, 'closed'),
```

`src/domain/setup.ts`: import `blankCompany` from `./company`; add `live?: boolean` to `NewGameOptions`; in `newGame` replace the company literal with:

```ts
    companies[companyId] = blankCompany(
      companyId,
      opts.shortGame && SHORT_GAME_REMOVED.includes(companyId) ? 'unavailable' : 'unstarted',
    )
```

and the returned object becomes:

```ts
  return {
    schemaVersion: 2,
    id,
    name: opts.name,
    createdAt,
    settings: { shortGame: opts.shortGame, phase: opts.phase, mainView: 'track', live: opts.live ?? true },
    players: opts.players.map((p, i) => ({ id: `p${i + 1}`, name: p.name, code: p.code, cash: p.cash })),
    companies,
    track: Array.from({ length: 27 }, () => []),
    round: { cycle: 1, type: 'SR' },
    cycleScores: [],
    soldThisRound: {},
    operating: { acted: [], issuedOrRedeemed: [] },
  }
```

`src/domain/merge.ts`: import `blankCompany` from `./company` (remove nothing else). Replace the `retired` helper and the `[plan.mId]` literal:

```ts
  const retired = (id: CompanyId) => blankCompany(id, 'merged')
```

```ts
      [plan.mId]: {
        ...blankCompany(plan.mId, 'active'),
        president: plan.newPresident,
        holdings: { ...plan.holdings },
        treasuryShares: plan.treasuryShares,
        marketShares: plan.marketShares,
        identity: plan.identity,
        operated: true,
      },
```

`src/domain/fixtures.ts`, in `put`, the company literal already spreads `game.companies[id]`, so the new fields carry over. Add `operated: true` there, because a company put straight onto the track stands for one that is already running:

```ts
        status: 'active',
        operated: true,
        president: o.president ?? null,
```

- [ ] **Step 4: Run the domain tests**

Run: `npx vitest run src/domain`
Expected: PASS.

- [ ] **Step 5: Typecheck to find every other literal**

Run: `npm run typecheck`
Expected: errors only in files that build a `Game` or `Company` by hand (expected: `src/state/game.ts:31`, `src/state/saves.ts`, and test files). Fix test-file literals by spreading `testGame()` or `blankCompany()`. Leave `saves.ts` and `game.ts` errors for Tasks 2 and 3.

- [ ] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat: add Phase 2 fields to Game and Company, with a blankCompany factory

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(The typecheck is not clean until Task 3. Commit anyway: `npx vitest run src/domain` is the gate for this task.)

---

### Task 2: Migration from v1 to v2

**Files:**
- Modify: `src/state/saves.ts:7-45`
- Test: `src/state/saves.test.ts`

**Interfaces:**
- Consumes: the v2 field names from Task 1.
- Produces: `SCHEMA_VERSION = 2` (exported, `as const`). `migrateV1(game: unknown): unknown` is internal, reached through `importGame()` and `read()`.

- [ ] **Step 1: Write the failing tests**

In `src/state/saves.test.ts`, add this helper below `sample()` and update the version literals: line 12 `schemaVersion: 2 as const`, line 21 `schemaVersion: 2`, the unknown-version test uses `schemaVersion: 3` and `toThrow('version 3')`, and the `{"schemaVersion":1,"game":{}}` test stays (a v1 empty object is still rejected).

Add `legacyV1Game` to `src/domain/fixtures.ts` (it is also used in Task 3):

```ts
/** A game as the Phase 1 app saved it: schema version 1, without any Phase 2 field. */
export function legacyV1Game(game: Game): Record<string, unknown> {
  const companies = Object.fromEntries(
    Object.entries(game.companies).map(([id, c]) => {
      const { treasuryCash, operated, ledger, ...old } = c
      void treasuryCash, operated, ledger
      return [id, old]
    }),
  )
  const { live, ...settings } = game.settings
  void live
  const { id, name, createdAt, players, track } = game
  return { id, name, createdAt, schemaVersion: 1, settings, players, companies, track }
}
```

Import it in `saves.test.ts` with `import { legacyV1Game, put, testGame } from '../domain/fixtures'`, then:

```ts
describe('migration from version 1', () => {
  const file = () => JSON.stringify({ schemaVersion: 1, game: legacyV1Game(sample()) })

  it('imports a version 1 export as a version 2 game with defaults', () => {
    const g = importGame(file(), [])
    expect(g.schemaVersion).toBe(2)
    expect(g.settings.live).toBe(false)
    expect(g.round).toEqual({ cycle: 1, type: 'SR' })
    expect(g.cycleScores).toEqual([])
    expect(g.soldThisRound).toEqual({})
    expect(g.operating).toEqual({ acted: [], issuedOrRedeemed: [] })
    expect(g.players).toEqual(sample().players)
    expect(g.track).toEqual(sample().track)
  })

  it('treats active companies as having operated and the rest as not (D6)', () => {
    const g = importGame(file(), [])
    expect(g.companies.express).toMatchObject({ status: 'active', operated: true, treasuryCash: 0, ledger: [] })
    expect(g.companies.tunneling).toMatchObject({ status: 'unstarted', operated: false })
  })

  it('exports as version 2 and re-imports equal', () => {
    const g = importGame(file(), [])
    expect(importGame(exportGame(g), [])).toEqual(g)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/state/saves.test.ts`
Expected: FAIL (`SCHEMA_VERSION` is 1, so a version 2 value is rejected and the migration does not exist).

- [ ] **Step 3: Implement**

In `src/state/saves.ts`:

```ts
export const SCHEMA_VERSION = 2 as const

/** A game as stored. `undo[0]` is the most recent undo step. */
export interface SavedGame {
  schemaVersion: typeof SCHEMA_VERSION
  game: Game
  undo: Game[]
  redo: Game[]
}
```

Replace the `MIGRATIONS` comment and body:

```ts
/**
 * Migration hook. MIGRATIONS[n] turns a version n game into a version n + 1 game.
 */
const MIGRATIONS: Record<number, (game: unknown) => unknown> = {
  1: migrateV1,
}

/**
 * Version 1 to 2 (Phase 2). Adds treasury cash, the ledger, round state and the live flag.
 * Phase 1 games stay manual (`live: false`). A company that is on the track is assumed to
 * have operated already (decision D6), so its shares can be sold.
 */
function migrateV1(game: unknown): unknown {
  if (!isObject(game)) return game
  const companies = isObject(game.companies)
    ? Object.fromEntries(
        Object.entries(game.companies).map(([id, c]) => [
          id,
          isObject(c) ? { ...c, treasuryCash: 0, operated: c.status === 'active', ledger: [] } : c,
        ]),
      )
    : game.companies
  return {
    ...game,
    schemaVersion: 2,
    settings: isObject(game.settings) ? { ...game.settings, live: false } : game.settings,
    companies,
    round: { cycle: 1, type: 'SR' },
    cycleScores: [],
    soldThisRound: {},
    operating: { acted: [], issuedOrRedeemed: [] },
  }
}
```

`migrateV1` uses `isObject`, which is declared below `MIGRATIONS` as a `const` arrow function. Calls happen later, at runtime, so the order is fine, but move the `isObject` and `isNumber` declarations above `MIGRATIONS` to keep the file readable.

Replace the remaining literal `schemaVersion: 1` in this file with `schemaVersion: SCHEMA_VERSION`: in `read()` (the returned object), in `duplicate()` and in `importText()`. In `read()` the history check `data.schemaVersion === SCHEMA_VERSION` stays and now drops v1 history, which is intended.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/state/saves.test.ts`
Expected: all tests in the file PASS. `checkGame` does not look at the new fields until Task 4, so a migrated game passes it already. If any test fails, read it before changing code.

- [ ] **Step 5: Commit**

```bash
git add src/state/saves.ts src/state/saves.test.ts
git commit -m "feat: migrate saved games from schema version 1 to 2

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Store uses the shared version, v1 history is dropped

**Files:**
- Modify: `src/state/game.ts:31`
- Test: `src/state/game.test.ts`

**Interfaces:**
- Consumes: `SCHEMA_VERSION` from `src/state/saves.ts`.

- [ ] **Step 1: Write the failing test**

Add to `src/state/game.test.ts` (use the file's existing imports for `createGameStore`, `createSaves`, `memoryStorage`; add `legacyV1Game`, `put` and `testGame` from `../domain/fixtures` if missing):

```ts
describe('opening a version 1 save', () => {
  it('loads the game and drops its undo and redo history', () => {
    const storage = memoryStorage()
    const saves = createSaves(storage)
    const g = put(testGame(), 'express', { price: 80, president: 'p1', treasury: 3 })
    const oldGame = legacyV1Game(g)
    storage.setItem(
      `lostAtlas.game.${g.id}`,
      JSON.stringify({ schemaVersion: 1, game: oldGame, undo: [oldGame], redo: [oldGame] }),
    )
    storage.setItem('lostAtlas.current', g.id)

    const store = createGameStore(saves)
    expect(store.resume()).toBe(true)
    expect(store.game.value?.schemaVersion).toBe(2)
    expect(store.game.value?.companies.express.operated).toBe(true)
    expect(store.canUndo.value).toBe(false)
    expect(store.canRedo.value).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/state/game.test.ts`
Expected: the test may already pass at runtime, because Task 2 made `read()` migrate and drop v1 history. The remaining defect is `persist()` writing `schemaVersion: 1`, which `npm run typecheck` reports as an error at `src/state/game.ts:31`. Run `npm run typecheck` and confirm that error before fixing it.

- [ ] **Step 3: Implement**

In `src/state/game.ts` change the import to `import { SCHEMA_VERSION, useSaves, type SavedGame, type Saves } from './saves'` and line 31 to `schemaVersion: SCHEMA_VERSION,`.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck`
Expected: all tests PASS, typecheck clean. If `SavesList.test.ts` or `App.test.ts` fail on literals, update their `schemaVersion: 1` to `2`.

- [ ] **Step 5: Commit**

```bash
git add src/state src/components
git commit -m "feat: save games as schema version 2 and drop version 1 history on open

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `checkGame` validates the new fields

**Files:**
- Modify: `src/state/saves.ts` (inside `checkGame`)
- Test: `src/state/saves.test.ts`

**Interfaces:**
- Consumes: the field names from Task 1.
- Produces: `checkGame` returns the dotted path of the first bad new field, one of `settings.live`, `round`, `cycleScores`, `soldThisRound`, `operating`, `companies.<id>.treasuryCash`, `companies.<id>.operated`, `companies.<id>.ledger`.

- [ ] **Step 1: Write the failing tests**

Add to the `checkGame` describe in `src/state/saves.test.ts` (it already has a `base` game; if the variable is named differently, use that):

```ts
  describe('Phase 2 fields', () => {
    const base = sample()
    const withCompany = (patch: Record<string, unknown>) => ({
      ...base,
      companies: { ...base.companies, express: { ...base.companies.express, ...patch } },
    })

    it('accepts a good version 2 game', () => {
      expect(checkGame(base)).toBeNull()
    })

    it.each([
      ['settings.live', { ...base, settings: { ...base.settings, live: 'yes' } }],
      ['round', { ...base, round: { cycle: 1, type: 'XX' } }],
      ['round', { ...base, round: { cycle: 0, type: 'SR' } }],
      ['cycleScores', { ...base, cycleScores: [{ p1: 'x' }] }],
      ['soldThisRound', { ...base, soldThisRound: { p1: 'express' } }],
      ['soldThisRound', { ...base, soldThisRound: { ghost: ['express'] } }],
      ['operating', { ...base, operating: { acted: ['nope'], issuedOrRedeemed: [] } }],
      ['companies.express.treasuryCash', withCompany({ treasuryCash: '40' })],
      ['companies.express.operated', withCompany({ operated: 1 })],
      ['companies.express.ledger', withCompany({ ledger: [{ cycle: 1, round: 'SR', what: 'x', auto: true }] })],
    ])('rejects a bad %s', (path, game) => {
      expect(checkGame(game)).toBe(path)
    })
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/state/saves.test.ts -t "Phase 2 fields"`
Expected: FAIL (`checkGame` returns `null` for each bad game).

- [ ] **Step 3: Implement**

In `src/state/saves.ts` add near the other constants:

```ts
const ROUNDS = ['SR', 'OR1', 'OR2', 'MR']
```

In `checkGame`: after the `settings.mainView` check add

```ts
  if (typeof settings.live !== 'boolean') return 'settings.live'
```

After the `isCount(c.treasuryShares)` line (inside the company loop) add

```ts
    if (!isNumber(c.treasuryCash)) return `companies.${id}.treasuryCash`
    if (typeof c.operated !== 'boolean') return `companies.${id}.operated`
    if (!Array.isArray(c.ledger) || !c.ledger.every(isLedgerEntry)) return `companies.${id}.ledger`
```

Before the `track` section add

```ts
  const round = g.round
  if (!isObject(round) || !Number.isInteger(round.cycle) || (round.cycle as number) < 1 || !ROUNDS.includes(round.type as string)) {
    return 'round'
  }
  const cycleScores = g.cycleScores
  if (!Array.isArray(cycleScores) || !cycleScores.every((s) => isObject(s) && Object.values(s).every(isNumber))) {
    return 'cycleScores'
  }
  const sold = g.soldThisRound
  if (!isObject(sold)) return 'soldThisRound'
  for (const [holder, list] of Object.entries(sold)) {
    if (!playerIds.has(holder) || !isCompanyList(list)) return 'soldThisRound'
  }
  const operating = g.operating
  if (!isObject(operating) || !isCompanyList(operating.acted) || !isCompanyList(operating.issuedOrRedeemed)) return 'operating'
```

And the two helpers beside `isCount`:

```ts
const isCompanyList = (v: unknown): boolean =>
  Array.isArray(v) && v.every((id) => typeof id === 'string' && COMPANY_IDS.includes(id))
const isLedgerEntry = (v: unknown): boolean =>
  isObject(v) &&
  Number.isInteger(v.cycle) &&
  ROUNDS.includes(v.round as string) &&
  typeof v.what === 'string' &&
  isNumber(v.delta) &&
  typeof v.auto === 'boolean'
```

`ROUNDS` and `isLedgerEntry` are used inside `checkGame`, so declare them above it.

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/state/saves.ts src/state/saves.test.ts
git commit -m "feat: validate the Phase 2 fields when loading a saved game

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Live flag setter and the treasury-cash scoring rule

**Files:**
- Modify: `src/domain/edit.ts`
- Test: `src/domain/edit.test.ts`, `src/domain/scoring.test.ts`

**Interfaces:**
- Produces: `setLive(game: Game, live: boolean): Game` in `src/domain/edit.ts`.

- [ ] **Step 1: Write the failing tests**

`src/domain/edit.test.ts` (match the file's existing imports):

```ts
  it('turns live mode on and off without touching anything else', () => {
    const g = testGame()
    const off = setLive(g, false)
    expect(off.settings.live).toBe(false)
    expect({ ...off, settings: { ...off.settings, live: true } }).toEqual(g)
  })
```

`src/domain/scoring.test.ts`:

```ts
  it('does not count company treasury cash in a player total (spec A4)', () => {
    let g = put(testGame(), 'express', { price: 80, president: 'p1', treasury: 3 })
    const before = playerTotal(g, 'p1')
    g = { ...g, companies: { ...g.companies, express: { ...g.companies.express, treasuryCash: 500 } } }
    expect(playerTotal(g, 'p1')).toBe(before)
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain/edit.test.ts src/domain/scoring.test.ts`
Expected: FAIL (`setLive` is not exported). The scoring test already passes; it is a guard.

- [ ] **Step 3: Implement**

In `src/domain/edit.ts` below `setMainView`:

```ts
export function setLive(game: Game, live: boolean): Game {
  return { ...game, settings: { ...game.settings, live } }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/domain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add setLive and pin treasury cash out of player totals

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and full verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/design/phase-2-implementation-list.md` (status line for P2-01, P2-02, P2-43, P2-92, and the spec contradiction)

- [ ] **Step 1: Update CLAUDE.md**

In the `src/domain/` section replace the first bullet's `Game` description with a sentence stating that `Game` is schema version 2, and add:

```markdown
- `blankCompany(id, status)` in `company.ts` is the one place a `Company` is built. Use it, never a hand-written literal, so new fields get defaults.
- Phase 2 fields: `Company.treasuryCash`, `operated`, `ledger`; `Game.round`, `cycleScores`, `soldThisRound`, `operating`, `settings.live`. Treasury cash is never scored. A game with `settings.live = false` runs no Phase 2 automation.
```

In the `saves.ts` bullet replace "the `MIGRATIONS` hook keyed by `schemaVersion`" with "the `MIGRATIONS` table (`1` is the Phase 2 step; v1 undo history is dropped on open)".

- [ ] **Step 2: Mark the list items**

In the list, change Code assumptions for P2-01, P2-02 (flag), P2-43 and P2-92 to "Done in Plan 1" and add one line under section 2 that F1 to F4 shipped in `aed455a` (after confirming in the running app).

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass, `dist/` builds.

Then run `npm run dev`, open the app, and confirm in the browser: an existing Phase 1 game opens with its cash, shares and track intact, undo is empty for it, and a new game can be created, saved, exported and re-imported.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs
git commit -m "docs: record schema version 2 and the Phase 2 foundation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage:** P2-01 (Tasks 1 to 4), P2-02 flag only (Tasks 1, 2, 5; the Setup toggle is Plan 3), P2-43 (Task 5), P2-92 (Tasks 2 to 4). P2-03, P2-04, P2-93 and P2-94 belong to Plan 2.
- **Placeholders:** none. One step is driven by the typechecker: Task 1, Step 5 lists remaining hand-built `Game` or `Company` literals in test files and says how to fix them (spread `testGame()` or `blankCompany()`).
- **Types:** `blankCompany`, `RoundType`, `LedgerEntry`, `SCHEMA_VERSION`, `legacyV1Game`, `setLive` are each defined once and used with the same names later. `legacyV1Game` is defined in Task 2 and reused in Task 3, so do Task 2 first.
- **Task order:** Task 1 leaves `npm run typecheck` red (saves.ts and game.ts still say version 1). Its gate is `npx vitest run src/domain`. Typecheck is green again at the end of Task 3.
