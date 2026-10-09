# Phase 2 Rounds Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Phase 2 round tracker in the app: a round bar on every view, End Stock Round, phase control with the Export a train reminder, round-based gating of Start company and Merge, a cycle history on the Scoreboard, and a Setup switch that turns round tracking on for a new game.

**Architecture:** Everything reads the pure functions from Plan 2 (`advanceRound`, `endStockRound`, `actionsAllowed`, `saveSnapshot`, `stockRoundRisers`, `nextToOperate`). `App.vue` stays the only place that touches the store; new components take `game` as a prop and emit the next `Game` or a plain event. The shell shows only when `game.settings.live` is true, so Phase 1 games look and behave exactly as before.

**Tech Stack:** Vue 3 `<script setup>`, PrimeVue 4 (Aura), VueUse, Vitest with @vue/test-utils.

**Spec:** `docs/design/lost-atlas-tracker-design-spec.md` C10 "Round tracking" and "History". List items: P2-11, P2-12, P2-13 (gating half), P2-14, P2-15, P2-26 (trigger and dialog), P2-51, P2-71, and the Setup `live` toggle from P2-02, in `docs/design/phase-2-implementation-list.md`. Roadmap: `docs/superpowers/plans/2026-10-10-phase-2-roadmap.md` ("Notes from Plan 2" apply to this plan).

## Global Constraints

- **Boards:** the `Rounds` and `ScoreboardHistory` boards are not in `docs/design/boards/`. Build from the C10 text and the existing screens: Aura tokens and the CSS variables in `src/styles/app.css`, 44px touch targets, `IBM Plex Mono` for numbers (`.mono`), phone breakpoint 719px (`@media (max-width: 719px)`). Do not invent new colours; use `--primary`, `--amber*`, `--line*`, `--head`, `--lead`, `--muted`, `--faint`.
- `App.vue` is the only place that touches the store. Views, dialogs and components receive `game` as a prop and emit the next `Game` (`update`) or an event. One user action is one `commit` (one undo step).
- Every new piece of UI shows only for `game.settings.live === true`. A manual game must render and behave as it does today.
- All game logic comes from `src/domain/rounds.ts` and `src/domain/history.ts`. Do not re-implement a rule in a component.
- Dialogs follow the existing pattern: `defineModel<boolean>('visible')`, PrimeVue `Dialog` with `:style="{ width: 'min(520px, 100vw)' }"`, `dialog-body` and `dialog-footer` classes, and `data-testid` attributes on the controls tests use.
- Tests: mount with `testGame()` / `put()` / `withRound()` from `src/domain/fixtures.ts`, assert on the emitted `Game`. `src/test-setup.ts` stubs `Dialog` inline and `matchMedia` to `matches: false` (phone layout).
- `testGame()` creates a **live** game. Tests of Phase 1 behavior must build a manual game (`settings.live = false`).
- `npm test` and `npm run typecheck` must pass before each commit; `npm run build` before the last one. No linter.
- Commit locally with the `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` trailer. Do not push.

## Review Focus

1. A manual (Phase 1) game: no round bar, Start company and Merge exactly as before. Test in Task 6.
2. The Export a train reminder: leaving the last round of a cycle opens the phase dialog; leaving the last cycle does not (the game is over). A phase change there must not add a Merger Round to the cycle that just ended. Tests in Tasks 5 and 6.
3. End Stock Round with nothing to raise must still work (empty list, one button). Test in Task 4.
4. Undo after any round action rewinds it as one step, including the snapshot and the cleared Operating Round state. Test in Task 6.
5. The By cycle table with no snapshot, a snapshot with a missing player, and one with 5 players on a phone width. Tests in Tasks 1 and 7.

---

### Task 1: History and progress helpers (domain)

**Files:**
- Create: `src/domain/history.ts`
- Create: `src/domain/history.test.ts`
- Modify: `src/domain/rounds.ts`
- Modify: `src/domain/rounds.test.ts`

**Interfaces:**
- Produces:
  - `interface HistoryRow { playerId: PlayerId; total: number | null; rank: number | null; change: number | null }`
  - `interface HistoryColumn { cycle: number; rows: HistoryRow[] }` (`rows` follow `game.players` order; `cycle` is 1-based)
  - `cycleHistory(game: Game): HistoryColumn[]` in `history.ts`
  - `operatedProgress(game: Game): { done: number; total: number }` in `rounds.ts`

Rules: a snapshot with no player total is skipped. `rank` is `1 + the number of players with a higher total` (ties share a rank: 100, 100, 50 gives 1, 1, 3). `change` is the total minus that player's total in the previous snapshot index, and `null` when there is none (cycle 1 has no change: the starting cash is not stored). `operatedProgress` counts companies on the track, and how many of them are in `operating.acted`.

- [ ] **Step 1: Write the failing tests**

`src/domain/history.test.ts`:

```ts
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
```

Append to `src/domain/rounds.test.ts` (extend its import list with `operatedProgress`):

```ts
describe('operatedProgress', () => {
  const two = () => put(put(testGame(), 'express', { price: 80, president: J, treasury: 3 }), 'tunneling', { price: 70, president: K, treasury: 3 })

  it('counts the companies on the track and those that have acted', () => {
    expect(operatedProgress(two())).toEqual({ done: 0, total: 2 })
    expect(operatedProgress({ ...two(), operating: { acted: ['express'], issuedOrRedeemed: [] } })).toEqual({ done: 1, total: 2 })
  })

  it('ignores a company that is no longer on the track', () => {
    const g = { ...two(), operating: { acted: ['express', 'ghost'], issuedOrRedeemed: [] } }
    expect(operatedProgress(g)).toEqual({ done: 1, total: 2 })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain/history.test.ts src/domain/rounds.test.ts`
Expected: FAIL (`./history` does not exist, `operatedProgress` is not exported).

- [ ] **Step 3: Implement**

`src/domain/history.ts`:

```ts
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
```

`src/domain/rounds.ts`, below `nextToOperate`:

```ts
/** Companies on the track, and how many of them have acted in this Operating Round. */
export function operatedProgress(game: Game): { done: number; total: number } {
  const onTrack = turnOrder(game)
  return { done: onTrack.filter((id) => game.operating.acted.includes(id)).length, total: onTrack.length }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add cycle history and Operating Round progress helpers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Round bar component

**Files:**
- Create: `src/components/RoundBar.vue`
- Create: `src/components/RoundBar.test.ts`

**Interfaces:**
- Consumes: `cycleCount`, `hasMergerRound`, `isGameOver`, `operatedProgress` (`rounds.ts`), `PHASE_LABEL` (`format.ts`).
- Produces: component `RoundBar` with prop `game: Game` and events `next: []` (the user pressed the main button) and `phase: []` (the user pressed the phase chip). Test ids: `round-bar`, `round-next`, `round-phase`.

Behavior: heading "Cycle N of M", or "Game over" after the last cycle. Four chips SR, OR1, OR2, MR; the current one has `aria-current="step"`; earlier ones are done; MR has class `skipped` and the title "Skipped until the green phase" when the phase is yellow. Detail text: in an Operating Round "X of Y companies operated", else the round name, and after the game "The final ranking is on the Scoreboard." A phase chip shows the phase label. The main button label depends on the round: SR "End Stock Round", OR1 "Start Operating Round 2", OR2 "End Operating Rounds", MR "End Merger Round"; no button after the game.

- [ ] **Step 1: Write the failing tests**

`src/components/RoundBar.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RoundBar from './RoundBar.vue'
import { put, testGame, withRound } from '../domain/fixtures'
import { setPhase } from '../domain/edit'
import type { Game } from '../domain/types'

const bar = (game: Game) => mount(RoundBar, { props: { game } })
const chip = (w: ReturnType<typeof bar>, text: string) => {
  const found = w.findAll('li').find((li) => li.text() === text)
  if (!found) throw new Error(`No chip ${text}`)
  return found
}

describe('RoundBar', () => {
  it('shows the cycle and marks the current round', () => {
    const w = bar(testGame())
    expect(w.text()).toContain('Cycle 1 of 6')
    expect(chip(w, 'SR').attributes('aria-current')).toBe('step')
    expect(chip(w, 'OR1').attributes('aria-current')).toBeUndefined()
  })

  it('counts 4 cycles in a Short Game', () => {
    const g = { ...testGame(), settings: { ...testGame().settings, shortGame: true } }
    expect(bar(g).text()).toContain('Cycle 1 of 4')
  })

  it('marks the Merger Round as skipped in the yellow phase only', () => {
    expect(chip(bar(testGame()), 'MR').classes()).toContain('skipped')
    expect(chip(bar(setPhase(testGame(), 'green')), 'MR').classes()).not.toContain('skipped')
  })

  it('shows who has operated during an Operating Round', () => {
    let g = put(testGame(), 'express', { price: 80, president: 'p1', treasury: 3 })
    g = put(g, 'tunneling', { price: 70, president: 'p2', treasury: 3 })
    g = { ...withRound(g, 1, 'OR1'), operating: { acted: ['express'], issuedOrRedeemed: [] } }
    expect(bar(g).text()).toContain('1 of 2 companies operated')
  })

  it.each([
    ['SR', 'End Stock Round'],
    ['OR1', 'Start Operating Round 2'],
    ['OR2', 'End Operating Rounds'],
    ['MR', 'End Merger Round'],
  ] as const)('labels the main button in %s', (type, label) => {
    expect(bar(withRound(testGame(), 1, type)).get('[data-testid="round-next"]').text()).toBe(label)
  })

  it('emits next and phase', async () => {
    const w = bar(testGame())
    await w.get('[data-testid="round-next"]').trigger('click')
    await w.get('[data-testid="round-phase"]').trigger('click')
    expect(w.emitted('next')).toHaveLength(1)
    expect(w.emitted('phase')).toHaveLength(1)
  })

  it('shows the phase', () => {
    expect(bar(setPhase(testGame(), 'purple')).get('[data-testid="round-phase"]').text()).toContain('Purple')
  })

  it('says the game is over and offers no button after the last cycle', () => {
    const w = bar(withRound(testGame(), 7, 'SR'))
    expect(w.text()).toContain('Game over')
    expect(w.find('[data-testid="round-next"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/RoundBar.test.ts`
Expected: FAIL (the component does not exist).

- [ ] **Step 3: Implement**

`src/components/RoundBar.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import { PHASE_LABEL } from '../domain/format'
import { cycleCount, hasMergerRound, isGameOver, operatedProgress } from '../domain/rounds'
import type { Game, RoundType } from '../domain/types'

const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ next: []; phase: [] }>()

const ORDER: RoundType[] = ['SR', 'OR1', 'OR2', 'MR']
const NAME: Record<RoundType, string> = {
  SR: 'Stock Round',
  OR1: 'Operating Round 1',
  OR2: 'Operating Round 2',
  MR: 'Merger Round',
}
const NEXT_LABEL: Record<RoundType, string> = {
  SR: 'End Stock Round',
  OR1: 'Start Operating Round 2',
  OR2: 'End Operating Rounds',
  MR: 'End Merger Round',
}

const over = computed(() => isGameOver(props.game))
const heading = computed(() =>
  over.value ? 'Game over' : `Cycle ${props.game.round.cycle} of ${cycleCount(props.game)}`,
)
const chips = computed(() => {
  const current = ORDER.indexOf(props.game.round.type)
  return ORDER.map((type, i) => ({
    type,
    label: type,
    name: NAME[type],
    state: over.value || i < current ? 'done' : i === current ? 'current' : 'todo',
    skipped: type === 'MR' && !hasMergerRound(props.game),
  }))
})
const detail = computed(() => {
  if (over.value) return 'The final ranking is on the Scoreboard.'
  const type = props.game.round.type
  if (type === 'OR1' || type === 'OR2') {
    const p = operatedProgress(props.game)
    return `${p.done} of ${p.total} companies operated`
  }
  return NAME[type]
})
</script>

<template>
  <section class="round-bar" aria-label="Round tracker" data-testid="round-bar">
    <div class="cycle">{{ heading }}</div>

    <ol class="chips">
      <li
        v-for="c in chips"
        :key="c.type"
        class="chip"
        :class="[c.state, { skipped: c.skipped }]"
        :aria-current="c.state === 'current' && !over ? 'step' : undefined"
        :title="c.skipped ? 'Skipped until the green phase' : c.name"
      >
        {{ c.label }}
      </li>
    </ol>

    <button
      type="button"
      class="phase"
      data-testid="round-phase"
      :aria-label="`Phase ${PHASE_LABEL[game.settings.phase]}. Change the phase`"
      @click="emit('phase')"
    >
      <span class="dot" :class="game.settings.phase" aria-hidden="true" />
      {{ PHASE_LABEL[game.settings.phase] }}
    </button>

    <span class="detail small">{{ detail }}</span>
    <span class="grow" />
    <Button v-if="!over" :label="NEXT_LABEL[game.round.type]" data-testid="round-next" @click="emit('next')" />
  </section>
</template>

<style scoped>
.round-bar {
  flex: none;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 8px 16px;
  background: var(--head);
  border-bottom: 1px solid var(--line);
}
.cycle {
  font-weight: 700;
  white-space: nowrap;
}
.chips {
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.chip {
  min-width: 40px;
  height: 28px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line-2);
  border-radius: 14px;
  background: var(--card);
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.chip.done {
  background: var(--lead);
  border-color: var(--primary);
  color: var(--primary);
}
.chip.current {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.chip.skipped {
  border-style: dashed;
  color: var(--faint);
  background: transparent;
}
.phase {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  background: var(--card);
  color: var(--ink);
  font-weight: 600;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 6px;
  border: 1px solid rgba(24, 24, 27, 0.45);
}
.dot.yellow {
  background: var(--zone-yellow);
}
.dot.green {
  background: var(--zone-green);
}
.dot.purple {
  background: var(--zone-purple);
}
.detail {
  color: var(--ink-2);
}
.grow {
  flex: 1;
}
.round-bar :deep(button.p-button) {
  min-height: 44px;
}
@media (max-width: 719px) {
  .round-bar {
    padding: 6px 12px;
    gap: 6px 8px;
  }
  .detail {
    order: 5;
    flex-basis: 100%;
  }
  .grow {
    display: none;
  }
  .round-bar :deep(button.p-button) {
    order: 6;
    flex: 1 1 100%;
  }
}
</style>
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat: add the round bar

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Phase dialog with the Export a train reminder

**Files:**
- Create: `src/dialogs/PhaseDialog.vue`
- Create: `src/dialogs/PhaseDialog.test.ts`

**Interfaces:**
- Consumes: `setPhase` (`edit.ts`), `PHASE_LABEL`, `PHASE_MAX`.
- Produces: component `PhaseDialog`: `v-model:visible`, props `game: Game` and `exportStep: boolean`, event `update: [game: Game]`. Test ids: `phase-done`.

Behavior: a segmented control for Yellow, Green, Purple (labels with the start range, as in `SettingsDialog`) that emits `setPhase(game, value)` at once. When `exportStep` is true the header is "Export a train" and the text reads: "Cycle N is over. Take the top train off the available stack. If that train changes the phase, set it here. A phase change now does not add a Merger Round to the cycle that just ended." Cycle N is `game.round.cycle - 1` (the round has already moved to the next cycle). When false the header is "Phase" and the text is "The phase limits the start price of new companies and turns the Merger Round on from green."

- [ ] **Step 1: Write the failing tests**

`src/dialogs/PhaseDialog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import PhaseDialog from './PhaseDialog.vue'
import { testGame, withRound } from '../domain/fixtures'
import type { Game } from '../domain/types'

const open = (game: Game, exportStep = false) => mount(PhaseDialog, { props: { visible: true, game, exportStep } })
const button = (w: VueWrapper, text: string) => {
  const found = w.findAll('button').find((b) => b.text().includes(text))
  if (!found) throw new Error(`No button "${text}"`)
  return found
}
const lastUpdate = (w: VueWrapper) => {
  const events = w.emitted('update')
  if (!events) throw new Error('update was not emitted')
  return events[events.length - 1][0] as Game
}

describe('PhaseDialog', () => {
  it('changes the phase at once', async () => {
    const w = open(testGame())
    await button(w, 'Purple').trigger('click')
    expect(lastUpdate(w).settings.phase).toBe('purple')
  })

  it('explains the phase when it is opened from the round bar', () => {
    const w = open(testGame())
    expect(w.text()).toContain('start price')
    expect(w.text()).not.toContain('Export a train')
  })

  it('shows the Export a train reminder for the cycle that just ended', () => {
    const w = open(withRound(testGame(), 3, 'SR'), true)
    expect(w.text()).toContain('Export a train')
    expect(w.text()).toContain('Cycle 2 is over')
    expect(w.text()).toContain('Merger Round')
  })

  it('closes with Done and changes nothing by itself', async () => {
    const w = open(testGame(), true)
    await w.get('[data-testid="phase-done"]').trigger('click')
    expect(w.emitted('update')).toBeUndefined()
    expect(w.emitted('update:visible')?.[0]).toEqual([false])
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/dialogs/PhaseDialog.test.ts`
Expected: FAIL (the component does not exist).

- [ ] **Step 3: Implement**

`src/dialogs/PhaseDialog.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import SelectButton from 'primevue/selectbutton'
import { setPhase } from '../domain/edit'
import { PHASE_LABEL } from '../domain/format'
import { PHASE_MAX } from '../domain/track'
import type { Game, Phase } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ game: Game; exportStep: boolean }>()
const emit = defineEmits<{ update: [game: Game] }>()

const options = (['yellow', 'green', 'purple'] as Phase[]).map((value) => ({
  value,
  label: `${PHASE_LABEL[value]} 60–${PHASE_MAX[value]}`,
}))
const header = computed(() => (props.exportStep ? 'Export a train' : 'Phase'))
const text = computed(() =>
  props.exportStep
    ? `Cycle ${props.game.round.cycle - 1} is over. Take the top train off the available stack. If that train changes the phase, set it here. A phase change now does not add a Merger Round to the cycle that just ended.`
    : 'The phase limits the start price of new companies and turns the Merger Round on from green.',
)
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="header" :style="{ width: 'min(520px, 100vw)' }">
    <div class="dialog-body">
      <p class="text">{{ text }}</p>
      <div class="field">
        <span class="field-label">Current phase</span>
        <SelectButton
          :model-value="game.settings.phase"
          :options="options"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          fluid
          @update:model-value="(v: Phase) => emit('update', setPhase(game, v))"
        />
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <Button label="Done" data-testid="phase-done" @click="visible = false" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.text {
  margin: 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/dialogs
git commit -m "feat: add the phase dialog with the Export a train reminder

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: End Stock Round dialog

**Files:**
- Create: `src/dialogs/EndStockRoundDialog.vue`
- Create: `src/dialogs/EndStockRoundDialog.test.ts`

**Interfaces:**
- Consumes: `stockRoundRisers`, `endStockRound` (`rounds.ts`), `displayName`, `findToken`, `TRACK`, `TOP`.
- Produces: component `EndStockRoundDialog`: `v-model:visible`, prop `game: Game`, event `update: [game: Game]`. Test ids: `end-sr-confirm`, `riser-<companyId>` (the checkbox input of each row).

Behavior: lists `stockRoundRisers(game)`, each with its name, "price to new price", and a checked checkbox ("Move up one step"). Unchecked companies are passed as `skip`. With no riser it says "No company is fully owned by players, so no price changes." Confirm emits `endStockRound(game, skipped)` and closes. The checked state resets whenever the dialog opens. The text reminds the user to move the physical tokens to the back of their new column.

- [ ] **Step 1: Write the failing tests**

`src/dialogs/EndStockRoundDialog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import EndStockRoundDialog from './EndStockRoundDialog.vue'
import { put, testGame } from '../domain/fixtures'
import { priceOf } from '../domain/track'
import type { Game } from '../domain/types'

const [J, K] = ['p1', 'p2']
const open = (game: Game) => mount(EndStockRoundDialog, { props: { visible: true, game } })
const lastUpdate = (w: VueWrapper) => {
  const events = w.emitted('update')
  if (!events) throw new Error('update was not emitted')
  return events[events.length - 1][0] as Game
}
/** express and tunneling are fully owned by players. resourceful has treasury shares. */
function game() {
  let g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 3 } })
  g = put(g, 'tunneling', { price: 70, president: K, holdings: { [J]: 3 } })
  return put(g, 'resourceful', { price: 90, president: J, treasury: 3 })
}

describe('EndStockRoundDialog', () => {
  it('lists the companies that rise and what they move to', () => {
    const w = open(game())
    expect(w.text()).toContain('Express')
    expect(w.text()).toContain('Tunneling')
    expect(w.text()).not.toContain('Resourceful')
    expect(w.text()).toContain('80')
    expect(w.text()).toContain('90')
  })

  it('applies the rises and moves to the first Operating Round', async () => {
    const w = open(game())
    await w.get('[data-testid="end-sr-confirm"]').trigger('click')
    const next = lastUpdate(w)
    expect(priceOf(next, 'express')).toBe(90)
    expect(priceOf(next, 'tunneling')).toBe(80)
    expect(next.round).toEqual({ cycle: 1, type: 'OR1' })
  })

  it('leaves an unchecked company where it is', async () => {
    const w = open(game())
    await w.get('[data-testid="riser-express"]').setValue(false)
    await w.get('[data-testid="end-sr-confirm"]').trigger('click')
    const next = lastUpdate(w)
    expect(priceOf(next, 'express')).toBe(80)
    expect(priceOf(next, 'tunneling')).toBe(80)
  })

  it('still works when nothing rises (review focus 3)', async () => {
    const w = open(put(testGame(), 'resourceful', { price: 90, president: J, treasury: 3 }))
    expect(w.text()).toContain('No company is fully owned by players')
    await w.get('[data-testid="end-sr-confirm"]').trigger('click')
    expect(lastUpdate(w).round.type).toBe('OR1')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/dialogs/EndStockRoundDialog.test.ts`
Expected: FAIL (the component does not exist).

- [ ] **Step 3: Implement**

`src/dialogs/EndStockRoundDialog.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import CompanyTag from '../components/CompanyTag.vue'
import { displayName } from '../domain/companies'
import { endStockRound, stockRoundRisers } from '../domain/rounds'
import { TOP, TRACK, findToken } from '../domain/track'
import type { CompanyId, Game } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ update: [game: Game] }>()

/** Companies the user took out of the bonus. */
const skipped = ref<Set<CompanyId>>(new Set())
watch(visible, (open) => open && (skipped.value = new Set()), { immediate: true })

const rows = computed(() =>
  stockRoundRisers(props.game).map((id) => {
    const pos = findToken(props.game, id)!
    return {
      id,
      name: displayName(props.game.companies[id]),
      from: TRACK[pos.index],
      to: TRACK[Math.min(TOP, pos.index + 1)],
    }
  }),
)

function toggle(id: CompanyId, on: boolean) {
  const next = new Set(skipped.value)
  if (on) next.delete(id)
  else next.add(id)
  skipped.value = next
}

function confirm() {
  emit('update', endStockRound(props.game, [...skipped.value]))
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="End Stock Round" :style="{ width: 'min(520px, 100vw)' }">
    <div class="dialog-body">
      <p v-if="rows.length === 0" class="text">No company is fully owned by players, so no price changes.</p>
      <template v-else>
        <p class="text">
          A company whose shares are all held by players rises one step. Move each token up one step and put it
          at the back of its new column.
        </p>
        <ul class="list">
          <li v-for="r in rows" :key="r.id" class="row">
            <Checkbox
              :model-value="!skipped.has(r.id)"
              binary
              :input-id="`riser-${r.id}`"
              :data-testid="`riser-${r.id}`"
              :aria-label="`Raise ${r.name}`"
              @update:model-value="(v: boolean) => toggle(r.id, v)"
            />
            <CompanyTag :company-id="r.id" />
            <span class="name">{{ r.name }}</span>
            <span class="mono prices">{{ r.from }} → {{ r.to }}</span>
          </li>
        </ul>
      </template>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" outlined @click="visible = false" />
        <Button label="End Stock Round" data-testid="end-sr-confirm" @click="confirm" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.text {
  margin: 0;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line-2);
  border-radius: 12px;
  overflow: hidden;
}
.row {
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 12px;
  border-top: 1px solid var(--line);
}
.row:first-child {
  border-top: 0;
}
.name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}
.prices {
  white-space: nowrap;
}
</style>
```

Note: PrimeVue `Checkbox` puts attributes such as `data-testid` on its root element, not on the inner `<input>`. If `setValue(false)` on `[data-testid="riser-express"]` finds no input, find the input inside it (`w.get('[data-testid="riser-express"] input')`) and update the test selector in the same task; do not change what it asserts.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/dialogs
git commit -m "feat: add the End Stock Round dialog

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cycle history on the Scoreboard

**Files:**
- Create: `src/components/CycleHistory.vue`
- Create: `src/components/CycleHistory.test.ts`
- Modify: `src/views/ScoreboardView.vue`
- Modify: `src/views/ScoreboardView.test.ts`

**Interfaces:**
- Consumes: `cycleHistory` (`history.ts`), `saveSnapshot`, `isGameOver` (`rounds.ts`), `PlayerCode`.
- Produces: component `CycleHistory` with prop `game: Game` and event `update: [game: Game]`. Test ids: `cycle-history`, `save-snapshot`. In `ScoreboardView`: a "Now / By cycle" `SelectButton` (test id `scoreboard-mode`) shown only when `game.settings.live`, and a final-ranking banner (test id `final-banner`) when `isGameOver(game)`.

Behavior of `CycleHistory`: with no column, the text "No cycle has finished yet. A snapshot is saved when each cycle ends." One column per snapshot; rows are players (code and name); each cell shows the total, `#rank`, and the change with a sign ("+30", "−10", "–" when none). A "Save snapshot now" button emits `saveSnapshot(game)`. The component also states under the table that the first cycle has no change because the starting cash is not stored.

- [ ] **Step 1: Write the failing tests**

`src/components/CycleHistory.test.ts`:

```ts
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
```

Append to `src/views/ScoreboardView.test.ts` (use the file's existing helpers and imports; add `withRound`, `put`, `testGame` imports if missing):

```ts
describe('ScoreboardView in a live game', () => {
  it('has no Now / By cycle switch in a manual game', () => {
    const manual = { ...testGame(), settings: { ...testGame().settings, live: false } }
    const w = mount(ScoreboardView, { props: { game: manual } })
    expect(w.find('[data-testid="scoreboard-mode"]').exists()).toBe(false)
  })

  it('switches to the cycle history', async () => {
    const w = mount(ScoreboardView, { props: { game: testGame() } })
    expect(w.find('[data-testid="cycle-history"]').exists()).toBe(false)
    const byCycle = w.get('[data-testid="scoreboard-mode"]').findAll('button').find((b) => b.text() === 'By cycle')!
    await byCycle.trigger('click')
    expect(w.find('[data-testid="cycle-history"]').exists()).toBe(true)
  })

  it('shows the final ranking banner when the game is over', () => {
    const over = { ...testGame(), round: { cycle: 7, type: 'SR' as const } }
    const w = mount(ScoreboardView, { props: { game: over } })
    expect(w.get('[data-testid="final-banner"]').text()).toContain('Final ranking')
  })

  it('shows no banner during the game', () => {
    const w = mount(ScoreboardView, { props: { game: testGame() } })
    expect(w.find('[data-testid="final-banner"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/CycleHistory.test.ts src/views/ScoreboardView.test.ts`
Expected: FAIL (the component and the switch do not exist).

- [ ] **Step 3: Implement**

`src/components/CycleHistory.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import PlayerCode from './PlayerCode.vue'
import { cycleHistory } from '../domain/history'
import { saveSnapshot } from '../domain/rounds'
import type { Game } from '../domain/types'

const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ update: [game: Game] }>()

const columns = computed(() => cycleHistory(props.game))
const rows = computed(() =>
  props.game.players.map((player) => ({
    player,
    cells: columns.value.map((c) => c.rows.find((r) => r.playerId === player.id)!),
  })),
)

function change(value: number | null): string {
  if (value === null) return '–'
  return value >= 0 ? `+${value}` : `−${Math.abs(value)}`
}
</script>

<template>
  <section class="history" data-testid="cycle-history" :style="{ '--cols': columns.length }">
    <p v-if="columns.length === 0" class="muted empty">
      No cycle has finished yet. A snapshot is saved when each cycle ends.
    </p>
    <div v-else class="card table">
      <div class="row head">
        <div class="label small strong">Player</div>
        <div v-for="c in columns" :key="c.cycle" class="cell strong">Cycle {{ c.cycle }}</div>
      </div>
      <div v-for="r in rows" :key="r.player.id" class="row">
        <div class="label">
          <PlayerCode :code="r.player.code" />
          <span class="name">{{ r.player.name }}</span>
        </div>
        <div v-for="(cell, i) in r.cells" :key="columns[i].cycle" class="cell">
          <template v-if="cell.total !== null">
            <span class="mono total">{{ cell.total }}</span>
            <span class="small muted">#{{ cell.rank }} · {{ change(cell.change) }}</span>
          </template>
          <span v-else class="mono none">–</span>
        </div>
      </div>
    </div>
    <p v-if="columns.length > 0" class="small muted">
      The first cycle has no change: the starting cash is not stored.
    </p>
    <div>
      <Button
        label="Save snapshot now"
        icon="pi pi-camera"
        severity="secondary"
        outlined
        data-testid="save-snapshot"
        @click="emit('update', saveSnapshot(game))"
      />
    </div>
  </section>
</template>

<style scoped>
.history {
  --label: 180px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty {
  margin: 0;
}
.strong {
  font-weight: 600;
}
.row {
  display: grid;
  grid-template-columns: var(--label) repeat(var(--cols), minmax(88px, 1fr));
  min-height: 56px;
  border-top: 1px solid var(--line);
}
.row.head {
  min-height: 44px;
  border-top: 0;
  background: var(--head);
}
.label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  min-width: 0;
}
.name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  padding: 4px 12px;
}
.row.head .cell {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
}
.total {
  font-size: 18px;
}
.none {
  color: var(--faint);
}
.table {
  overflow-x: auto;
}
@media (max-width: 719px) {
  .history {
    --label: 72px;
  }
  .name {
    display: none;
  }
  .label,
  .cell {
    padding: 4px 6px;
  }
}
</style>
```

`src/views/ScoreboardView.vue`:

In `<script setup>` add the imports `ref` (extend the `vue` import), `SelectButton` from `primevue/selectbutton`, `CycleHistory` from `../components/CycleHistory.vue`, `isGameOver` from `../domain/rounds`, and:

```ts
const mode = ref<'now' | 'cycles'>('now')
const modeOptions = [
  { label: 'Now', value: 'now' },
  { label: 'By cycle', value: 'cycles' },
]
const over = computed(() => isGameOver(props.game))
const winner = computed(() => cards.value[0])
```

In the template, as the first children of `<section class="scoreboard">`, before `<div class="ranked">`:

```vue
    <SelectButton
      v-if="game.settings.live"
      v-model="mode"
      class="mode"
      :options="modeOptions"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      aria-label="Scoreboard view"
      data-testid="scoreboard-mode"
    />
    <p v-if="over" class="note final-banner" data-testid="final-banner">
      <i class="pi pi-flag" aria-hidden="true" />
      <span>
        Final ranking. {{ winner.player.name }} wins with {{ winner.total }}.
      </span>
    </p>
    <CycleHistory v-if="mode === 'cycles' && game.settings.live" :game="game" @update="(g) => emit('update', g)" />
```

and add `v-if="mode === 'now' || !game.settings.live"` to both `<div class="ranked">` and `<div class="table card">` and to the `<p v-for="note in notes" ...>` (wrap all three in one `<template v-if="mode === 'now' || !game.settings.live">` instead of three attributes). Add to the scoped CSS:

```css
.final-banner {
  margin: 0;
  background: var(--lead);
  border: 2px solid var(--primary);
  font-weight: 600;
}
.mode :deep(button) {
  min-height: 44px;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/components src/views
git commit -m "feat: add the cycle history and the final ranking to the Scoreboard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Shell integration, gating and the Setup switch

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/AppTopBar.vue`
- Modify: `src/dialogs/SetupDialog.vue`
- Modify: `src/dialogs/SetupDialog.test.ts`
- Modify: `src/App.test.ts`

**Interfaces:**
- Consumes: `RoundBar` (Task 2), `PhaseDialog` (Task 3), `EndStockRoundDialog` (Task 4), `actionsAllowed`, `advanceRound`, `isGameOver` (`rounds.ts`).
- Produces: `AppTopBar` gains props `canStart: boolean` and `live: boolean`. `SetupDialog` gains a "Round tracking" `SelectButton` (test id `setup-live`) with the options "Score by hand" (`false`, the default) and "Track rounds" (`true`).

Behavior:
- In a live game `App.vue` shows `RoundBar` under the top bar. The main button: in SR it opens `EndStockRoundDialog`; in OR1, OR2 and MR it commits `advanceRound(game)`. When that move ends a cycle (the new round is an SR of a later cycle) and the game is not over, it opens `PhaseDialog` with `exportStep` true. When the game is over it switches the view to the Scoreboard. The phase chip opens `PhaseDialog` with `exportStep` false.
- Gating: Start company (top bar and bottom bar) is disabled unless `actionsAllowed(game).startCompany`; Merge is disabled unless `canMerge(game)` and `actionsAllowed(game).merge`. In a live game a disabled button carries a `title`: "Companies start in the Stock Round" and "Mergers happen in the Merger Round, from the green phase". A manual game is unchanged (`actionsAllowed` allows everything).
- `StartCompanyDialog` and `MergeWizard` are not changed.
- Setup: `SetupDialog` passes `live` from the switch (it is `false` after every `reset()`). Help text under the switch: "Track rounds adds a round bar and limits Start company and Merge to the right round. Cash and shares are still entered by hand."

- [ ] **Step 1: Write the failing tests**

In `src/dialogs/SetupDialog.test.ts` change the existing test that asserts `settings.live === false` to keep asserting the default, and add (use the file's helpers for filling the player names and pressing start; follow the existing "starts a game" test):

```ts
  it('starts a game with round tracking when Track rounds is picked', async () => {
    const w = open()
    // fill two names exactly as the existing start test does, then:
    const options = w.get('[data-testid="setup-live"]').findAll('button')
    await options.find((b) => b.text() === 'Track rounds')!.trigger('click')
    await start(w)
    expect(lastStarted(w).settings.live).toBe(true)
  })

  it('goes back to Score by hand each time the dialog opens', async () => {
    const w = open()
    const options = w.get('[data-testid="setup-live"]').findAll('button')
    await options.find((b) => b.text() === 'Track rounds')!.trigger('click')
    await w.setProps({ visible: false })
    await w.setProps({ visible: true })
    const picked = w.get('[data-testid="setup-live"]').findAll('button').find((b) => b.attributes('aria-pressed') === 'true')
    expect(picked!.text()).toBe('Score by hand')
  })
```

(`open`, `start`, `lastStarted` stand for the helpers the file already uses to mount, fill the names, press `[data-testid="start-game"]` and read the emitted `start` event; reuse them by their real names.)

In `src/App.test.ts` change `sample()` so Phase 1 tests stay Phase 1:

```ts
  return { ...g, name: 'Friday game', settings: { ...g.settings, live: false } }
```

and add:

```ts
describe('App in a live game', () => {
  const live = (patch: Partial<Game> = {}): Game => {
    const g = sample()
    return { ...g, settings: { ...g.settings, live: true }, ...patch }
  }
  const at = (type: 'SR' | 'OR1' | 'OR2' | 'MR', cycle = 1, phase: 'yellow' | 'green' = 'yellow'): Game => {
    const g = live()
    return { ...g, round: { cycle, type }, settings: { ...g.settings, phase } }
  }

  it('shows no round bar in a manual game (review focus 1)', () => {
    useGame().create(sample())
    const w = mount(App)
    expect(w.find('[data-testid="round-bar"]').exists()).toBe(false)
    expect(w.get('[data-testid="start"]').attributes('disabled')).toBeUndefined()
  })

  it('shows the round bar and allows Start company in the Stock Round', () => {
    useGame().create(at('SR'))
    const w = mount(App)
    expect(w.get('[data-testid="round-bar"]').text()).toContain('Cycle 1 of 6')
    expect(w.get('[data-testid="start"]').attributes('disabled')).toBeUndefined()
  })

  it('disables Start company in an Operating Round', () => {
    useGame().create(at('OR1'))
    const w = mount(App)
    expect(w.get('[data-testid="start"]').attributes('disabled')).toBeDefined()
  })

  it('enables Merge only in the Merger Round from the green phase', () => {
    useGame().create(at('MR', 1, 'green'))
    expect(mount(App).get('[data-testid="merge"]').attributes('disabled')).toBeUndefined()
    useGame().create(at('OR2', 1, 'green'))
    expect(mount(App).get('[data-testid="merge"]').attributes('disabled')).toBeDefined()
  })

  it('moves from OR1 to OR2 with the main button, and undo rewinds it (review focus 4)', async () => {
    useGame().create(at('OR1'))
    const w = mount(App)
    await w.get('[data-testid="round-next"]').trigger('click')
    expect(useGame().game.value?.round.type).toBe('OR2')
    useGame().undo()
    expect(useGame().game.value?.round.type).toBe('OR1')
  })

  it('ends the Stock Round through the dialog', async () => {
    useGame().create(at('SR'))
    const w = mount(App)
    await w.get('[data-testid="round-next"]').trigger('click')
    await w.get('[data-testid="end-sr-confirm"]').trigger('click')
    expect(useGame().game.value?.round).toEqual({ cycle: 1, type: 'OR1' })
  })

  it('shows the Export a train reminder after the last Operating Round (review focus 2)', async () => {
    useGame().create(at('OR2'))
    const w = mount(App)
    await w.get('[data-testid="round-next"]').trigger('click')
    expect(useGame().game.value?.round).toEqual({ cycle: 2, type: 'SR' })
    expect(useGame().game.value?.cycleScores).toHaveLength(1)
    expect(w.text()).toContain('Export a train')
  })

  it('shows no reminder after the last cycle, and opens the Scoreboard', async () => {
    useGame().create(at('OR2', 6))
    const w = mount(App)
    await w.get('[data-testid="round-next"]').trigger('click')
    expect(useGame().game.value?.round.cycle).toBe(7)
    expect(w.text()).not.toContain('Take the top train')
    expect(w.find('[data-testid="final-banner"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/App.test.ts src/dialogs/SetupDialog.test.ts`
Expected: FAIL (no round bar, no Setup switch; some existing Merge tests may already fail until `sample()` is manual, which the first edit handles).

- [ ] **Step 3: Implement**

`src/components/AppTopBar.vue`: add `canStart: boolean` and `live: boolean` to the props. On the Start button add `:disabled="!canStart"` and `:title="live && !canStart ? 'Companies start in the Stock Round' : undefined"`. On the Merge button add `:title="live && !canMerge ? 'Mergers happen in the Merger Round, from the green phase' : undefined"`.

`src/dialogs/SetupDialog.vue`: add `const live = ref(false)`, set `live.value = false` in `reset()`, replace `live: false, // Plan 3 replaces this with a Setup toggle` with `live: live.value,`, and add to the template (after the phase field, in the same style as the other fields) :

```vue
      <div class="field">
        <span class="field-label">Round tracking</span>
        <SelectButton
          v-model="live"
          :options="[{ label: 'Score by hand', value: false }, { label: 'Track rounds', value: true }]"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          fluid
          data-testid="setup-live"
        />
        <span class="small muted">
          Track rounds adds a round bar and limits Start company and Merge to the right round. Cash and shares
          are still entered by hand.
        </span>
      </div>
```

`src/App.vue`: add imports

```ts
import RoundBar from './components/RoundBar.vue'
import EndStockRoundDialog from './dialogs/EndStockRoundDialog.vue'
import PhaseDialog from './dialogs/PhaseDialog.vue'
import { actionsAllowed, advanceRound, isGameOver } from './domain/rounds'
```

state and logic (after `mergeable`):

```ts
const endStockOpen = ref(false)
const phaseOpen = ref(false)
const exportStep = ref(false)

const actions = computed(() => (game.value ? actionsAllowed(game.value) : null))
const canStart = computed(() => actions.value?.startCompany ?? false)
const canMergeNow = computed(() => mergeable.value && (actions.value?.merge ?? false))

function nextRound() {
  const current = game.value
  if (!current) return
  if (current.round.type === 'SR') {
    endStockOpen.value = true
    return
  }
  const next = advanceRound(current)
  commit(next)
  if (isGameOver(next)) {
    view.value = 'scoreboard'
  } else if (next.round.type === 'SR') {
    exportStep.value = true
    phaseOpen.value = true
  }
}

function openPhase() {
  exportStep.value = false
  phaseOpen.value = true
}
```

template: pass `:can-start="canStart"`, `:live="game.settings.live"` and `:can-merge="canMergeNow"` to `AppTopBar`; after `<AppTopBar .../>` add

```vue
    <RoundBar v-if="game.settings.live" :game="game" @next="nextRound" @phase="openPhase" />
```

change the two bottom buttons to `:disabled="!canStart"` and `:disabled="!canMergeNow"`; and add, next to the other dialogs:

```vue
    <EndStockRoundDialog v-model:visible="endStockOpen" :game="game" @update="commit" />
    <PhaseDialog v-model:visible="phaseOpen" :game="game" :export-step="exportStep" @update="commit" />
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, clean. If an existing App test fails because it relies on Merge being enabled in a game that is now live, make that test's game manual (`settings.live = false`); do not weaken the new tests.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: show the round bar, gate Start company and Merge, add the Setup switch

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs and verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/design/phase-2-implementation-list.md`
- Modify: `docs/design/README.md`

- [ ] **Step 1: CLAUDE.md**

In the UI section add one bullet:

```markdown
- Round tracking (live games only, `settings.live`): `RoundBar` shows under the top bar; its main button either opens `EndStockRoundDialog` (SR) or commits `advanceRound`. Leaving a cycle opens `PhaseDialog` with the Export a train reminder. `actionsAllowed` gates Start company and Merge. `ScoreboardView` has a Now / By cycle switch (`CycleHistory`) and a final-ranking banner. The Setup dialog chooses `live` (default off). The fourth tab (Stock, Dividend) comes with the Stock Round and Operating Round plans.
```

- [ ] **Step 2: The list**

Mark P2-10 "Done in Plan 2 and 3", P2-11 "Done in Plan 3", P2-12 "Done in Plan 3" (Settings and the phase dialog), P2-14 "Done in Plan 3", P2-15 "Done in Plan 3", P2-26 "Done in Plan 3", P2-51 "Done in Plan 3", P2-71 "Done in Plan 3 (the bar is in the shell; phone layout included)". Mark P2-13 "Gating done in Plan 3; the fourth tab comes with Plans 4 and 5". P2-02: "Done in Plans 1 and 3 (flag and Setup toggle)". Add under section 4 (Design backlog) a line: "Boards not in `docs/design/boards`: Rounds and ScoreboardHistory were built from spec C10; compare with the canvas." Add a deviation line to P2-14: "Cycle 1 shows no change: the starting cash is not stored."

- [ ] **Step 3: Design README**

Under "Decisions" add: "Phase 2 shell, built 2026-10-10 from spec C10 without the Rounds and ScoreboardHistory boards: round bar under the top bar (cycle, round chips, phase chip, main button), End Stock Round dialog with a skip checkbox per company, phase dialog doubling as the Export a train reminder, By cycle table on the Scoreboard." and under Open items: "Rounds and ScoreboardHistory boards are not in this folder; reconcile the built screens with them."

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add CLAUDE.md docs
git commit -m "docs: record the Phase 2 rounds shell

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage:** round indicator and chips (Task 2), phase selector (Tasks 3 and 6), End Stock Round dialog (Task 4), history with Now / By cycle and Save snapshot now (Tasks 1 and 5), final ranking (Task 5), gating and the Setup switch (Task 6), phone layout (Tasks 2 and 5 CSS).
- **Not in this plan:** the fourth tab, Stock and Dividend views (Plans 4 and 5), the start-with-cash dialog (Plan 4), edit mode controls for round and cycle (Plan 6), a way to turn on round tracking for an existing game (deliberately not offered: see the roadmap note on `operated`).
- **Deviations from the spec:** cycle 1 has no change figure (no stored starting cash); the Setup switch defaults to off until the Stock Round and Operating Round plans land; no board was available for Rounds and ScoreboardHistory.
- **Types:** `RoundBar` events `next` and `phase`; `PhaseDialog` props `game` and `exportStep`; `AppTopBar` props `canStart` and `live`; `HistoryColumn` and `HistoryRow` are defined once in Task 1 and used with the same names in Task 5.
- **Risks to watch:** PrimeVue `Checkbox` attribute placement (note in Task 4); existing App tests that assume Merge is enabled in a `testGame()` (note in Task 6, Step 4); `SelectButton` in `ScoreboardView` needs `data-testid` on its root, which PrimeVue passes through as an attribute.
