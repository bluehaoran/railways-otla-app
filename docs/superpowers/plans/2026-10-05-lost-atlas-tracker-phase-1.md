# Lost Atlas Tracker, Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 scorekeeper app for Railways of the Lost Atlas: set up a game, track companies on the stock track, record share ownership, and show each player's ranked total with the tie-break applied.

**Architecture:** A pure TypeScript domain layer (`src/domain/`) holds every rule. Each function takes a `Game` and returns a new `Game`; nothing mutates its input. One store (`src/state/game.ts`) owns the current game in a `ref`, records undo history with `useRefHistory`, and autosaves to `localStorage`. Vue views receive the game as a prop and emit a new `Game` on every user action, so each action is exactly one undo step.

**Tech Stack:** Vue 3.5, Vite 8, TypeScript 5.9, PrimeVue 4.5 (Aura preset from `@primeuix/themes` 2), VueUse 15 (`useRefHistory`, `useStorage`, `useSortable`), SortableJS, `vite-plugin-pwa` 2, Vitest 5 with jsdom and `@vue/test-utils`.

**Spec:** `docs/design/lost-atlas-tracker-design-spec.md`, with `docs/design/README.md` and `docs/design/boards/*.dc.html` for the visual design. `docs/2026-10-05-lost-atlas-tracker-design.md` is the earlier copy of the same spec. Where the two copies differ, this plan follows the copy in `docs/design/`, because it states that it supersedes the earlier text (3 and 4 player games default to Long, a major's second name is selectable, the president circle is the same size as a share circle, market shares use a solid ring, and the Track view uses a bottom dock).

**Scope:** Phase 1 only (spec D1). The Dividend view, buy and sell, treasury cash, round tracking and score history (spec D2) need their own plan. Spec D4 item 6 (redeem) is still open, so Phase 2 cannot be planned completely yet.

## Global Constraints

- Stack is fixed by spec B1: Vue 3, Vite, TypeScript, PrimeVue 4 with the Aura preset, VueUse, `vite-plugin-pwa`, Vitest. No server. No Pinia. No router.
- `src/domain/` is pure TypeScript with no Vue imports. Domain functions never mutate their input.
- Price has one source of truth: a company's price is `TRACK[i]` where `game.track[i]` contains its id. There is no price field. A company is active if and only if it is in `game.track`.
- Shares of a player in a company = `holdings[p] + (president === p ? 2 : 0)`.
- Constants, verbatim from the spec: `UNIT_PCT = { minor: 0.2, major: 0.1 }`, `TOTAL_SHARES = { minor: 5, major: 10 }`. Player limit 60% (minor 3, major 6). Market limit 50% (minor 2, major 5).
- Track, verbatim: `0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200, 220, 245, 270, 300, 330, 360, 400, 450, 500` (27 positions).
- Starting cash: 2 players 450, 3 players 300, 4 players 275, 5 players 220. Game length default: 2 players Short, 3 to 5 players Long.
- Short Game removes Adaptive, Overnight, Bridging and Spacious.
- Bids are at least 120, in steps of 5. Start price range by phase: yellow 60 to 90, green 60 to 110, purple 60 to 135.
- Every user action is one undo step. History is capped at 200 entries and is saved with the game.
- Validation warns and never blocks.
- Design tokens (from `docs/design/README.md`): zinc neutrals, primary emerald-700 `#047857`, amber `#b45309` for edit mode only, IBM Plex Sans for text, IBM Plex Mono for numbers, touch targets 44px or larger.
- Turn order reads highest price on the left (top on a phone).
- Color is never the only signal: every share circle carries a letter or a ring style, and text on a company color has a contrast ratio of 4.5:1 or more.
- The app works offline. Fonts and icons are bundled, not loaded from a CDN.
- Company names, abbreviations and colors come from `docs/design/company-colors.json`, copied to `src/data/companies.json`.
- `schemaVersion` is `1`.

## Deviations from the spec, for review

1. Ownership and Scoreboard use CSS grids that follow the boards, not PrimeVue `DataTable`. `DataTable` is used for the saved games list.
2. The "Show full track" control is a PrimeVue `ToggleSwitch` (as drawn on the board), so `Checkbox` is not used.
3. The phase setting can be changed at any time in Settings, not only in edit mode (spec B8), because the phase advances during normal play. The Short or Long setting follows B8: edit mode only, and only before the first company starts.
4. `playerCode(names)` in spec B4 is named `playerCodes(names)` because it returns one code per name.
5. `moveToken` returns `{ kind: 'moved', game }` or `{ kind: 'close', companyId }`. The second form is the spec's "plan that requires confirmation to close".
6. `mergePlan` takes an optional fifth argument `{ identity, president }` for the name toggle and for the user's choice when `needsChoice` is true.
7. Majors with an unknown second name (`null` in the JSON) show "One name only" instead of a "Name TBD" toggle.
8. Game ids come from `Date.now()` and `Math.random()`, not `crypto.randomUUID()`, because `randomUUID` is missing on a phone that opens the dev server over plain HTTP.
9. The per-token menu of spec C4 ("Move to price", "Move to front", "Move to back") is a row of buttons in the Track dock in edit mode, plus "Close company". It needs one tap less than a popup menu.
10. Import is in the Saved games dialog, next to the list it adds to, not in the top menu. Export of the open game is in the top menu.

## Review Focus

Inputs the spec implies but does not list. Each has a test in the task that owns the code.

1. A cash field is cleared or gets a non-number (the input reports `null`). Expected: cash becomes 0 and totals stay numbers. Test in Task 4 (`setCash`).
2. Player names that are empty, only spaces, identical, differ only by case, or start with a non-letter or an emoji. Expected: every code is non-empty and unique. Test in Task 7.
3. An imported file that is not JSON, is some other JSON, or is a hand-edited export with a missing field. Expected: a clear message, and no saved game is changed. Test in Task 8.
4. Browser storage is full, or a saved entry is corrupt. Expected: the app keeps running, drops the oldest undo steps first, warns, and a corrupt entry is skipped instead of breaking the list. Tests in Task 8 and Task 9.
5. A merge of companies whose share counts were broken in edit mode (no president, or a president with fewer than 2 shares overall). Expected: no negative share counts, and the preview shows that the total is not 10. Test in Task 6.

## File structure

```
index.html
vite.config.ts
tsconfig.json
package.json
scripts/make-icons.mjs        writes the PWA PNG icons (Task 18)
public/                        icon.svg and generated PNG icons (Task 18)
src/
  main.ts                      app bootstrap: PrimeVue, services, fonts
  theme.ts                     Aura preset with emerald primary and zinc surface
  styles/app.css               design tokens and shared classes
  test-setup.ts                Vitest setup: PrimeVue plugins, matchMedia stub
  App.vue                      shell: top bar, views, dialogs, toasts
  data/companies.json          copy of docs/design/company-colors.json
  domain/                      pure TypeScript
    types.ts                   Game, Player, Company and the id types
    contrast.ts                WCAG contrast and inkFor(color)
    companies.ts               company catalogue from the JSON
    setup.ts                   STARTING_CASH, defaultShortGame, newGame
    fixtures.ts                test helpers: testGame, put
    track.ts                   TRACK, snapDown, moveToken, placeToken, startPrice
    shares.ts                  shares, shareTotal, validate
    company.ts                 startCompany, closeCompany
    edit.ts                    setCash, setHolding and the other edit setters
    scoring.ts                 turnOrder, playerTotal, ranking, tieNotes
    presidency.ts              presidencyCandidate, transferPresidency
    merge.ts                   mergePlan, applyMerge
    playerCodes.ts             playerCodes, codeProblems
    format.ts                  ordinal, phase and zone labels
  state/
    saves.ts                   saved games, export, import, migration
    game.ts                    useGame(): ref, history, autosave
    download.ts                save a text file from the browser
    memoryStorage.ts           in-memory Storage for tests
  components/
    CrownIcon.vue  ShareCircle.vue  PlayerCode.vue  CompanyTag.vue
    TokenChip.vue  EditBanner.vue  CountStepper.vue
    AppTopBar.vue  SavesList.vue  TrackQueue.vue
  views/
    TrackView.vue  OwnershipView.vue  ScoreboardView.vue
  dialogs/
    SetupDialog.vue  StartCompanyDialog.vue  MergeWizard.vue
    SettingsDialog.vue
```

Every code block in this plan was extracted into a scratch project and run: 219 tests pass, `vue-tsc` is clean, the production build succeeds, and the acceptance walkthrough in Task 19 was driven in headless Chromium. If a step's output differs from its "Expected" line, stop and look for a typing mistake before changing the code.

Conventions used in every task:

- A block headed **`path`** (full file) is the complete content of that file. If the file exists, replace it.
- Tests sit next to the code as `name.test.ts`.
- Work through the tasks in order. A test file may import code from any earlier task.
- Run one test file with `npx vitest run <path>`. Run everything with `npm test`.
- Player ids are `p1` to `p5`, in seating order.

---

### Task 1: Project scaffold

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/vite-env.d.ts`, `src/main.ts`, `src/theme.ts`, `src/styles/app.css`, `src/test-setup.ts`, `src/App.vue`
- Create: `src/data/companies.json` (copy)
- Test: `src/App.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test`, `npm run typecheck`, `npm run build`, `npm run dev`. The CSS custom properties and shared classes in `src/styles/app.css`. `AtlasPreset` from `src/theme.ts`. A Vitest setup that installs PrimeVue, `ToastService` and `ConfirmationService` for every mounted component, and replaces PrimeVue `Dialog` with a stub that renders inline.

- [ ] **Step 1: Write the project files**

**`.gitignore`** (full file)
```gitignore
node_modules
dist
dev-dist
*.local
*:Zone.Identifier
.DS_Store
```

**`package.json`** (full file)
```json
{
  "name": "lost-atlas-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "@fontsource/ibm-plex-mono": "^5.3.0",
    "@fontsource/ibm-plex-sans": "^5.3.0",
    "@primeuix/themes": "^2.0.3",
    "@vueuse/core": "^15.0.0",
    "@vueuse/integrations": "^15.0.0",
    "primeicons": "^7.0.0",
    "primevue": "^4.5.5",
    "sortablejs": "^1.15.7",
    "vue": "^3.5.43"
  },
  "devDependencies": {
    "@types/node": "^22.20.5",
    "@types/sortablejs": "^1.15.9",
    "@vitejs/plugin-vue": "^6.0.9",
    "@vue/test-utils": "^2.5.1",
    "jsdom": "^30.1.2",
    "typescript": "~5.9.3",
    "vite": "^8.3.2",
    "vite-plugin-pwa": "^2.0.0",
    "vitest": "^5.0.3",
    "vue-tsc": "^3.3.12"
  }
}
```

Keep `primevue` on version 4 and `@primeuix/themes` on version 2. PrimeVue 5 exists, but the spec names PrimeVue 4. Keep TypeScript on 5.9.

**`tsconfig.json`** (full file)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "useDefineForClassFields": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

**`vite.config.ts`** (full file)
```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

**`index.html`** (full file)
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#047857" />
    <title>Lost Atlas Tracker</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**`src/vite-env.d.ts`** (full file)
```ts
/// <reference types="vite/client" />
```

**`src/theme.ts`** (full file)
```ts
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

function scale(name: string): Record<number, string> {
  return Object.fromEntries(shades.map((s) => [s, `{${name}.${s}}`]))
}

// Aura with the design tokens from docs/design/README.md:
// emerald-700 primary and zinc neutrals. Light scheme only.
export const AtlasPreset = definePreset(Aura, {
  semantic: {
    primary: scale('emerald'),
    colorScheme: {
      light: {
        primary: {
          color: '{emerald.700}',
          contrastColor: '#ffffff',
          hoverColor: '{emerald.800}',
          activeColor: '{emerald.900}',
        },
        surface: { 0: '#ffffff', ...scale('zinc') },
      },
    },
  },
})
```

**`src/main.ts`** (full file)
```ts
import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import 'primeicons/primeicons.css'
import './styles/app.css'
import App from './App.vue'
import { AtlasPreset } from './theme'

createApp(App)
  .use(PrimeVue, {
    // '.app-dark' is never set, so the app stays in the light scheme.
    theme: { preset: AtlasPreset, options: { darkModeSelector: '.app-dark' } },
  })
  .use(ToastService)
  .use(ConfirmationService)
  .mount('#app')
```

**`src/styles/app.css`** (full file)
```css
:root {
  --ink: #18181b;
  --ink-2: #3f3f46;
  --muted: #52525b;
  --faint: #71717a;
  --line: #e4e4e7;
  --line-2: #d4d4d8;
  --line-3: #a1a1aa;
  --bg: #f4f4f5;
  --card: #ffffff;
  --head: #fafafa;
  --primary: #047857;
  --lead: #ecfdf5;
  --amber: #b45309;
  --amber-ink: #92400e;
  --amber-bg: #fffbeb;
  --amber-chip: #fef3c7;
  --zone-closed: #fecaca;
  --zone-none: #e4e4e7;
  --zone-yellow: #fde68a;
  --zone-green: #bbf7d0;
  --zone-purple: #e9d5ff;
  --token-border: 1.5px solid rgba(24, 24, 27, 0.45);
  --sans: 'IBM Plex Sans', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, monospace;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 20px;
  -webkit-text-size-adjust: 100%;
}

button,
input {
  font-family: inherit;
}

button {
  cursor: pointer;
}

.mono {
  font-family: var(--mono);
  font-weight: 600;
}

.muted {
  color: var(--muted);
}

.small {
  font-size: 12px;
  line-height: 16px;
}

.card {
  border: 1px solid var(--line-2);
  border-radius: 12px;
  background: var(--card);
  overflow: hidden;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
}

/* Square icon button, 44px touch target. */
.icon-btn {
  width: 44px;
  height: 44px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  background: var(--card);
  color: var(--ink);
  font-size: 18px;
}

.icon-btn:disabled {
  border-color: var(--line);
  background: var(--head);
  color: var(--line-3);
  cursor: default;
}

/* Selection card: a button that shows a chosen state with a border and a tick. */
.pick {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 1px solid var(--line-3);
  border-radius: 8px;
  background: var(--card);
  color: var(--ink);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
}

.pick[aria-pressed='true'],
.pick[aria-checked='true'] {
  border: 2px solid var(--primary);
  background: var(--lead);
  font-weight: 600;
  padding: 0 11px;
}

.pick:disabled {
  opacity: 0.45;
  cursor: default;
}

.note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg);
  font-size: 13px;
  line-height: 18px;
}

.note.warn {
  background: var(--amber-bg);
  color: var(--amber-ink);
}

.zone-closed {
  background: var(--zone-closed);
}
.zone-none {
  background: var(--zone-none);
}
.zone-yellow {
  background: var(--zone-yellow);
}
.zone-green {
  background: var(--zone-green);
}
.zone-purple {
  background: var(--zone-purple);
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

.dialog-footer .grow {
  flex: 1;
  font-size: 13px;
  color: var(--ink-2);
}

.error-text {
  color: #b91c1c;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}
```

**`src/test-setup.ts`** (full file)
```ts
import { defineComponent, h } from 'vue'
import { config } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'

// Every mounted component gets the same plugins as the real app, without a theme.
config.global.plugins = [[PrimeVue, { theme: 'none' }], ToastService, ConfirmationService]

// PrimeVue Dialog teleports to <body> and animates. In tests it renders inline,
// so a wrapper can find the dialog's header, content and footer.
const DialogStub = defineComponent({
  name: 'Dialog',
  props: { visible: Boolean, header: String },
  emits: ['update:visible'],
  setup(props, { slots }) {
    return () =>
      props.visible
        ? h('div', { role: 'dialog' }, [h('h2', props.header), slots.header?.(), slots.default?.(), slots.footer?.()])
        : null
  },
})
config.global.stubs = { Dialog: DialogStub }

// jsdom has no matchMedia. PrimeVue overlays ask for it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
```

**`src/App.vue`** (full file)
```vue
<script setup lang="ts"></script>

<template>
  <main class="home">
    <h1>Lost Atlas Tracker</h1>
    <p class="muted">Scorekeeper for Railways of the Lost Atlas.</p>
  </main>
</template>

<style scoped>
.home {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
}
h1 {
  font-size: 24px;
  line-height: 32px;
  margin: 0;
}
</style>
```

- [ ] **Step 2: Copy the company data and install**

```bash
mkdir -p src/data
cp docs/design/company-colors.json src/data/companies.json
npm install
```

Expected: `npm install` ends with "found 0 vulnerabilities" or a short audit summary, and creates `package-lock.json`.

- [ ] **Step 3: Write the smoke test**

**`src/App.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'

describe('App', () => {
  it('shows the app name when no game is open', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Lost Atlas Tracker')
  })
})
```

- [ ] **Step 4: Run the checks**

Run: `npm test`
Expected: 1 test file, 1 test passed.

Run: `npm run build`
Expected: `vue-tsc` prints nothing, then Vite prints "built in" and writes `dist/`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vite.config.ts index.html src docs
git commit -m "chore: scaffold Vue, PrimeVue and Vitest project"
```

---

### Task 2: Game model, company catalogue and new game

**Files:**
- Create: `src/domain/types.ts`, `src/domain/contrast.ts`, `src/domain/companies.ts`, `src/domain/setup.ts`, `src/domain/fixtures.ts`
- Test: `src/domain/contrast.test.ts`, `src/domain/setup.test.ts`

**Interfaces:**
- Consumes: `src/data/companies.json`.
- Produces:
  - `types.ts`: `PlayerId`, `CompanyId`, `Phase`, `ViewId`, `CompanyStatus`, `CompanyKind`, `Player`, `Company`, `Game`.
  - `contrast.ts`: `INK = '#18181b'`, `contrast(a: string, b: string): number`, `inkFor(fill: string): string`.
  - `companies.ts`: `CompanyInfo { id, kind, abbr, color, ink, names: string[] }`, `COMPANIES: Record<CompanyId, CompanyInfo>`, `MAJOR_IDS`, `MINOR_IDS`, `COMPANY_IDS`, `SHORT_GAME_REMOVED`, `kindOf(id): CompanyKind`, `displayName(company: Company): string`.
  - `setup.ts`: `STARTING_CASH: Record<number, number>`, `defaultShortGame(playerCount: number): boolean`, `newId(): string`, `NewGameOptions`, `newGame(opts, id?, createdAt?): Game`.
  - `fixtures.ts` (tests only): `testGame(names?: string[]): Game` and `put(game, id, { price, president?, holdings?, treasury?, market? }): Game`.

- [ ] **Step 1: Write the types**

**`src/domain/types.ts`** (full file)
```ts
export type PlayerId = string
export type CompanyId = string // keys from companies.json
export type Phase = 'yellow' | 'green' | 'purple'
export type ViewId = 'track' | 'ownership' | 'scoreboard' | 'dividend'
export type CompanyStatus = 'unavailable' | 'unstarted' | 'active' | 'merged' | 'closed'
export type CompanyKind = 'minor' | 'major'

export interface Player {
  id: PlayerId
  name: string
  code: string
  cash: number
}

export interface Company {
  id: CompanyId
  status: CompanyStatus
  president: PlayerId | null
  holdings: Record<PlayerId, number> // regular cards only
  treasuryShares: number // regular cards
  marketShares: number // regular cards
  identity?: number // majors: index into the names list (name toggle)
}

export interface Game {
  schemaVersion: 1
  id: string
  name: string
  createdAt: string // ISO
  settings: { shortGame: boolean; phase: Phase; mainView: ViewId }
  players: Player[] // order = clockwise seating
  companies: Record<CompanyId, Company>
  track: CompanyId[][] // length 27; track[i] is the queue at TRACK[i]; index 0 is the front
}
```

- [ ] **Step 2: Write the failing tests**

**`src/domain/contrast.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { contrast, inkFor } from './contrast'
import { COMPANIES, COMPANY_IDS, MAJOR_IDS, MINOR_IDS } from './companies'

describe('contrast', () => {
  it('gives 21 for black on white', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })
})

describe('inkFor', () => {
  // The ink column of docs/design/boards/Components.dc.html.
  const expected: Record<string, string> = {
    consortium: '#000000',
    union: '#18181b',
    system: '#18181b',
    international: '#18181b',
    federation: '#18181b',
    experiment: '#ffffff',
    spacious: '#18181b',
    adaptive: '#18181b',
    bridging: '#18181b',
    overnight: '#ffffff',
    tunneling: '#18181b',
    resourceful: '#18181b',
    easternMining: '#18181b',
    agricultural: '#ffffff',
    northernPort: '#ffffff',
    expansive: '#18181b',
    express: '#ffffff',
    suburban: '#18181b',
  }

  it('matches the design board for all 18 companies', () => {
    for (const id of COMPANY_IDS) {
      expect(COMPANIES[id].ink, id).toBe(expected[id])
    }
  })

  it('reaches 4.5:1 for every company color', () => {
    for (const id of COMPANY_IDS) {
      expect(contrast(inkFor(COMPANIES[id].color), COMPANIES[id].color), id).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('company catalogue', () => {
  it('has 6 majors and 12 minors', () => {
    expect(MAJOR_IDS).toHaveLength(6)
    expect(MINOR_IDS).toHaveLength(12)
  })

  it('keeps only known names for a major', () => {
    expect(COMPANIES.system.names).toEqual(['System', 'Syndicate'])
    expect(COMPANIES.experiment.names).toEqual(['Experiment', 'Enterprise'])
    expect(COMPANIES.federation.names).toEqual(['Federation'])
  })
})
```

**`src/domain/setup.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { STARTING_CASH, defaultShortGame, newGame } from './setup'
import { displayName } from './companies'

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Player ${i + 1}`, code: `P${i + 1}`, cash: STARTING_CASH[n] }))

describe('setup', () => {
  it('uses the starting cash table', () => {
    expect([STARTING_CASH[2], STARTING_CASH[3], STARTING_CASH[4], STARTING_CASH[5]]).toEqual([450, 300, 275, 220])
  })

  it('defaults 2 players to Short and 3 to 5 players to Long', () => {
    expect([2, 3, 4, 5].map(defaultShortGame)).toEqual([true, false, false, false])
  })

  it('creates an empty game with ids p1..pn and 27 empty queues', () => {
    const g = newGame({ name: 'Friday game', players: players(3), shortGame: false, phase: 'yellow' }, 'g1', '2026-10-05T00:00:00.000Z')
    expect(g.schemaVersion).toBe(1)
    expect(g.id).toBe('g1')
    expect(g.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(g.players.map((p) => p.cash)).toEqual([300, 300, 300])
    expect(g.track).toHaveLength(27)
    expect(g.track.every((q) => q.length === 0)).toBe(true)
    expect(g.settings).toEqual({ shortGame: false, phase: 'yellow', mainView: 'track' })
    expect(Object.keys(g.companies)).toHaveLength(18)
    expect(Object.values(g.companies).every((c) => c.status === 'unstarted')).toBe(true)
  })

  it('marks four minors unavailable in a Short Game and keeps all majors', () => {
    const g = newGame({ name: 'Short', players: players(2), shortGame: true, phase: 'yellow' })
    const unavailable = Object.values(g.companies).filter((c) => c.status === 'unavailable').map((c) => c.id)
    expect(unavailable.sort()).toEqual(['adaptive', 'bridging', 'overnight', 'spacious'])
    expect(g.companies.consortium.status).toBe('unstarted')
  })

  it('gives each new game a different id', () => {
    const opts = { name: 'A', players: players(2), shortGame: true, phase: 'yellow' as const }
    expect(newGame(opts).id).not.toBe(newGame(opts).id)
  })

  it('names a major by its chosen identity', () => {
    const g = newGame({ name: 'A', players: players(2), shortGame: true, phase: 'yellow' })
    expect(displayName(g.companies.system)).toBe('System')
    expect(displayName({ ...g.companies.system, identity: 1 })).toBe('Syndicate')
    expect(displayName({ ...g.companies.federation, identity: 1 })).toBe('Federation')
    expect(displayName(g.companies.easternMining)).toBe('Eastern Mining')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/domain/contrast.test.ts src/domain/setup.test.ts`
Expected: FAIL. Both files report that `./contrast`, `./companies` or `./setup` cannot be resolved.

- [ ] **Step 4: Write the implementation**

**`src/domain/contrast.ts`** (full file)
```ts
export const INK = '#18181b'

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG contrast ratio of two `#rrggbb` colors, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Text color for a company fill: the first of ink, white, black that reaches 4.5:1. */
export function inkFor(fill: string): string {
  for (const candidate of [INK, '#ffffff', '#000000']) {
    if (contrast(candidate, fill) >= 4.5) return candidate
  }
  return contrast('#000000', fill) >= contrast('#ffffff', fill) ? '#000000' : '#ffffff'
}
```

**`src/domain/companies.ts`** (full file)
```ts
import data from '../data/companies.json'
import { inkFor } from './contrast'
import type { Company, CompanyId, CompanyKind } from './types'

export interface CompanyInfo {
  id: CompanyId
  kind: CompanyKind
  abbr: string
  color: string
  ink: string
  names: string[] // minors have one name; majors have one or two
}

const majors: CompanyInfo[] = Object.entries(data.majors).map(([id, m]) => ({
  id,
  kind: 'major',
  abbr: m.abbr,
  color: m.color,
  ink: inkFor(m.color),
  names: m.identities.map((i) => i.name).filter((n): n is string => typeof n === 'string'),
}))

const minors: CompanyInfo[] = Object.entries(data.minors).map(([id, m]) => ({
  id,
  kind: 'minor',
  abbr: m.abbr,
  color: m.color,
  ink: inkFor(m.color),
  names: [m.name],
}))

export const COMPANIES: Record<CompanyId, CompanyInfo> = Object.fromEntries(
  [...majors, ...minors].map((c) => [c.id, c]),
)
export const MAJOR_IDS: CompanyId[] = majors.map((c) => c.id)
export const MINOR_IDS: CompanyId[] = minors.map((c) => c.id)
export const COMPANY_IDS: CompanyId[] = [...MAJOR_IDS, ...MINOR_IDS]

/** Minors that are not available in a Short Game. */
export const SHORT_GAME_REMOVED: CompanyId[] = ['adaptive', 'overnight', 'bridging', 'spacious']

export function kindOf(id: CompanyId): CompanyKind {
  return COMPANIES[id].kind
}

/** The name to show for a company. A major uses its chosen identity. */
export function displayName(company: Company): string {
  const names = COMPANIES[company.id].names
  return names[company.identity ?? 0] ?? names[0]
}
```

**`src/domain/setup.ts`** (full file)
```ts
import { COMPANY_IDS, SHORT_GAME_REMOVED } from './companies'
import type { Company, Game, Phase } from './types'

export const STARTING_CASH: Record<number, number> = { 2: 450, 3: 300, 4: 275, 5: 220 }
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 5

/** 2 player games default to Short. 3 to 5 player games default to Long. */
export function defaultShortGame(playerCount: number): boolean {
  return playerCount === 2
}

/** A short unique id. Does not need a secure context, unlike crypto.randomUUID. */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export interface NewGameOptions {
  name: string
  players: { name: string; code: string; cash: number }[]
  shortGame: boolean
  phase: Phase
}

export function newGame(opts: NewGameOptions, id: string = newId(), createdAt: string = new Date().toISOString()): Game {
  const companies: Record<string, Company> = {}
  for (const companyId of COMPANY_IDS) {
    companies[companyId] = {
      id: companyId,
      status: opts.shortGame && SHORT_GAME_REMOVED.includes(companyId) ? 'unavailable' : 'unstarted',
      president: null,
      holdings: {},
      treasuryShares: 0,
      marketShares: 0,
    }
  }
  return {
    schemaVersion: 1,
    id,
    name: opts.name,
    createdAt,
    settings: { shortGame: opts.shortGame, phase: opts.phase, mainView: 'track' },
    players: opts.players.map((p, i) => ({ id: `p${i + 1}`, name: p.name, code: p.code, cash: p.cash })),
    companies,
    track: Array.from({ length: 27 }, () => []),
  }
}
```

**`src/domain/fixtures.ts`** (full file)
```ts
// Test helpers. Not imported by app code.
import { newGame } from './setup'
import type { CompanyId, Game, PlayerId } from './types'

const PRICES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200, 220, 245, 270, 300, 330, 360, 400, 450, 500]

/** A Long Game in the yellow phase. Players get ids p1, p2, ... and code = name, cash 0. */
export function testGame(names: string[] = ['J', 'K']): Game {
  return newGame(
    { name: 'Test', players: names.map((n) => ({ name: n, code: n, cash: 0 })), shortGame: false, phase: 'yellow' },
    'g1',
    '2026-01-01T00:00:00.000Z',
  )
}

/** Puts a company on the track at `price` (back of the queue) with the given ownership. */
export function put(
  game: Game,
  id: CompanyId,
  o: { price: number; president?: PlayerId | null; holdings?: Record<PlayerId, number>; treasury?: number; market?: number },
): Game {
  const index = PRICES.indexOf(o.price)
  if (index < 1) throw new Error(`${o.price} is not a track price above 0`)
  return {
    ...game,
    companies: {
      ...game.companies,
      [id]: {
        ...game.companies[id],
        status: 'active',
        president: o.president ?? null,
        holdings: o.holdings ?? {},
        treasuryShares: o.treasury ?? 0,
        marketShares: o.market ?? 0,
      },
    },
    track: game.track.map((q, i) => (i === index ? [...q, id] : q)),
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/domain/contrast.test.ts src/domain/setup.test.ts`
Expected: PASS, 2 files, 11 tests.

Run: `npm run typecheck`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat: add game model, company catalogue and new game setup"
```

---

### Task 3: Stock track

**Files:**
- Create: `src/domain/track.ts`
- Test: `src/domain/track.test.ts`

**Interfaces:**
- Consumes: `Game`, `CompanyId`, `Phase` from `types.ts`. `testGame`, `put` from `fixtures.ts`.
- Produces:
  - `TRACK: readonly number[]` (27 values), `TOP = 26`.
  - `Zone = 'closed' | 'none' | 'yellow' | 'green' | 'purple'`, `zoneOf(price: number): Zone`.
  - `START_MIN = 60`, `PHASE_MAX: Record<Phase, number>` (`90`, `110`, `135`), `startPrices(phase): number[]`.
  - `snapDown(value: number): number`.
  - `TokenPos { index: number; slot: number }`, `findToken(game, id): TokenPos | null`, `priceOf(game, id): number | null`.
  - `MoveResult = { kind: 'moved'; game: Game } | { kind: 'close'; companyId: CompanyId }`.
  - `placeToken(game, id, index, slot?): MoveResult` puts a token at any position and queue slot (default: back).
  - `moveToken(game, id, steps): MoveResult` moves by increments, clamps at 500, and always joins the back of the target queue.
  - `startPrice(bid: number, phase: Phase): number`, throws `RangeError` for a bid below 120 or not a multiple of 5.

- [ ] **Step 1: Write the failing test**

**`src/domain/track.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { TRACK, findToken, moveToken, placeToken, priceOf, snapDown, startPrice, startPrices, zoneOf } from './track'
import { put, testGame } from './fixtures'

function moved(result: ReturnType<typeof moveToken>) {
  if (result.kind !== 'moved') throw new Error('expected a move')
  return result.game
}

describe('TRACK and snapDown', () => {
  it('has 27 positions from 0 to 500', () => {
    expect(TRACK).toHaveLength(27)
    expect(TRACK[0]).toBe(0)
    expect(TRACK[26]).toBe(500)
  })

  it('snaps down to a track position', () => {
    expect(snapDown(87.5)).toBe(80)
    expect(snapDown(137)).toBe(135)
    expect(snapDown(9)).toBe(0)
    expect(snapDown(80)).toBe(80)
    expect(snapDown(9999)).toBe(500)
  })

  it('returns 0 for a negative value or NaN', () => {
    expect(snapDown(-5)).toBe(0)
    expect(snapDown(Number.NaN)).toBe(0)
  })

  it('names the zone of a price', () => {
    expect([0, 50, 60, 90, 100, 110, 120, 135, 150].map(zoneOf)).toEqual([
      'closed', 'none', 'yellow', 'yellow', 'green', 'green', 'purple', 'purple', 'none',
    ])
  })
})

describe('startPrice', () => {
  it('halves the bid, snaps down, and clamps to the phase', () => {
    expect(startPrice(120, 'yellow')).toBe(60)
    expect(startPrice(160, 'yellow')).toBe(80)
    expect(startPrice(175, 'yellow')).toBe(80)
    expect(startPrice(130, 'yellow')).toBe(60)
    expect(startPrice(200, 'yellow')).toBe(90)
    expect(startPrice(200, 'green')).toBe(100)
    expect(startPrice(300, 'green')).toBe(110)
    expect(startPrice(300, 'purple')).toBe(135)
  })

  it('rejects a bid below 120 or not a multiple of 5', () => {
    expect(() => startPrice(115, 'yellow')).toThrow(RangeError)
    expect(() => startPrice(122, 'yellow')).toThrow(RangeError)
    expect(() => startPrice(Number.NaN, 'yellow')).toThrow(RangeError)
  })

  it('lists the allowed start prices of a phase', () => {
    expect(startPrices('yellow')).toEqual([60, 70, 80, 90])
    expect(startPrices('green')).toEqual([60, 70, 80, 90, 100, 110])
    expect(startPrices('purple')).toEqual([60, 70, 80, 90, 100, 110, 120, 135])
  })
})

describe('moveToken', () => {
  it('moves up 2 from 110 to 135', () => {
    const g = put(testGame(), 'express', { price: 110 })
    expect(priceOf(moved(moveToken(g, 'express', 2)), 'express')).toBe(135)
  })

  it('stays at 500 when moved up, and goes to the back of the queue', () => {
    let g = put(testGame(), 'express', { price: 500 })
    g = put(g, 'tunneling', { price: 500 })
    const after = moved(moveToken(g, 'express', 1))
    expect(after.track[26]).toEqual(['tunneling', 'express'])
  })

  it('asks to close when a move reaches 0', () => {
    const g = put(testGame(), 'express', { price: 10 })
    expect(moveToken(g, 'express', -1)).toEqual({ kind: 'close', companyId: 'express' })
    expect(moveToken(g, 'express', -5)).toEqual({ kind: 'close', companyId: 'express' })
  })

  it('joins the back of an occupied queue', () => {
    let g = put(testGame(), 'express', { price: 80 })
    g = put(g, 'tunneling', { price: 70 })
    const after = moved(moveToken(g, 'tunneling', 1))
    expect(after.track[8]).toEqual(['express', 'tunneling'])
    expect(after.track[7]).toEqual([])
  })

  it('does not change the game it was given', () => {
    const g = put(testGame(), 'express', { price: 80 })
    const before = JSON.stringify(g)
    moveToken(g, 'express', 1)
    expect(JSON.stringify(g)).toBe(before)
  })

  it('throws for a company that is not on the track', () => {
    expect(() => moveToken(testGame(), 'express', 1)).toThrow()
  })
})

describe('placeToken', () => {
  it('puts a token at a chosen queue slot', () => {
    let g = put(testGame(), 'express', { price: 80 })
    g = put(g, 'tunneling', { price: 80 })
    g = put(g, 'suburban', { price: 60 })
    const after = moved(placeToken(g, 'suburban', 8, 0))
    expect(after.track[8]).toEqual(['suburban', 'express', 'tunneling'])
    expect(findToken(after, 'suburban')).toEqual({ index: 8, slot: 0 })
  })

  it('reorders inside one queue', () => {
    let g = put(testGame(), 'express', { price: 80 })
    g = put(g, 'tunneling', { price: 80 })
    expect(moved(placeToken(g, 'express', 8)).track[8]).toEqual(['tunneling', 'express'])
    expect(moved(placeToken(g, 'tunneling', 8, 0)).track[8]).toEqual(['tunneling', 'express'])
  })

  it('asks to close for position 0 and rejects a position off the track', () => {
    const g = put(testGame(), 'express', { price: 80 })
    expect(placeToken(g, 'express', 0)).toEqual({ kind: 'close', companyId: 'express' })
    expect(() => placeToken(g, 'express', 27)).toThrow(RangeError)
    expect(() => placeToken(g, 'express', 2.5)).toThrow(RangeError)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/track.test.ts`
Expected: FAIL, `./track` cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/domain/track.ts`** (full file)
```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/track.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/track.ts src/domain/track.test.ts
git commit -m "feat: add stock track, token moves and start price"
```

---
### Task 4: Shares, validation, company lifecycle and edit setters

**Files:**
- Create: `src/domain/shares.ts`, `src/domain/company.ts`, `src/domain/edit.ts`
- Test: `src/domain/shares.test.ts`, `src/domain/company.test.ts`, `src/domain/edit.test.ts`

**Interfaces:**
- Consumes: `Game`, `Company`, `CompanyId`, `PlayerId`, `Phase`, `ViewId` from `types.ts`; `kindOf`, `displayName`, `COMPANIES`, `SHORT_GAME_REMOVED` from `companies.ts`; `TRACK` from `track.ts`.
- Produces:
  - `shares.ts`: `UNIT_PCT`, `TOTAL_SHARES`, `PLAYER_LIMIT`, `MARKET_LIMIT` (each `{ minor, major }`), `shares(company: Company, playerId: PlayerId): number`, `shareTotal(company: Company): number`, `WarningCode`, `Warning { code, companyId?, playerId?, message }`, `validate(game: Game): Warning[]`.
  - `company.ts`: `startCompany(game, id, presidentId, price): Game`, `closeCompany(game, id): Game`.
  - `edit.ts`: `setCash(game, playerId, cash: number | null): Game`, `setHolding(game, companyId, playerId, n: number | null): Game`, `setTreasuryShares(game, companyId, n): Game`, `setMarketShares(game, companyId, n): Game`, `setPresident(game, companyId, playerId: PlayerId | null): Game`, `setPhase(game, phase): Game`, `setMainView(game, view): Game`, `renameGame(game, name): Game`, `canChangeShortGame(game): boolean`, `setShortGame(game, shortGame): Game`.

- [ ] **Step 1: Write the failing tests**

**`src/domain/shares.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { MARKET_LIMIT, PLAYER_LIMIT, TOTAL_SHARES, UNIT_PCT, shareTotal, shares, validate } from './shares'
import { put, testGame } from './fixtures'

const [J, K] = ['p1', 'p2']
const codes = (g: ReturnType<typeof testGame>) => validate(g).map((w) => w.code)

describe('share constants', () => {
  it('match the spec', () => {
    expect(UNIT_PCT).toEqual({ minor: 0.2, major: 0.1 })
    expect(TOTAL_SHARES).toEqual({ minor: 5, major: 10 })
    expect(PLAYER_LIMIT).toEqual({ minor: 3, major: 6 })
    expect(MARKET_LIMIT).toEqual({ minor: 2, major: 5 })
  })
})

describe('shares', () => {
  it('counts the president card as 2', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [J]: 1, [K]: 1 }, treasury: 1 })
    expect(shares(g.companies.express, J)).toBe(3)
    expect(shares(g.companies.express, K)).toBe(1)
    expect(shares(g.companies.express, 'nobody')).toBe(0)
    expect(shareTotal(g.companies.express)).toBe(5)
  })
})

describe('validate', () => {
  it('returns nothing for a sound game', () => {
    let g = put(testGame(), 'express', { price: 80, president: J, treasury: 3 })
    g = put(g, 'union', { price: 100, president: K, holdings: { [J]: 2 }, treasury: 4, market: 2 })
    expect(validate(g)).toEqual([])
  })

  it('warns when shares do not total 100%', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, treasury: 2 })
    const w = validate(g)
    expect(w).toHaveLength(1)
    expect(w[0]).toMatchObject({ code: 'share-sum', companyId: 'express' })
    expect(w[0].message).toBe('Express: shares total 4 of 5')
  })

  it('warns above the 60% player limit: 4 of a minor, 7 of a major', () => {
    const minor = put(testGame(), 'express', { price: 80, president: J, holdings: { [J]: 2 }, treasury: 1 })
    expect(codes(minor)).toEqual(['player-limit'])
    const atLimit = put(testGame(), 'express', { price: 80, president: J, holdings: { [J]: 1 }, treasury: 2 })
    expect(codes(atLimit)).toEqual([])
    const major = put(testGame(), 'union', { price: 100, president: J, holdings: { [J]: 5 }, treasury: 3 })
    expect(codes(major)).toEqual(['player-limit'])
    const majorAtLimit = put(testGame(), 'union', { price: 100, president: J, holdings: { [J]: 4 }, treasury: 4 })
    expect(codes(majorAtLimit)).toEqual([])
  })

  it('warns above the 50% market limit: 3 of a minor, 6 of a major', () => {
    expect(codes(put(testGame(), 'express', { price: 80, president: J, market: 3 }))).toEqual(['market-limit'])
    expect(codes(put(testGame(), 'express', { price: 80, president: J, market: 2, treasury: 1 }))).toEqual([])
    expect(codes(put(testGame(), 'union', { price: 100, president: J, market: 6, treasury: 2 }))).toEqual(['market-limit'])
    expect(codes(put(testGame(), 'union', { price: 100, president: J, market: 5, treasury: 3 }))).toEqual([])
  })

  it('warns when the president is missing', () => {
    const g = put(testGame(), 'express', { price: 80, treasury: 5 })
    expect(codes(g)).toEqual(['no-president'])
  })

  it('warns when another player holds more than the president', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 3 } })
    const w = validate(g)
    expect(w.map((x) => x.code)).toEqual(['president-outvoted'])
    expect(w[0]).toMatchObject({ companyId: 'express', playerId: K })
    expect(w[0].message).toBe('Express: K has 3, president J has 2')
  })

  it('warns about negative cash', () => {
    const g = testGame()
    g.players[1].cash = -10
    expect(validate(g)).toEqual([{ code: 'negative-cash', playerId: K, message: 'K has negative cash' }])
  })

  it('ignores companies that are not active', () => {
    const g = testGame()
    g.companies.express = { ...g.companies.express, status: 'closed', treasuryShares: 1 }
    expect(validate(g)).toEqual([])
  })
})
```

**`src/domain/company.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { closeCompany, startCompany } from './company'
import { validate } from './shares'
import { put, testGame } from './fixtures'

const [J, K] = ['p1', 'p2']

describe('startCompany', () => {
  it('gives the president card to the player and 3 shares to the treasury', () => {
    const g = startCompany(testGame(), 'express', K, 80)
    expect(g.companies.express).toEqual({
      id: 'express',
      status: 'active',
      president: K,
      holdings: {},
      treasuryShares: 3,
      marketShares: 0,
    })
    expect(g.track[8]).toEqual(['express'])
    expect(validate(g)).toEqual([])
  })

  it('joins the back of the queue', () => {
    let g = startCompany(testGame(), 'express', J, 80)
    g = startCompany(g, 'tunneling', K, 80)
    expect(g.track[8]).toEqual(['express', 'tunneling'])
  })

  it('does not change cash in Phase 1', () => {
    const g = startCompany(testGame(), 'express', J, 80)
    expect(g.players.map((p) => p.cash)).toEqual([0, 0])
  })

  it('rejects a major, a started company, an unknown player, and an off-track price', () => {
    const g = startCompany(testGame(), 'express', J, 80)
    expect(() => startCompany(g, 'union', J, 80)).toThrow()
    expect(() => startCompany(g, 'express', J, 80)).toThrow()
    expect(() => startCompany(g, 'tunneling', 'p9', 80)).toThrow()
    expect(() => startCompany(g, 'tunneling', J, 85)).toThrow()
    expect(() => startCompany(g, 'tunneling', J, 0)).toThrow()
  })
})

describe('closeCompany', () => {
  it('clears the shares and takes the token off the track', () => {
    let g = put(testGame(), 'express', { price: 10, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
    g = put(g, 'tunneling', { price: 10, president: K, treasury: 3 })
    const closed = closeCompany(g, 'express')
    expect(closed.companies.express).toEqual({
      id: 'express',
      status: 'closed',
      president: null,
      holdings: {},
      treasuryShares: 0,
      marketShares: 0,
    })
    expect(closed.track[1]).toEqual(['tunneling'])
    expect(g.track[1]).toEqual(['express', 'tunneling'])
  })
})
```

**`src/domain/edit.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import {
  canChangeShortGame,
  renameGame,
  setCash,
  setHolding,
  setMainView,
  setMarketShares,
  setPhase,
  setPresident,
  setShortGame,
  setTreasuryShares,
} from './edit'
import { startCompany } from './company'
import { put, testGame } from './fixtures'

const [J, K] = ['p1', 'p2']

describe('setCash', () => {
  it('sets a whole number and allows a negative value', () => {
    expect(setCash(testGame(), J, 142).players[0].cash).toBe(142)
    expect(setCash(testGame(), J, -5).players[0].cash).toBe(-5)
    expect(setCash(testGame(), J, 10.6).players[0].cash).toBe(11)
  })

  // Review Focus 1: a cleared input reports null.
  it('treats a cleared or non-number value as 0', () => {
    const g = setCash(testGame(), J, 300)
    expect(setCash(g, J, null).players[0].cash).toBe(0)
    expect(setCash(g, J, Number.NaN).players[0].cash).toBe(0)
    expect(setCash(g, J, undefined as unknown as number).players[0].cash).toBe(0)
  })
})

describe('share setters', () => {
  const base = () => put(testGame(), 'express', { price: 80, president: J, treasury: 3 })

  it('set regular cards, treasury and market counts', () => {
    let g = setHolding(base(), 'express', K, 2)
    g = setTreasuryShares(g, 'express', 1)
    g = setMarketShares(g, 'express', 1)
    expect(g.companies.express.holdings).toEqual({ [K]: 2 })
    expect(g.companies.express.treasuryShares).toBe(1)
    expect(g.companies.express.marketShares).toBe(1)
  })

  it('never go below 0 and treat a cleared value as 0', () => {
    expect(setHolding(base(), 'express', K, -1).companies.express.holdings[K]).toBe(0)
    expect(setTreasuryShares(base(), 'express', null).companies.express.treasuryShares).toBe(0)
    expect(setMarketShares(base(), 'express', Number.NaN).companies.express.marketShares).toBe(0)
  })

  it('set or clear the president without moving any cards', () => {
    expect(setPresident(base(), 'express', K).companies.express.president).toBe(K)
    expect(setPresident(base(), 'express', null).companies.express.president).toBeNull()
    expect(setPresident(base(), 'express', K).companies.express.holdings).toEqual({})
  })
})

describe('settings', () => {
  it('sets the phase, the main view and the name', () => {
    expect(setPhase(testGame(), 'green').settings.phase).toBe('green')
    expect(setMainView(testGame(), 'scoreboard').settings.mainView).toBe('scoreboard')
    expect(renameGame(testGame(), '  Friday  ').name).toBe('Friday')
    expect(renameGame(testGame(), '   ').name).toBe('Test')
  })

  it('switches to a Short Game before the first company starts', () => {
    const short = setShortGame(testGame(), true)
    expect(short.settings.shortGame).toBe(true)
    expect(['adaptive', 'overnight', 'bridging', 'spacious'].map((id) => short.companies[id].status)).toEqual([
      'unavailable', 'unavailable', 'unavailable', 'unavailable',
    ])
    const long = setShortGame(short, false)
    expect(long.companies.adaptive.status).toBe('unstarted')
  })

  it('locks the Short Game flag once a company has started', () => {
    const g = startCompany(testGame(), 'express', J, 80)
    expect(canChangeShortGame(testGame())).toBe(true)
    expect(canChangeShortGame(g)).toBe(false)
    expect(() => setShortGame(g, true)).toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/shares.test.ts src/domain/company.test.ts src/domain/edit.test.ts`
Expected: FAIL, the three modules cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/domain/shares.ts`** (full file)
```ts
import { displayName, kindOf } from './companies'
import type { Company, CompanyId, Game, PlayerId } from './types'

export const UNIT_PCT = { minor: 0.2, major: 0.1 }
export const TOTAL_SHARES = { minor: 5, major: 10 }
/** A player holds at most 60% of a company. */
export const PLAYER_LIMIT = { minor: 3, major: 6 }
/** The market holds at most 50% of a company. */
export const MARKET_LIMIT = { minor: 2, major: 5 }

/** Shares a player holds: regular cards, plus 2 for the president card. */
export function shares(company: Company, playerId: PlayerId): number {
  return (company.holdings[playerId] ?? 0) + (company.president === playerId ? 2 : 0)
}

/** All shares accounted for: players, the president card, treasury and market. */
export function shareTotal(company: Company): number {
  const held = Object.values(company.holdings).reduce((sum, n) => sum + n, 0)
  return held + (company.president === null ? 0 : 2) + company.treasuryShares + company.marketShares
}

export type WarningCode =
  | 'share-sum'
  | 'player-limit'
  | 'market-limit'
  | 'no-president'
  | 'president-outvoted'
  | 'negative-cash'

export interface Warning {
  code: WarningCode
  companyId?: CompanyId
  playerId?: PlayerId
  message: string
}

/** Rule warnings for the current state. Warnings never block an action. */
export function validate(game: Game): Warning[] {
  const out: Warning[] = []
  for (const company of Object.values(game.companies)) {
    if (company.status !== 'active') continue
    const kind = kindOf(company.id)
    const name = displayName(company)
    const companyId = company.id

    const sum = shareTotal(company)
    if (sum !== TOTAL_SHARES[kind]) {
      out.push({ code: 'share-sum', companyId, message: `${name}: shares total ${sum} of ${TOTAL_SHARES[kind]}` })
    }

    for (const p of game.players) {
      const n = shares(company, p.id)
      if (n > PLAYER_LIMIT[kind]) {
        out.push({
          code: 'player-limit',
          companyId,
          playerId: p.id,
          message: `${name}: ${p.code} holds ${n} shares, the limit is ${PLAYER_LIMIT[kind]}`,
        })
      }
    }

    if (company.marketShares > MARKET_LIMIT[kind]) {
      out.push({
        code: 'market-limit',
        companyId,
        message: `${name}: the market holds ${company.marketShares} shares, the limit is ${MARKET_LIMIT[kind]}`,
      })
    }

    const president = game.players.find((p) => p.id === company.president)
    if (!president) {
      out.push({ code: 'no-president', companyId, message: `${name} has no president` })
    } else {
      const presidentShares = shares(company, president.id)
      let top = president
      for (const p of game.players) if (shares(company, p.id) > shares(company, top.id)) top = p
      if (top.id !== president.id) {
        out.push({
          code: 'president-outvoted',
          companyId,
          playerId: top.id,
          message: `${name}: ${top.code} has ${shares(company, top.id)}, president ${president.code} has ${presidentShares}`,
        })
      }
    }
  }
  for (const p of game.players) {
    if (p.cash < 0) out.push({ code: 'negative-cash', playerId: p.id, message: `${p.name} has negative cash` })
  }
  return out
}
```

**`src/domain/company.ts`** (full file)
```ts
import { COMPANIES } from './companies'
import { TRACK } from './track'
import type { CompanyId, Game, PlayerId } from './types'

/**
 * Starts a minor: the president gets the president card (2 shares), the 3 regular
 * cards go to the company treasury, and the token joins the back of the queue at `price`.
 * Cash is not changed in Phase 1.
 */
export function startCompany(game: Game, id: CompanyId, presidentId: PlayerId, price: number): Game {
  const company = game.companies[id]
  if (!company || COMPANIES[id].kind !== 'minor') throw new Error(`${id} is not a minor company`)
  if (company.status !== 'unstarted') throw new Error(`${id} cannot be started`)
  if (!game.players.some((p) => p.id === presidentId)) throw new Error(`No player ${presidentId}`)
  const index = TRACK.indexOf(price)
  if (index < 1) throw new RangeError(`${price} is not a track price`)
  return {
    ...game,
    companies: {
      ...game.companies,
      [id]: { id, status: 'active', president: presidentId, holdings: {}, treasuryShares: 3, marketShares: 0 },
    },
    track: game.track.map((queue, i) => (i === index ? [...queue, id] : queue)),
  }
}

/** Dissolves a company: its shares leave the game and its token leaves the track. */
export function closeCompany(game: Game, id: CompanyId): Game {
  return {
    ...game,
    companies: {
      ...game.companies,
      [id]: { id, status: 'closed', president: null, holdings: {}, treasuryShares: 0, marketShares: 0 },
    },
    track: game.track.map((queue) => queue.filter((c) => c !== id)),
  }
}
```

**`src/domain/edit.ts`** (full file)
```ts
// Direct edits for edit mode and for the cash row. They accept any value and never validate.
import { SHORT_GAME_REMOVED } from './companies'
import type { Company, CompanyId, Game, Phase, PlayerId, ViewId } from './types'

/** A share count: a whole number, 0 or more. A cleared input (null) counts as 0. */
function count(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

/** A cash amount: a whole number, may be negative. A cleared input (null) counts as 0. */
function money(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
}

function patchCompany(game: Game, id: CompanyId, patch: Partial<Company>): Game {
  return { ...game, companies: { ...game.companies, [id]: { ...game.companies[id], ...patch } } }
}

export function setCash(game: Game, playerId: PlayerId, cash: number | null): Game {
  return { ...game, players: game.players.map((p) => (p.id === playerId ? { ...p, cash: money(cash) } : p)) }
}

export function setHolding(game: Game, companyId: CompanyId, playerId: PlayerId, n: number | null): Game {
  return patchCompany(game, companyId, { holdings: { ...game.companies[companyId].holdings, [playerId]: count(n) } })
}

export function setTreasuryShares(game: Game, companyId: CompanyId, n: number | null): Game {
  return patchCompany(game, companyId, { treasuryShares: count(n) })
}

export function setMarketShares(game: Game, companyId: CompanyId, n: number | null): Game {
  return patchCompany(game, companyId, { marketShares: count(n) })
}

/** Sets the president directly. No cards are exchanged; use transferPresidency for the rule. */
export function setPresident(game: Game, companyId: CompanyId, playerId: PlayerId | null): Game {
  return patchCompany(game, companyId, { president: playerId })
}

export function setPhase(game: Game, phase: Phase): Game {
  return { ...game, settings: { ...game.settings, phase } }
}

export function setMainView(game: Game, mainView: ViewId): Game {
  return { ...game, settings: { ...game.settings, mainView } }
}

/** Renames the game. An empty name keeps the old one. */
export function renameGame(game: Game, name: string): Game {
  const trimmed = name.trim()
  return trimmed === '' ? game : { ...game, name: trimmed }
}

/** The Short Game flag can change only before the first company starts. */
export function canChangeShortGame(game: Game): boolean {
  return Object.values(game.companies).every((c) => c.status === 'unstarted' || c.status === 'unavailable')
}

export function setShortGame(game: Game, shortGame: boolean): Game {
  if (!canChangeShortGame(game)) throw new Error('The game length is fixed once a company has started')
  const companies = { ...game.companies }
  for (const id of SHORT_GAME_REMOVED) {
    companies[id] = { ...companies[id], status: shortGame ? 'unavailable' : 'unstarted' }
  }
  return { ...game, settings: { ...game.settings, shortGame }, companies }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domain/shares.test.ts src/domain/company.test.ts src/domain/edit.test.ts`
Expected: PASS, 3 files, 23 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add share counting, validation, company start and close, edit setters"
```

---

### Task 5: Turn order, totals and ranking

**Files:**
- Create: `src/domain/scoring.ts`
- Test: `src/domain/scoring.test.ts`

**Interfaces:**
- Consumes: `shares` from `shares.ts`; `TRACK` from `track.ts`; `displayName` from `companies.ts`; `put`, `testGame` from `fixtures.ts`.
- Produces:
  - `turnOrder(game): CompanyId[]` (price descending, then queue order).
  - `playerTotal(game, playerId): number`.
  - `RankEntry { playerId: PlayerId; total: number; rank: number; tieBreakApplied: boolean }`.
  - `ranking(game): RankEntry[]`, sorted best first. Players that stay tied share a rank, and the next rank skips (1, 2, 2, 4).
  - `tieNotes(game): string[]`, one sentence per tie that explains the order.

- [ ] **Step 1: Write the failing test**

**`src/domain/scoring.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { playerTotal, ranking, tieNotes, turnOrder } from './scoring'
import { put, testGame } from './fixtures'

const [J, K, L] = ['p1', 'p2', 'p3']

function withCash(game: ReturnType<typeof testGame>, cash: number[]) {
  return { ...game, players: game.players.map((p, i) => ({ ...p, cash: cash[i] })) }
}

describe('turnOrder', () => {
  it('sorts by price descending, then by queue order', () => {
    let g = put(testGame(), 'tunneling', { price: 90 })
    g = put(g, 'express', { price: 110 })
    g = put(g, 'northernPort', { price: 90 })
    g = put(g, 'resourceful', { price: 60 })
    expect(turnOrder(g)).toEqual(['express', 'tunneling', 'northernPort', 'resourceful'])
  })

  it('is empty for a new game', () => {
    expect(turnOrder(testGame())).toEqual([])
  })
})

describe('playerTotal', () => {
  it('adds cash and shares times price (spec D3 test 5)', () => {
    let g = withCash(testGame(), [100, 0])
    g = put(g, 'express', { price: 80, president: J, holdings: { [J]: 1 }, treasury: 2 })
    g = put(g, 'union', { price: 60, president: K, holdings: { [J]: 1 }, treasury: 7 })
    expect(playerTotal(g, J)).toBe(400)
    expect(playerTotal(g, K)).toBe(120)
  })

  it('ignores treasury and market shares and companies that are off the track', () => {
    let g = withCash(testGame(), [50, 0])
    g = put(g, 'express', { price: 80, treasury: 3, market: 2 })
    g.companies.tunneling = { ...g.companies.tunneling, status: 'closed', president: J, holdings: { [J]: 3 } }
    expect(playerTotal(g, J)).toBe(50)
  })
})

describe('ranking', () => {
  it('ranks by total, highest first', () => {
    const g = withCash(testGame(['J', 'K', 'L']), [10, 30, 20])
    expect(ranking(g)).toEqual([
      { playerId: K, total: 30, rank: 1, tieBreakApplied: false },
      { playerId: L, total: 20, rank: 2, tieBreakApplied: false },
      { playerId: J, total: 10, rank: 3, tieBreakApplied: false },
    ])
  })

  it('breaks a tie by the presidency that comes first in turn order (spec D3 test 6)', () => {
    let g = withCash(testGame(), [40, 0])
    // J presides over Tunneling (70). K presides over Express (90), which acts first.
    g = put(g, 'tunneling', { price: 70, president: J, treasury: 3 })
    g = put(g, 'express', { price: 90, president: K, treasury: 3 })
    expect(playerTotal(g, J)).toBe(180)
    expect(playerTotal(g, K)).toBe(180)
    expect(ranking(g)).toEqual([
      { playerId: K, total: 180, rank: 1, tieBreakApplied: true },
      { playerId: J, total: 180, rank: 2, tieBreakApplied: true },
    ])
    expect(tieNotes(g)).toEqual([
      'K and J tie at 180. K ranks higher: K is president of Express, which acts before Tunneling, where J is president.',
    ])
  })

  it('uses queue order when both presidencies are at the same price', () => {
    let g = testGame()
    g = put(g, 'tunneling', { price: 80, president: K, treasury: 3 })
    g = put(g, 'express', { price: 80, president: J, treasury: 3 })
    expect(ranking(g).map((r) => r.playerId)).toEqual([K, J])
  })

  it('leaves players tied when neither presides over a company', () => {
    const g = withCash(testGame(['J', 'K', 'L']), [100, 50, 100])
    expect(ranking(g)).toEqual([
      { playerId: J, total: 100, rank: 1, tieBreakApplied: false },
      { playerId: L, total: 100, rank: 1, tieBreakApplied: false },
      { playerId: K, total: 50, rank: 3, tieBreakApplied: false },
    ])
    expect(tieNotes(g)).toEqual(['J and L tie at 100. Neither is president of a company, so they stay tied.'])
  })

  it('ranks a president above a tied player with no presidency', () => {
    let g = withCash(testGame(), [0, 160])
    g = put(g, 'express', { price: 80, president: J, treasury: 3 })
    expect(ranking(g).map((r) => [r.playerId, r.rank])).toEqual([[J, 1], [K, 2]])
    expect(tieNotes(g)).toEqual([
      'J and K tie at 160. J ranks higher: J is president of Express, and K is president of no company.',
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/scoring.test.ts`
Expected: FAIL, `./scoring` cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/domain/scoring.ts`** (full file)
```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/scoring.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/scoring.ts src/domain/scoring.test.ts
git commit -m "feat: add turn order, player totals and ranking with tie-break"
```

---

### Task 6: Presidency transfer and merge

**Files:**
- Create: `src/domain/presidency.ts`, `src/domain/merge.ts`
- Test: `src/domain/presidency.test.ts`, `src/domain/merge.test.ts`

**Interfaces:**
- Consumes: `shares` from `shares.ts`; `turnOrder` from `scoring.ts`; `TRACK`, `priceOf`, `snapDown` from `track.ts`; `COMPANIES` from `companies.ts`.
- Produces:
  - `presidencyCandidate(game, id): PlayerId | null`.
  - `transferPresidency(game, id, to): Game`.
  - `activeMinors(game): CompanyId[]` (turn order), `unstartedMajors(game): CompanyId[]`, `canMerge(game): boolean`.
  - `MergePlan`:
    ```ts
    interface MergePlan {
      aId: CompanyId; bId: CompanyId; mId: CompanyId
      identity: number                     // name index for the major
      shares: Record<PlayerId, number>     // combined shares in A and B, president cards count 2
      newPresident: PlayerId | null        // null while needsChoice is true
      needsChoice: boolean
      tiedPlayers: PlayerId[]              // players tied for most shares (one entry when there is no tie)
      reason: 'most-shares' | 'tie-break' | 'chosen' | 'needs-choice'
      decidingCompany: CompanyId | null    // the minor whose president won a tie-break
      holdings: Record<PlayerId, number>   // regular cards in the major
      treasuryShares: number
      marketShares: number
      total: number                        // all shares of the major; 10 when the inputs were sound
      price: number
    }
    ```
  - `mergePlan(game, aId, bId, mId, opts?: { identity?: number; president?: PlayerId }): MergePlan`. Pure.
  - `applyMerge(game, plan): Game`. Throws if `plan.newPresident` is `null`.

- [ ] **Step 1: Write the failing tests**

**`src/domain/presidency.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { presidencyCandidate, transferPresidency } from './presidency'
import { shares } from './shares'
import { playerTotal } from './scoring'
import { put, testGame } from './fixtures'

const [J, K, L] = ['p1', 'p2', 'p3']

describe('presidencyCandidate', () => {
  it('returns the player with strictly more shares than the president (spec D3 test 9)', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 3 } })
    expect(presidencyCandidate(g, 'express')).toBe(K)
  })

  it('returns null when the president has the most or ties for the most', () => {
    const tie = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 2 }, treasury: 1 })
    expect(presidencyCandidate(tie, 'express')).toBeNull()
    const lead = put(testGame(), 'express', { price: 80, president: J, holdings: { [J]: 1, [K]: 2 } })
    expect(presidencyCandidate(lead, 'express')).toBeNull()
  })

  it('returns null when there is no president', () => {
    const g = put(testGame(), 'express', { price: 80, holdings: { [K]: 3 } })
    expect(presidencyCandidate(g, 'express')).toBeNull()
  })

  it('picks the next tied player clockwise from the old president', () => {
    const fromJ = put(testGame(['J', 'K', 'L']), 'union', { price: 100, president: J, holdings: { [K]: 3, [L]: 3 }, treasury: 2 })
    expect(presidencyCandidate(fromJ, 'union')).toBe(K)
    const fromK = put(testGame(['J', 'K', 'L']), 'union', { price: 100, president: K, holdings: { [J]: 3, [L]: 3 }, treasury: 2 })
    expect(presidencyCandidate(fromK, 'union')).toBe(L)
  })
})

describe('transferPresidency', () => {
  it('swaps the president card for 2 regular cards and keeps every total', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 3 } })
    const after = transferPresidency(g, 'express', K)
    expect(after.companies.express.president).toBe(K)
    expect(after.companies.express.holdings).toEqual({ [J]: 2, [K]: 1 })
    expect(shares(after.companies.express, J)).toBe(2)
    expect(shares(after.companies.express, K)).toBe(3)
    expect(playerTotal(after, J)).toBe(playerTotal(g, J))
    expect(playerTotal(after, K)).toBe(playerTotal(g, K))
    expect(g.companies.express.president).toBe(J)
  })

  it('rejects a new president with fewer than 2 regular cards', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 1 }, treasury: 2 })
    expect(() => transferPresidency(g, 'express', K)).toThrow()
  })
})
```

**`src/domain/merge.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { activeMinors, applyMerge, canMerge, mergePlan, unstartedMajors } from './merge'
import { validate } from './shares'
import { priceOf } from './track'
import { put, testGame } from './fixtures'

const [J, K] = ['p1', 'p2']

/** Spec D3 test 7. A is Tunneling at 70, B is Express at 80. */
function test7() {
  let g = put(testGame(), 'tunneling', { price: 70, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
  g = put(g, 'express', { price: 80, president: K, holdings: { [J]: 1, [K]: 1 }, treasury: 1 })
  return g
}

describe('mergePlan', () => {
  it('converts shares 1 to 1 and gives the presidency to the largest holder (spec D3 test 7)', () => {
    const plan = mergePlan(test7(), 'tunneling', 'express', 'union')
    expect(plan.shares).toEqual({ [J]: 3, [K]: 4 })
    expect(plan.newPresident).toBe(K)
    expect(plan.needsChoice).toBe(false)
    expect(plan.reason).toBe('most-shares')
    expect(plan.holdings).toEqual({ [J]: 3, [K]: 2 })
    expect(plan.treasuryShares).toBe(2)
    expect(plan.marketShares).toBe(1)
    expect(plan.total).toBe(10)
    expect(plan.price).toBe(70)
  })

  it('breaks a tie with the president of the minor that acts first (spec D3 test 8)', () => {
    const [H, A, Jo, Ja] = ['p1', 'p2', 'p3', 'p4']
    let g = testGame(['H', 'A', 'Jo', 'Ja'])
    g = put(g, 'tunneling', { price: 90, president: Ja, holdings: { [A]: 1 }, treasury: 1, market: 1 })
    g = put(g, 'agricultural', { price: 70, president: A, holdings: { [Ja]: 1 }, market: 2 })
    const plan = mergePlan(g, 'agricultural', 'tunneling', 'federation')
    expect(plan.tiedPlayers).toEqual([A, Ja])
    expect(plan.newPresident).toBe(Ja)
    expect(plan.reason).toBe('tie-break')
    expect(plan.decidingCompany).toBe('tunneling')
    expect(plan.holdings).toEqual({ [A]: 3, [Ja]: 1 })
    expect(plan.price).toBe(80)
    expect(plan.total).toBe(10)
    expect(H).toBe('p1')
    expect(Jo).toBe('p3')
  })

  it('uses queue order for the tie-break when both minors are at one price', () => {
    let g = put(testGame(), 'express', { price: 80, president: K, treasury: 3 })
    g = put(g, 'tunneling', { price: 80, president: J, treasury: 3 })
    expect(mergePlan(g, 'tunneling', 'express', 'union').newPresident).toBe(K)
  })

  it('needs a choice when the tied players preside over neither minor (spec D3 test 8)', () => {
    const [H, A, Jo, Ja] = ['p1', 'p2', 'p3', 'p4']
    let g = testGame(['H', 'A', 'Jo', 'Ja'])
    g = put(g, 'resourceful', { price: 60, president: H, holdings: { [Jo]: 3 } })
    g = put(g, 'express', { price: 110, president: A, holdings: { [Ja]: 3 } })
    const open = mergePlan(g, 'resourceful', 'express', 'federation')
    expect(open.needsChoice).toBe(true)
    expect(open.newPresident).toBeNull()
    expect(open.reason).toBe('needs-choice')
    expect(open.tiedPlayers).toEqual([Jo, Ja])
    expect(open.price).toBe(80)
    expect(open.total).toBe(10)
    expect(() => applyMerge(g, open)).toThrow()

    const chosen = mergePlan(g, 'resourceful', 'express', 'federation', { president: Ja })
    expect(chosen.needsChoice).toBe(false)
    expect(chosen.reason).toBe('chosen')
    expect(chosen.newPresident).toBe(Ja)
    expect(chosen.holdings).toEqual({ [H]: 2, [A]: 2, [Jo]: 3, [Ja]: 1 })
    expect(chosen.total).toBe(10)

    const notTied = mergePlan(g, 'resourceful', 'express', 'federation', { president: H })
    expect(notTied.needsChoice).toBe(true)
  })

  it('rejects the wrong kinds of company', () => {
    const g = test7()
    expect(() => mergePlan(g, 'tunneling', 'tunneling', 'union')).toThrow()
    expect(() => mergePlan(g, 'tunneling', 'suburban', 'union')).toThrow()
    expect(() => mergePlan(g, 'tunneling', 'express', 'suburban')).toThrow()
    const started = applyMerge(g, mergePlan(g, 'tunneling', 'express', 'union'))
    expect(() => mergePlan(started, 'tunneling', 'express', 'union')).toThrow()
  })

  // Review Focus 5: share counts broken in edit mode.
  it('never produces a negative share count, and reports a total that is not 10', () => {
    let g = put(testGame(), 'tunneling', { price: 70, treasury: 5 })
    g = put(g, 'express', { price: 80, treasury: 5 })
    const open = mergePlan(g, 'tunneling', 'express', 'union')
    expect(open.needsChoice).toBe(true)
    const plan = mergePlan(g, 'tunneling', 'express', 'union', { president: J })
    expect(Object.values(plan.holdings).every((n) => n >= 0)).toBe(true)
    expect(plan.total).toBe(12)
    const merged = applyMerge(g, plan)
    expect(validate(merged).map((w) => w.code)).toEqual(['share-sum'])
  })
})

describe('applyMerge', () => {
  it('starts the major at the back of its queue and retires both minors', () => {
    let g = test7()
    g = put(g, 'suburban', { price: 70, president: J, treasury: 3 })
    const merged = applyMerge(g, mergePlan(g, 'tunneling', 'express', 'union', { identity: 0 }))
    expect(merged.companies.union).toEqual({
      id: 'union',
      status: 'active',
      president: K,
      holdings: { [J]: 3, [K]: 2 },
      treasuryShares: 2,
      marketShares: 1,
      identity: 0,
    })
    expect(merged.track[7]).toEqual(['suburban', 'union'])
    expect(priceOf(merged, 'tunneling')).toBeNull()
    expect(merged.companies.tunneling.status).toBe('merged')
    expect(merged.companies.express.status).toBe('merged')
    expect(merged.companies.express.holdings).toEqual({})
    expect(validate(merged)).toEqual([])
    expect(g.companies.union.status).toBe('unstarted')
  })

  it('stores the chosen name of the major', () => {
    const g = test7()
    const merged = applyMerge(g, mergePlan(g, 'tunneling', 'express', 'system', { identity: 1 }))
    expect(merged.companies.system.identity).toBe(1)
  })
})

describe('merge availability', () => {
  it('needs 2 active minors and 1 unstarted major', () => {
    expect(canMerge(testGame())).toBe(false)
    expect(canMerge(put(testGame(), 'express', { price: 80 }))).toBe(false)
    const g = test7()
    expect(canMerge(g)).toBe(true)
    expect(activeMinors(g)).toEqual(['express', 'tunneling'])
    expect(unstartedMajors(g)).toHaveLength(6)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/presidency.test.ts src/domain/merge.test.ts`
Expected: FAIL, `./presidency` and `./merge` cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/domain/presidency.ts`** (full file)
```ts
import { shares } from './shares'
import type { CompanyId, Game, PlayerId } from './types'

/**
 * The player who should take the presidency, or null.
 * The presidency moves only when another player holds strictly more shares than the president.
 * If several players tie for the most, it goes to the next of them clockwise from the president.
 */
export function presidencyCandidate(game: Game, id: CompanyId): PlayerId | null {
  const company = game.companies[id]
  const seat = game.players.findIndex((p) => p.id === company.president)
  if (seat === -1) return null
  const held = game.players.map((p) => shares(company, p.id))
  const most = Math.max(...held)
  if (held[seat] >= most) return null
  for (let step = 1; step < game.players.length; step++) {
    const i = (seat + step) % game.players.length
    if (held[i] === most) return game.players[i].id
  }
  return null
}

/** The new president gives 2 regular cards to the old president and takes the president card. */
export function transferPresidency(game: Game, id: CompanyId, to: PlayerId): Game {
  const company = game.companies[id]
  const from = company.president
  if (from === null) throw new Error(`${id} has no president`)
  if (from === to) return game
  const regular = company.holdings[to] ?? 0
  if (regular < 2) throw new Error('The new president needs 2 regular shares to exchange')
  return {
    ...game,
    companies: {
      ...game.companies,
      [id]: {
        ...company,
        president: to,
        holdings: { ...company.holdings, [to]: regular - 2, [from]: (company.holdings[from] ?? 0) + 2 },
      },
    },
  }
}
```

**`src/domain/merge.ts`** (full file)
```ts
import { COMPANIES, MAJOR_IDS } from './companies'
import { turnOrder } from './scoring'
import { shares } from './shares'
import { TRACK, priceOf, snapDown } from './track'
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
  const retired = (id: CompanyId) =>
    ({ id, status: 'merged', president: null, holdings: {}, treasuryShares: 0, marketShares: 0 }) as const
  return {
    ...game,
    companies: {
      ...game.companies,
      [plan.aId]: retired(plan.aId),
      [plan.bId]: retired(plan.bId),
      [plan.mId]: {
        id: plan.mId,
        status: 'active',
        president: plan.newPresident,
        holdings: { ...plan.holdings },
        treasuryShares: plan.treasuryShares,
        marketShares: plan.marketShares,
        identity: plan.identity,
      },
    },
    track: game.track.map((queue, i) => {
      const rest = queue.filter((id) => id !== plan.aId && id !== plan.bId)
      return i === index ? [...rest, plan.mId] : rest
    }),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domain/presidency.test.ts src/domain/merge.test.ts`
Expected: PASS, 2 files, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add presidency transfer and minor-to-major merge"
```

---

### Task 7: Player codes

**Files:**
- Create: `src/domain/playerCodes.ts`
- Test: `src/domain/playerCodes.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `playerCodes(names: string[]): string[]`, one unique, non-empty code per name, in the same order.
  - `codeProblems(codes: string[]): (string | null)[]`, an error message for each code that is empty or a duplicate (ignoring case), else `null`.

- [ ] **Step 1: Write the failing test**

**`src/domain/playerCodes.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { codeProblems, playerCodes } from './playerCodes'

const unique = (codes: string[]) => new Set(codes.map((c) => c.toLowerCase())).size === codes.length

describe('playerCodes (spec D3 test 11)', () => {
  it('uses the first letter when there is no clash', () => {
    expect(playerCodes(['Haoran', 'Ari', 'John'])).toEqual(['H', 'A', 'J'])
  })

  it('extends clashing names to the shortest unique prefix', () => {
    expect(playerCodes(['John', 'James'])).toEqual(['Jo', 'Ja'])
    expect(playerCodes(['Haoran', 'Ari', 'John', 'James'])).toEqual(['H', 'A', 'Jo', 'Ja'])
  })

  it('handles a name that is a prefix of another', () => {
    expect(playerCodes(['Jo', 'John'])).toEqual(['Jo', 'Joh'])
  })

  it('appends a digit to identical names', () => {
    expect(playerCodes(['John', 'John'])).toEqual(['John1', 'John2'])
  })

  it('uppercases the first letter', () => {
    expect(playerCodes(['haoran', 'ari'])).toEqual(['H', 'A'])
  })
})

// Review Focus 2.
describe('playerCodes with awkward names', () => {
  it('treats names that differ only by case as identical', () => {
    expect(playerCodes(['john', 'JOHN'])).toEqual(['John1', 'John2'])
  })

  it('gives an empty or blank name a placeholder code', () => {
    const codes = playerCodes(['', '   ', 'Ari'])
    expect(codes).toEqual(['P1', 'P2', 'A'])
  })

  it('ignores surrounding spaces', () => {
    expect(playerCodes(['  John ', 'James'])).toEqual(['Jo', 'Ja'])
  })

  it('keeps an emoji or a digit as a whole first character', () => {
    expect(playerCodes(['😀 Sam', '7of9'])).toEqual(['😀', '7'])
  })

  it('stays unique and non-empty for any mix', () => {
    const cases = [
      ['John', 'John', 'James', 'Jo', 'J'],
      ['P2', '', 'P1', ''],
      ['John1', 'John', 'John'],
      ['A', 'a', 'Ab', 'AB', 'abc'],
      ['', '', '', '', ''],
    ]
    for (const names of cases) {
      const codes = playerCodes(names)
      expect(codes, names.join('|')).toHaveLength(names.length)
      expect(codes.every((c) => c.length > 0), names.join('|')).toBe(true)
      expect(unique(codes), `${names.join('|')} -> ${codes.join('|')}`).toBe(true)
    }
  })
})

describe('codeProblems', () => {
  it('flags empty and duplicate codes, ignoring case', () => {
    expect(codeProblems(['H', 'A', 'Jo'])).toEqual([null, null, null])
    expect(codeProblems(['H', ' ', 'h'])).toEqual([
      'This code is already used',
      'Enter a code',
      'This code is already used',
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/playerCodes.test.ts`
Expected: FAIL, `./playerCodes` cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/domain/playerCodes.ts`** (full file)
```ts
/** Splits by code point, so an emoji is one character. */
const chars = (s: string) => Array.from(s)

/** First character uppercase, the rest lowercase. */
function capitalise(s: string): string {
  const c = chars(s)
  return c.length === 0 ? '' : c[0].toUpperCase() + c.slice(1).join('').toLowerCase()
}

/**
 * One short code per player name.
 * - No clash: the first letter, uppercase.
 * - Names that share a first letter: every one of them is extended to the shortest
 *   prefix length that makes them all different (John, James -> Jo, Ja; Jo, John -> Jo, Joh).
 * - Identical names: the full name plus a digit (John1, John2).
 * - Empty name: P plus the seat number.
 */
export function playerCodes(names: string[]): string[] {
  const clean = names.map((n) => n.trim())
  const keys = clean.map((n) => n.toLowerCase())
  const codes = clean.map((n, i) => (n === '' ? `P${i + 1}` : ''))

  const occurrences = new Map<string, number>()
  for (const k of keys) occurrences.set(k, (occurrences.get(k) ?? 0) + 1)
  const seen = new Map<string, number>()
  clean.forEach((name, i) => {
    if (name === '' || occurrences.get(keys[i]) === 1) return
    const n = (seen.get(keys[i]) ?? 0) + 1
    seen.set(keys[i], n)
    codes[i] = capitalise(name) + n
  })

  const groups = new Map<string, number[]>()
  clean.forEach((_, i) => {
    if (codes[i] !== '') return
    const first = chars(keys[i])[0]
    groups.set(first, [...(groups.get(first) ?? []), i])
  })
  for (const members of groups.values()) {
    let length = 1
    const prefix = (i: number) => capitalise(chars(clean[i]).slice(0, length).join(''))
    const longest = Math.max(...members.map((i) => chars(clean[i]).length))
    while (length < longest && new Set(members.map(prefix)).size < members.length) length++
    for (const i of members) codes[i] = prefix(i)
  }

  // Last pass: a generated code can still collide with another one (a player named "John1").
  const used = new Set<string>()
  return codes.map((code) => {
    let out = code
    for (let n = 2; used.has(out.toLowerCase()); n++) out = `${code}${n}`
    used.add(out.toLowerCase())
    return out
  })
}

/** A message for each code that is empty or used twice (ignoring case), else null. */
export function codeProblems(codes: string[]): (string | null)[] {
  const keys = codes.map((c) => c.trim().toLowerCase())
  return keys.map((key, i) => {
    if (key === '') return 'Enter a code'
    return keys.some((other, j) => j !== i && other === key) ? 'This code is already used' : null
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/playerCodes.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/playerCodes.ts src/domain/playerCodes.test.ts
git commit -m "feat: add player code generation"
```

---

### Task 8: Saved games, export and import

**Files:**
- Create: `src/state/saves.ts`, `src/state/memoryStorage.ts`
- Test: `src/state/saves.test.ts`

**Interfaces:**
- Consumes: `Game` from `types.ts`; `COMPANY_IDS` from `companies.ts`; `newId` from `setup.ts`.
- Produces:
  - `SCHEMA_VERSION = 1`.
  - `SavedGame { schemaVersion: 1; game: Game; undo: Game[]; redo: Game[] }`. `undo[0]` is the most recent undo step.
  - `SaveIndexEntry { id: string; name: string; updatedAt: string; playerNames: string[] }`.
  - `ImportError extends Error`.
  - `checkGame(value: unknown): string | null` returns the name of the first missing or invalid field, or `null`.
  - `exportGame(game: Game): string`, `exportFileName(game: Game): string`, `importGame(text: string, existingIds: string[]): Game` (throws `ImportError`).
  - `createSaves(storage?: Storage)` returns `{ index, read, write, remove, duplicate, rename, importText, getCurrent, setCurrent }`:
    - `index: Ref<SaveIndexEntry[]>`, most recently saved first.
    - `read(id): SavedGame | null` (null for a missing or corrupt entry).
    - `write(save: SavedGame): { ok: boolean; kept: number }`. When storage is full it drops the oldest undo steps and retries. `kept` is the number of undo steps saved.
    - `remove(id): void`, `duplicate(id): string | null` (new id), `rename(id, name): void`.
    - `importText(text): Game` (throws `ImportError`).
    - `getCurrent(): string | null`, `setCurrent(id: string | null): void`.
  - `type Saves = ReturnType<typeof createSaves>`, `useSaves(): Saves` (one shared instance on `localStorage`).
  - `memoryStorage(quota?: number): Storage` for tests. It throws on `setItem` when the stored characters would exceed `quota`.

- [ ] **Step 1: Write the test storage**

**`src/state/memoryStorage.ts`** (full file)
```ts
/** An in-memory Storage for tests. `quota` is the most characters it holds across all values. */
export function memoryStorage(quota = Infinity): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem(key, value) {
      let used = value.length
      for (const [k, v] of map) if (k !== key) used += v.length
      if (used > quota) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      map.set(key, value)
    },
  }
}
```

- [ ] **Step 2: Write the failing test**

**`src/state/saves.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { ImportError, checkGame, createSaves, exportFileName, exportGame, importGame } from './saves'
import { memoryStorage } from './memoryStorage'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

function sample(id = 'g1', name = 'Friday game'): Game {
  const g = put(testGame(['Haoran', 'Ari']), 'express', { price: 80, president: 'p1', treasury: 3 })
  return { ...g, id, name }
}

const save = (game: Game, undo: Game[] = [], redo: Game[] = []) => ({ schemaVersion: 1 as const, game, undo, redo })

describe('export and import (spec D3 test 14)', () => {
  it('returns an equal game', () => {
    const g = sample()
    expect(importGame(exportGame(g), [])).toEqual(g)
  })

  it('wraps the game with its schema version', () => {
    expect(JSON.parse(exportGame(sample()))).toEqual({ schemaVersion: 1, game: sample() })
  })

  it('assigns a new id when the id already exists', () => {
    const g = sample('g1')
    const imported = importGame(exportGame(g), ['g1'])
    expect(imported.id).not.toBe('g1')
    expect({ ...imported, id: 'g1' }).toEqual(g)
  })

  it('rejects an unknown schema version with a clear message', () => {
    const text = JSON.stringify({ schemaVersion: 2, game: sample() })
    expect(() => importGame(text, [])).toThrow(ImportError)
    expect(() => importGame(text, [])).toThrow('version 2')
  })

  it('names the export file after the game', () => {
    expect(exportFileName(sample('g1', 'Friday game!'))).toBe('friday-game.lost-atlas.json')
    expect(exportFileName(sample('g1', '???'))).toBe('game.lost-atlas.json')
  })
})

// Review Focus 3.
describe('import of a bad file', () => {
  it('rejects text that is not JSON', () => {
    expect(() => importGame('not json at all', [])).toThrow('not valid JSON')
  })

  it('rejects JSON that is not an export', () => {
    expect(() => importGame('{"foo":1}', [])).toThrow(ImportError)
    expect(() => importGame('[1,2,3]', [])).toThrow(ImportError)
    expect(() => importGame('null', [])).toThrow(ImportError)
  })

  it('names the missing field of a hand-edited export', () => {
    const data = JSON.parse(exportGame(sample()))
    delete data.game.players
    expect(() => importGame(JSON.stringify(data), [])).toThrow('players')
  })

  it('leaves saved games unchanged', () => {
    const saves = createSaves(memoryStorage())
    saves.write(save(sample()))
    expect(() => saves.importText('{"schemaVersion":1,"game":{}}')).toThrow(ImportError)
    expect(saves.index.value).toHaveLength(1)
    expect(saves.read('g1')?.game).toEqual(sample())
  })
})

describe('checkGame', () => {
  it('accepts a sound game', () => {
    expect(checkGame(sample())).toBeNull()
  })

  it('reports the first bad field', () => {
    const base = sample()
    expect(checkGame({ ...base, name: 5 })).toBe('name')
    expect(checkGame({ ...base, track: base.track.slice(1) })).toBe('track')
    expect(checkGame({ ...base, players: [base.players[0]] })).toBe('players')
    expect(checkGame({ ...base, settings: { ...base.settings, phase: 'blue' } })).toBe('settings.phase')
    const cash = { ...base, players: [{ ...base.players[0], cash: 'lots' }, base.players[1]] }
    expect(checkGame(cash)).toBe('players')
    const ghost = { ...base, companies: { ...base.companies, express: { ...base.companies.express, president: 'p9' } } }
    expect(checkGame(ghost)).toBe('companies.express')
    const offTrack = { ...base, track: base.track.map(() => []) }
    expect(checkGame(offTrack)).toBe('companies.express.status')
  })
})

describe('saved games', () => {
  it('writes and reads a game with its history', () => {
    const saves = createSaves(memoryStorage())
    const g = sample()
    expect(saves.write(save(g, [testGame()], []))).toEqual({ ok: true, kept: 1 })
    expect(saves.read('g1')).toEqual(save(g, [testGame()], []))
  })

  it('keeps an index with the most recent save first', () => {
    const saves = createSaves(memoryStorage())
    saves.write(save(sample('g1', 'One')))
    saves.write(save(sample('g2', 'Two')))
    saves.write(save(sample('g1', 'One again')))
    expect(saves.index.value.map((e) => [e.id, e.name])).toEqual([['g1', 'One again'], ['g2', 'Two']])
    expect(saves.index.value[0].playerNames).toEqual(['Haoran', 'Ari'])
  })

  it('shares the index between instances on one storage', () => {
    const storage = memoryStorage()
    createSaves(storage).write(save(sample()))
    expect(createSaves(storage).index.value).toHaveLength(1)
  })

  it('renames, duplicates and removes', () => {
    const saves = createSaves(memoryStorage())
    saves.write(save(sample('g1', 'One'), [testGame()]))
    saves.rename('g1', 'Uno')
    expect(saves.read('g1')?.game.name).toBe('Uno')
    expect(saves.read('g1')?.undo).toHaveLength(1)

    const copyId = saves.duplicate('g1')
    expect(copyId).not.toBeNull()
    expect(copyId).not.toBe('g1')
    expect(saves.read(copyId!)?.game.name).toBe('Uno copy')
    expect(saves.index.value).toHaveLength(2)

    saves.setCurrent('g1')
    saves.remove('g1')
    expect(saves.read('g1')).toBeNull()
    expect(saves.index.value.map((e) => e.id)).toEqual([copyId])
    expect(saves.getCurrent()).toBeNull()
  })

  it('remembers the current game', () => {
    const storage = memoryStorage()
    createSaves(storage).setCurrent('g7')
    expect(createSaves(storage).getCurrent()).toBe('g7')
  })

  it('imports a file as a new saved game', () => {
    const saves = createSaves(memoryStorage())
    saves.write(save(sample('g1', 'One')))
    const imported = saves.importText(exportGame(sample('g1', 'One')))
    expect(imported.id).not.toBe('g1')
    expect(saves.index.value).toHaveLength(2)
  })
})

// Review Focus 4.
describe('storage problems', () => {
  it('drops the oldest undo steps when storage is full', () => {
    const g = sample()
    const one = JSON.stringify(g).length
    const saves = createSaves(memoryStorage(one * 12))
    const undo = Array.from({ length: 40 }, (_, i) => ({ ...g, name: `step ${i}` }))
    const result = saves.write(save(g, undo))
    expect(result.ok).toBe(true)
    expect(result.kept).toBeGreaterThan(0)
    expect(result.kept).toBeLessThan(40)
    const back = saves.read('g1')!
    expect(back.game).toEqual(g)
    expect(back.undo).toHaveLength(result.kept)
    expect(back.undo[0].name).toBe('step 0')
  })

  it('reports failure when even the game alone does not fit', () => {
    const saves = createSaves(memoryStorage(100))
    expect(saves.write(save(sample(), [testGame()]))).toEqual({ ok: false, kept: 0 })
    expect(saves.read('g1')).toBeNull()
  })

  it('skips a corrupt entry', () => {
    const storage = memoryStorage()
    const saves = createSaves(storage)
    saves.write(save(sample()))
    storage.setItem('lostAtlas.game.g1', '{broken')
    expect(saves.read('g1')).toBeNull()
    storage.setItem('lostAtlas.game.g1', JSON.stringify({ schemaVersion: 1, game: { id: 'g1' } }))
    expect(saves.read('g1')).toBeNull()
    expect(saves.duplicate('g1')).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/state/saves.test.ts`
Expected: FAIL, `./saves` cannot be resolved.

- [ ] **Step 4: Write the implementation**

**`src/state/saves.ts`** (full file)
```ts
import { useStorage } from '@vueuse/core'
import { COMPANY_IDS } from '../domain/companies'
import { newId } from '../domain/setup'
import type { Game } from '../domain/types'

export const SCHEMA_VERSION = 1

/** A game as stored. `undo[0]` is the most recent undo step. */
export interface SavedGame {
  schemaVersion: 1
  game: Game
  undo: Game[]
  redo: Game[]
}

export interface SaveIndexEntry {
  id: string
  name: string
  updatedAt: string
  playerNames: string[]
}

export class ImportError extends Error {}

const INDEX_KEY = 'lostAtlas.index'
const CURRENT_KEY = 'lostAtlas.current'
const gameKey = (id: string) => `lostAtlas.game.${id}`

/**
 * Migration hook. MIGRATIONS[n] turns a version n game into a version n + 1 game.
 * Empty while the schema is at version 1.
 */
const MIGRATIONS: Record<number, (game: unknown) => unknown> = {}

function migrate(schemaVersion: unknown, game: unknown): unknown {
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new ImportError('This file is not a Lost Atlas Tracker export.')
  }
  if (schemaVersion > SCHEMA_VERSION) {
    throw new ImportError(
      `This file uses save format version ${schemaVersion}. This app reads up to version ${SCHEMA_VERSION}. Update the app and try again.`,
    )
  }
  let current = game
  for (let v = schemaVersion; v < SCHEMA_VERSION; v++) current = MIGRATIONS[v](current)
  return current
}

const PHASES = ['yellow', 'green', 'purple']
const VIEWS = ['track', 'ownership', 'scoreboard', 'dividend']
const STATUSES = ['unavailable', 'unstarted', 'active', 'merged', 'closed']

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Checks the shape of a game. Returns the first missing or invalid field, or null. */
export function checkGame(g: unknown): string | null {
  if (!isObject(g)) return 'game'
  for (const key of ['id', 'name', 'createdAt']) if (typeof g[key] !== 'string') return key

  const settings = g.settings
  if (!isObject(settings) || typeof settings.shortGame !== 'boolean') return 'settings.shortGame'
  if (!PHASES.includes(settings.phase as string)) return 'settings.phase'
  if (!VIEWS.includes(settings.mainView as string)) return 'settings.mainView'

  const players = g.players
  if (!Array.isArray(players) || players.length < 2 || players.length > 5) return 'players'
  const playerIds = new Set<string>()
  for (const p of players) {
    if (!isObject(p) || typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.code !== 'string') return 'players'
    if (!isNumber(p.cash) || playerIds.has(p.id)) return 'players'
    playerIds.add(p.id)
  }

  const companies = g.companies
  if (!isObject(companies)) return 'companies'
  for (const id of COMPANY_IDS) {
    const c = companies[id]
    if (!isObject(c) || !STATUSES.includes(c.status as string)) return `companies.${id}`
    if (!(c.president === null || (typeof c.president === 'string' && playerIds.has(c.president)))) return `companies.${id}`
    if (!isObject(c.holdings) || !Object.values(c.holdings).every(isNumber)) return `companies.${id}`
    if (!isNumber(c.treasuryShares) || !isNumber(c.marketShares)) return `companies.${id}`
  }

  const track = g.track
  if (!Array.isArray(track) || track.length !== 27) return 'track'
  const onTrack = new Set<string>()
  for (const queue of track) {
    if (!Array.isArray(queue)) return 'track'
    for (const id of queue) {
      if (typeof id !== 'string' || !COMPANY_IDS.includes(id) || onTrack.has(id)) return 'track'
      onTrack.add(id)
    }
  }
  for (const id of COMPANY_IDS) {
    const active = (companies[id] as Record<string, unknown>).status === 'active'
    if (active !== onTrack.has(id)) return `companies.${id}.status`
  }
  return null
}

/** The text of an export file: `{ schemaVersion, game }`. */
export function exportGame(game: Game): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, game }, null, 2)
}

export function exportFileName(game: Game): string {
  const slug = game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'game'}.lost-atlas.json`
}

/** Parses an export file. Throws ImportError with a message for the user. */
export function importGame(text: string, existingIds: string[]): Game {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('This file is not valid JSON.')
  }
  if (!isObject(data) || !('schemaVersion' in data) || !('game' in data)) {
    throw new ImportError('This file is not a Lost Atlas Tracker export.')
  }
  const migrated = migrate(data.schemaVersion, data.game)
  const problem = checkGame(migrated)
  if (problem !== null) throw new ImportError(`This file has a missing or invalid field: ${problem}.`)
  const game = migrated as Game
  return existingIds.includes(game.id) ? { ...game, id: newId() } : game
}

export function createSaves(storage: Storage = localStorage) {
  const index = useStorage<SaveIndexEntry[]>(INDEX_KEY, [], storage, {
    flush: 'sync',
    listenToStorageChanges: false,
    writeDefaults: false,
  })

  function touch(game: Game) {
    const entry: SaveIndexEntry = {
      id: game.id,
      name: game.name,
      updatedAt: new Date().toISOString(),
      playerNames: game.players.map((p) => p.name),
    }
    index.value = [entry, ...index.value.filter((e) => e.id !== game.id)]
  }

  /** Null for a missing entry and for one that cannot be read. */
  function read(id: string): SavedGame | null {
    try {
      const raw = storage.getItem(gameKey(id))
      if (raw === null) return null
      const data: unknown = JSON.parse(raw)
      if (!isObject(data)) return null
      const game = migrate(data.schemaVersion, data.game)
      if (checkGame(game) !== null) return null
      // History from an older schema version is dropped, not migrated.
      const sameVersion = data.schemaVersion === SCHEMA_VERSION
      const list = (v: unknown): Game[] =>
        sameVersion && Array.isArray(v) ? (v.filter((x) => checkGame(x) === null) as Game[]) : []
      return { schemaVersion: 1, game: game as Game, undo: list(data.undo), redo: list(data.redo) }
    } catch {
      return null
    }
  }

  /**
   * Stores a game. When storage is full it drops the redo steps and the oldest half of
   * the undo steps, and tries again. `kept` is the number of undo steps that were stored.
   */
  function write(save: SavedGame): { ok: boolean; kept: number } {
    let undo = save.undo
    let redo = save.redo
    for (;;) {
      try {
        storage.setItem(gameKey(save.game.id), JSON.stringify({ ...save, undo, redo }))
        break
      } catch {
        if (undo.length === 0 && redo.length === 0) return { ok: false, kept: 0 }
        redo = []
        undo = undo.slice(0, Math.floor(undo.length / 2))
      }
    }
    touch(save.game)
    return { ok: true, kept: undo.length }
  }

  function getCurrent(): string | null {
    try {
      return storage.getItem(CURRENT_KEY)
    } catch {
      return null
    }
  }

  function setCurrent(id: string | null) {
    try {
      if (id === null) storage.removeItem(CURRENT_KEY)
      else storage.setItem(CURRENT_KEY, id)
    } catch {
      // The current game is a convenience. Losing it only changes the start screen.
    }
  }

  function remove(id: string) {
    storage.removeItem(gameKey(id))
    index.value = index.value.filter((e) => e.id !== id)
    if (getCurrent() === id) setCurrent(null)
  }

  /** Copies a saved game without its history. Returns the new id, or null on failure. */
  function duplicate(id: string): string | null {
    const source = read(id)
    if (!source) return null
    const game: Game = { ...source.game, id: newId(), name: `${source.game.name} copy`, createdAt: new Date().toISOString() }
    return write({ schemaVersion: 1, game, undo: [], redo: [] }).ok ? game.id : null
  }

  function rename(id: string, name: string) {
    const source = read(id)
    const trimmed = name.trim()
    if (!source || trimmed === '') return
    write({ ...source, game: { ...source.game, name: trimmed } })
  }

  /** Imports an export file as a new saved game. Throws ImportError. */
  function importText(text: string): Game {
    const game = importGame(text, index.value.map((e) => e.id))
    if (!write({ schemaVersion: 1, game, undo: [], redo: [] }).ok) {
      throw new ImportError('Storage is full. Delete a saved game and try again.')
    }
    return game
  }

  return { index, read, write, remove, duplicate, rename, importText, getCurrent, setCurrent }
}

export type Saves = ReturnType<typeof createSaves>

let shared: Saves | undefined

/** The app's saved games, on localStorage. */
export function useSaves(): Saves {
  return (shared ??= createSaves())
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/state/saves.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 6: Commit**

```bash
git add src/state
git commit -m "feat: add saved games with export, import and a migration hook"
```

---

### Task 9: Game store with undo, redo and autosave

**Files:**
- Create: `src/state/game.ts`
- Test: `src/state/game.test.ts`

**Interfaces:**
- Consumes: `createSaves`, `useSaves`, `Saves`, `SavedGame` from `saves.ts`; `memoryStorage`; `Game` from `types.ts`.
- Produces:
  - `createGameStore(saves: Saves)` returns:
    - `game: Ref<Game | null>` (read it; change it only through `commit`).
    - `canUndo: ComputedRef<boolean>`, `canRedo: ComputedRef<boolean>`, `undo(): void`, `redo(): void`.
    - `commit(next: Game): void`. One call is one undo step, and it autosaves. A commit that equals the current game is ignored.
    - `create(game: Game): void` opens a new game with empty history and saves it.
    - `open(save: SavedGame): void` opens a saved game with its history.
    - `resume(): boolean` opens the game that was open last time. False if there is none.
    - `close(): void`.
    - `saveWarning: Ref<string | null>`, set when storage is full. The shell shows it and sets it back to `null`.
  - `type GameStore = ReturnType<typeof createGameStore>`, `useGame(): GameStore` (one shared instance).

- [ ] **Step 1: Write the failing test**

**`src/state/game.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { createGameStore } from './game'
import { createSaves } from './saves'
import { memoryStorage } from './memoryStorage'
import { applyMerge, mergePlan } from '../domain/merge'
import { moveToken } from '../domain/track'
import { setCash } from '../domain/edit'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const [J, K] = ['p1', 'p2']

function twoMinors(): Game {
  let g = put(testGame(), 'tunneling', { price: 70, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
  g = put(g, 'express', { price: 80, president: K, holdings: { [J]: 1, [K]: 1 }, treasury: 1 })
  return g
}

function setup(storage = memoryStorage()) {
  const saves = createSaves(storage)
  return { saves, store: createGameStore(saves), storage }
}

describe('game store', () => {
  it('starts with no game and nothing to undo', () => {
    const { store } = setup()
    expect(store.game.value).toBeNull()
    expect(store.canUndo.value).toBe(false)
    expect(store.canRedo.value).toBe(false)
  })

  it('creates a game with empty history and saves it', () => {
    const { store, saves } = setup()
    store.create(twoMinors())
    expect(store.game.value).toEqual(twoMinors())
    expect(store.canUndo.value).toBe(false)
    expect(saves.read('g1')?.game).toEqual(twoMinors())
    expect(saves.getCurrent()).toBe('g1')
  })

  it('makes one undo step per commit', () => {
    const { store } = setup()
    store.create(twoMinors())
    store.commit(setCash(store.game.value!, J, 10))
    store.commit(setCash(store.game.value!, J, 20))
    store.commit(setCash(store.game.value!, J, 30))
    store.undo()
    expect(store.game.value!.players[0].cash).toBe(20)
    store.undo()
    store.undo()
    expect(store.game.value!.players[0].cash).toBe(0)
    expect(store.canUndo.value).toBe(false)
    expect(store.canRedo.value).toBe(true)
  })

  it('undoes and redoes a merge as one step (spec D3 test 13)', () => {
    const { store } = setup()
    const before = twoMinors()
    store.create(before)
    const merged = applyMerge(before, mergePlan(before, 'tunneling', 'express', 'union'))
    store.commit(merged)
    expect(store.game.value!.companies.union.status).toBe('active')

    store.undo()
    expect(store.game.value).toEqual(before)
    expect(store.game.value!.companies.union.status).toBe('unstarted')
    expect(store.game.value!.companies.tunneling.holdings).toEqual({ [K]: 1 })

    store.redo()
    expect(store.game.value).toEqual(merged)
  })

  it('ignores a commit that changes nothing', () => {
    const { store } = setup()
    store.create(twoMinors())
    store.commit(setCash(store.game.value!, J, 0))
    store.commit(twoMinors())
    expect(store.canUndo.value).toBe(false)
  })

  it('does not let a later change to the committed object leak into the store', () => {
    const { store } = setup()
    const g = twoMinors()
    store.create(g)
    g.players[0].cash = 999
    expect(store.game.value!.players[0].cash).toBe(0)
  })

  it('autosaves every commit, undo and redo', () => {
    const { store, saves } = setup()
    store.create(twoMinors())
    store.commit(setCash(store.game.value!, J, 10))
    expect(saves.read('g1')?.game.players[0].cash).toBe(10)
    expect(saves.read('g1')?.undo).toHaveLength(1)
    store.undo()
    expect(saves.read('g1')?.game.players[0].cash).toBe(0)
    expect(saves.read('g1')?.redo).toHaveLength(1)
  })

  it('restores the game and its history after a restart', () => {
    const storage = memoryStorage()
    const first = setup(storage).store
    first.create(twoMinors())
    first.commit(setCash(first.game.value!, J, 10))
    first.commit(setCash(first.game.value!, J, 20))
    first.undo()

    const second = setup(storage).store
    expect(second.resume()).toBe(true)
    expect(second.game.value!.players[0].cash).toBe(10)
    expect(second.canUndo.value).toBe(true)
    expect(second.canRedo.value).toBe(true)
    second.redo()
    expect(second.game.value!.players[0].cash).toBe(20)
    second.undo()
    second.undo()
    expect(second.game.value!.players[0].cash).toBe(0)
    expect(second.canUndo.value).toBe(false)
  })

  it('has nothing to resume on a first run', () => {
    expect(setup().store.resume()).toBe(false)
  })

  it('caps history at 200 steps', () => {
    const { store } = setup()
    store.create(twoMinors())
    for (let i = 1; i <= 210; i++) store.commit(setCash(store.game.value!, J, i))
    let steps = 0
    while (store.canUndo.value) {
      store.undo()
      steps++
    }
    expect(steps).toBe(200)
    expect(store.game.value!.players[0].cash).toBe(10)
  })

  it('closes the game without deleting the save', () => {
    const { store, saves } = setup()
    store.create(twoMinors())
    store.close()
    expect(store.game.value).toBeNull()
    expect(store.canUndo.value).toBe(false)
    expect(saves.getCurrent()).toBeNull()
    expect(saves.read('g1')).not.toBeNull()
  })

  it('opening a second game does not mix histories', () => {
    const { store, saves } = setup()
    store.create(twoMinors())
    store.commit(setCash(store.game.value!, J, 10))
    store.create({ ...testGame(), id: 'g2' })
    expect(store.canUndo.value).toBe(false)
    store.open(saves.read('g1')!)
    expect(store.game.value!.players[0].cash).toBe(10)
    store.undo()
    expect(store.game.value!.players[0].cash).toBe(0)
  })

  // Review Focus 4.
  it('keeps working and warns when storage fills up', () => {
    const size = JSON.stringify(twoMinors()).length
    const { store } = setup(memoryStorage(size * 6))
    store.create(twoMinors())
    for (let i = 1; i <= 30; i++) {
      const result = moveToken(store.game.value!, 'express', 1)
      if (result.kind === 'moved') store.commit(result.game)
    }
    expect(store.saveWarning.value).toMatch(/Storage is full/)
    expect(store.game.value!.track[26]).toContain('express')
    expect(store.canUndo.value).toBe(true)
  })

  it('warns that the game is not saved when nothing fits', () => {
    const { store } = setup(memoryStorage(50))
    store.create(twoMinors())
    expect(store.saveWarning.value).toMatch(/not being saved/)
    expect(store.game.value).toEqual(twoMinors())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/game.test.ts`
Expected: FAIL, `./game` cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/state/game.ts`** (full file)
```ts
import { ref, watch } from 'vue'
import { useRefHistory } from '@vueuse/core'
import { useSaves, type SavedGame, type Saves } from './saves'
import type { Game } from '../domain/types'

const HISTORY_CAP = 200

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/**
 * The one owner of the current game.
 * Every change goes through `commit`, which assigns a whole new Game in one synchronous
 * step, so each user action is exactly one history entry.
 */
export function createGameStore(saves: Saves) {
  const game = ref<Game | null>(null)
  // flush: 'sync' records each assignment at once, so two commits never merge into one entry.
  const history = useRefHistory(game, { deep: true, capacity: HISTORY_CAP, flush: 'sync' })
  const saveWarning = ref<string | null>(null)
  let quiet = false

  type Record = (typeof history.undoStack.value)[number]
  const snapshots = (stack: Record[]): Game[] => stack.map((r) => r.snapshot).filter((s): s is Game => s !== null)
  const records = (games: Game[]): Record[] => games.map((g) => ({ snapshot: clone(g), timestamp: Date.now() }))

  function persist() {
    const current = game.value
    if (quiet || current === null) return
    const undo = snapshots(history.undoStack.value)
    const result = saves.write({
      schemaVersion: 1,
      game: clone(current),
      undo,
      redo: snapshots(history.redoStack.value),
    })
    if (!result.ok) {
      saveWarning.value = 'Storage is full. This game is not being saved. Export it from the menu to keep it.'
    } else if (result.kept < undo.length) {
      // Storage kept only the newest undo steps. Drop the same steps here so the next save fits.
      history.undoStack.value = history.undoStack.value.slice(0, result.kept)
      history.redoStack.value = []
      saveWarning.value = 'Storage is full. Older undo steps were dropped.'
    }
  }

  // Registered after useRefHistory, so the history stacks are up to date when this runs.
  watch(game, persist, { deep: true, flush: 'sync' })

  function load(next: Game | null, undo: Game[], redo: Game[]) {
    quiet = true
    game.value = next === null ? null : clone(next)
    history.undoStack.value = records(undo)
    history.redoStack.value = records(redo)
    quiet = false
  }

  function commit(next: Game) {
    const copy = clone(next)
    // An input that reports its unchanged value on blur must not add an undo step.
    if (JSON.stringify(copy) === JSON.stringify(game.value)) return
    game.value = copy
  }

  function open(save: SavedGame) {
    load(save.game, save.undo.slice(0, HISTORY_CAP), save.redo)
    saves.setCurrent(save.game.id)
  }

  function create(next: Game) {
    load(next, [], [])
    saves.setCurrent(next.id)
    persist()
  }

  function resume(): boolean {
    const id = saves.getCurrent()
    const save = id === null ? null : saves.read(id)
    if (!save) return false
    open(save)
    return true
  }

  function close() {
    load(null, [], [])
    saves.setCurrent(null)
  }

  return {
    game,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: () => history.undo(),
    redo: () => history.redo(),
    commit,
    create,
    open,
    resume,
    close,
    saveWarning,
  }
}

export type GameStore = ReturnType<typeof createGameStore>

let shared: GameStore | undefined

/** The app's game store. */
export function useGame(): GameStore {
  return (shared ??= createGameStore(useSaves()))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/state/game.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Run the whole suite and the type check**

Run: `npm test`
Expected: all test files pass.

Run: `npm run typecheck`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/state
git commit -m "feat: add game store with undo history and autosave"
```

---
## UI tasks: how to read the boards

Tasks 10 to 18 build the screens. Before each one, open the board named in the task under `docs/design/boards/`. The boards are HTML with inline styles; they load a missing `support.js`, so read them as markup, not in a browser. The sizes, colors and spacing in the CSS below are taken from those boards. Where a board and this plan differ in a visual detail, follow the board.

Rules for every view and dialog:

- A view gets the game as the `game` prop and never changes it. On a user action it calls a domain function and emits `update` with the new `Game`. The shell commits it, which makes one undo step.
- Dialogs use `v-model:visible`.
- Component tests mount with `@vue/test-utils`. `src/test-setup.ts` replaces PrimeVue `Dialog` with a stub that renders its content inline, so a test can find dialog content in `wrapper`.
- Tests find elements by `data-testid`, by `aria-label`, or by text.

---

### Task 10: Notation components

Board: `Components.dc.html`.

**Files:**
- Create: `src/domain/format.ts`
- Create: `src/components/CrownIcon.vue`, `ShareCircle.vue`, `PlayerCode.vue`, `CompanyTag.vue`, `TokenChip.vue`, `EditBanner.vue`, `CountStepper.vue`
- Test: `src/components/notation.test.ts`

**Interfaces:**
- Consumes: `COMPANIES` from `companies.ts`; `Phase` from `types.ts`; `Zone` from `track.ts`.
- Produces:
  - `format.ts`: `ordinal(n: number): string` (`1st`, `2nd`, `11th`), `PHASE_LABEL: Record<Phase, string>`, `ZONE_LABEL: Record<Zone, string>`.
  - `<CrownIcon :size="11" />`.
  - `<ShareCircle kind="share|president|treasury|market" :company-id :code :large :inverted />`. Renders a `span.share` with `data-kind` and an `aria-label`.
  - `<PlayerCode :code :size="28" />`, a dark badge with the player's code.
  - `<CompanyTag :company-id :large />`, the rectangle with the abbreviation.
  - `<TokenChip :company-id :president-code :label :rank :selected />`, a `button.token` with `data-id`. Click is the native `click` event.
  - `<EditBanner @done />`.
  - `<CountStepper :model-value :label @update:model-value />`, a minus and a plus button around a number, never below 0.

- [ ] **Step 1: Write the failing test**

**`src/components/notation.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShareCircle from './ShareCircle.vue'
import CompanyTag from './CompanyTag.vue'
import TokenChip from './TokenChip.vue'
import CountStepper from './CountStepper.vue'
import EditBanner from './EditBanner.vue'
import PlayerCode from './PlayerCode.vue'
import { ordinal } from '../domain/format'

describe('ordinal', () => {
  it('formats positions', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd',
    ])
  })
})

describe('ShareCircle', () => {
  it('shows the holder code on the company color with a readable ink', () => {
    const w = mount(ShareCircle, { props: { kind: 'share', companyId: 'express', code: 'H' } })
    expect(w.text()).toBe('H')
    expect(w.attributes('data-kind')).toBe('share')
    expect(w.attributes('aria-label')).toBe('Share held by H')
    expect(w.attributes('style')).toContain('background: rgb(159, 56, 65)')
    expect(w.attributes('style')).toContain('color: rgb(255, 255, 255)')
    expect(w.find('svg').exists()).toBe(false)
  })

  it('marks the president card with a crown above the code', () => {
    const w = mount(ShareCircle, { props: { kind: 'president', companyId: 'express', code: 'H' } })
    expect(w.find('svg').exists()).toBe(true)
    expect(w.text()).toBe('H')
    expect(w.attributes('aria-label')).toBe('President card held by H, counts as 2 shares')
  })

  it('draws treasury and market shares as rings without a letter', () => {
    const treasury = mount(ShareCircle, { props: { kind: 'treasury' } })
    const market = mount(ShareCircle, { props: { kind: 'market' } })
    expect(treasury.text()).toBe('')
    expect(treasury.classes()).toContain('treasury')
    expect(treasury.attributes('aria-label')).toBe('Treasury share')
    expect(market.classes()).toContain('market')
    expect(market.attributes('aria-label')).toBe('Market share')
    expect(treasury.attributes('style')).toBeUndefined()
  })

  it('swaps fill and ink when inverted', () => {
    const w = mount(ShareCircle, { props: { kind: 'president', companyId: 'express', code: 'H', inverted: true } })
    expect(w.attributes('style')).toContain('background: rgb(255, 255, 255)')
    expect(w.attributes('style')).toContain('color: rgb(159, 56, 65)')
  })
})

describe('CompanyTag', () => {
  it('shows the abbreviation with black text on Consortium red', () => {
    const w = mount(CompanyTag, { props: { companyId: 'consortium' } })
    expect(w.text()).toBe('C')
    expect(w.attributes('style')).toContain('color: rgb(0, 0, 0)')
  })
})

describe('TokenChip', () => {
  it('is a labelled button with the abbreviation and the president code', () => {
    const w = mount(TokenChip, {
      props: { companyId: 'express', presidentCode: 'H', label: 'Express at 110, president H' },
    })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('aria-label')).toBe('Express at 110, president H')
    expect(w.attributes('data-id')).toBe('express')
    expect(w.text()).toContain('XP')
    expect(w.text()).toContain('H')
    expect(w.find('.rank').exists()).toBe(false)
  })

  it('shows its queue rank and its selected state', () => {
    const w = mount(TokenChip, {
      props: { companyId: 'express', presidentCode: 'H', label: 'x', rank: 2, selected: true },
    })
    expect(w.find('.rank').text()).toBe('2')
    expect(w.attributes('aria-pressed')).toBe('true')
  })
})

describe('CountStepper', () => {
  it('emits the next value and stops at 0', async () => {
    const w = mount(CountStepper, { props: { modelValue: 1, label: 'Express, H' } })
    await w.get('[aria-label="Increase Express, H"]').trigger('click')
    await w.get('[aria-label="Decrease Express, H"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[2], [0]])

    const zero = mount(CountStepper, { props: { modelValue: 0, label: 'x' } })
    expect(zero.get('[aria-label="Decrease x"]').attributes('disabled')).toBeDefined()
  })
})

describe('EditBanner and PlayerCode', () => {
  it('emits done', async () => {
    const w = mount(EditBanner)
    expect(w.text()).toContain('Edit mode')
    await w.get('button').trigger('click')
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('shows a code', () => {
    expect(mount(PlayerCode, { props: { code: 'Jo' } }).text()).toBe('Jo')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/notation.test.ts`
Expected: FAIL, the component files cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/domain/format.ts`** (full file)
```ts
import type { Zone } from './track'
import type { Phase } from './types'

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th". */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

export const PHASE_LABEL: Record<Phase, string> = { yellow: 'Yellow', green: 'Green', purple: 'Purple' }

export const ZONE_LABEL: Record<Zone, string> = {
  closed: 'Closed',
  none: '',
  yellow: 'Yellow',
  green: 'Green',
  purple: 'Purple',
}
```

**`src/components/CrownIcon.vue`** (full file)
```vue
<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 11 })
</script>

<template>
  <!-- Crown artwork from the Components board: three points on a base bar, 24 unit grid. -->
  <svg :width="size" :height="Math.round(size * 0.9)" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.6 10H4.6z" />
    <rect x="4.5" y="19.5" width="15" height="2.2" rx="1" />
  </svg>
</template>
```

**`src/components/ShareCircle.vue`** (full file)
```vue
<script setup lang="ts">
import { computed } from 'vue'
import CrownIcon from './CrownIcon.vue'
import { COMPANIES } from '../domain/companies'
import type { CompanyId } from '../domain/types'

const props = withDefaults(
  defineProps<{
    kind: 'share' | 'president' | 'treasury' | 'market'
    companyId?: CompanyId
    code?: string
    large?: boolean
    /** Swap fill and ink. Used for the president circle that sits on a company token. */
    inverted?: boolean
  }>(),
  { large: false, inverted: false },
)

const filled = computed(() => props.kind === 'share' || props.kind === 'president')

const style = computed(() => {
  if (!filled.value || !props.companyId) return undefined
  const { color, ink } = COMPANIES[props.companyId]
  return props.inverted ? { background: ink, color } : { background: color, color: ink }
})

const label = computed(() => {
  if (props.kind === 'treasury') return 'Treasury share'
  if (props.kind === 'market') return 'Market share'
  if (props.kind === 'president') return `President card held by ${props.code}, counts as 2 shares`
  return `Share held by ${props.code}`
})
</script>

<template>
  <span class="share" :class="[kind, { large }]" :style="style" :data-kind="kind" role="img" :aria-label="label">
    <CrownIcon v-if="kind === 'president'" :size="large ? 17 : 11" />
    <template v-if="filled">{{ code }}</template>
  </span>
</template>

<style scoped>
.share {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 12px;
  font-weight: 700;
}
.share.share,
.share.president {
  border: var(--token-border);
}
.share.treasury {
  border: 2px dashed var(--muted);
}
.share.market {
  border: 2px solid var(--muted);
}
.share.large {
  width: 44px;
  height: 44px;
  font-size: 16px;
  line-height: 17px;
  gap: 1px;
}
.share.large.treasury,
.share.large.market {
  border-width: 3px;
}
</style>
```

**`src/components/PlayerCode.vue`** (full file)
```vue
<script setup lang="ts">
withDefaults(defineProps<{ code: string; size?: number }>(), { size: 28 })
</script>

<template>
  <span class="player-code" :style="{ width: `${size}px`, height: `${size}px`, fontSize: size >= 32 ? '13px' : '12px' }">{{ code }}</span>
</template>

<style scoped>
.player-code {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  font-weight: 700;
  line-height: 1;
}
</style>
```

**`src/components/CompanyTag.vue`** (full file)
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { COMPANIES } from '../domain/companies'
import type { CompanyId } from '../domain/types'

const props = withDefaults(defineProps<{ companyId: CompanyId; large?: boolean }>(), { large: false })
const info = computed(() => COMPANIES[props.companyId])
</script>

<template>
  <span class="tag" :class="{ large }" :style="{ background: info.color, color: info.ink }">{{ info.abbr }}</span>
</template>

<style scoped>
.tag {
  flex: none;
  width: 34px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: var(--token-border);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
.tag.large {
  width: 48px;
  height: 34px;
  border-radius: 8px;
  font-size: 17px;
}
</style>
```

**`src/components/TokenChip.vue`** (full file)
```vue
<script setup lang="ts">
import { computed } from 'vue'
import ShareCircle from './ShareCircle.vue'
import { COMPANIES } from '../domain/companies'
import type { CompanyId } from '../domain/types'

const props = withDefaults(
  defineProps<{
    companyId: CompanyId
    presidentCode: string | null
    label: string
    /** Position in its queue, shown when the queue holds more than one token. */
    rank?: number | null
    selected?: boolean
  }>(),
  { rank: null, selected: false },
)
const info = computed(() => COMPANIES[props.companyId])
</script>

<template>
  <button
    type="button"
    class="token"
    :class="{ selected }"
    :style="{ background: info.color, color: info.ink }"
    :data-id="companyId"
    :aria-label="label"
    :aria-pressed="selected"
  >
    <span v-if="rank !== null" class="rank">{{ rank }}</span>
    <span class="abbr">{{ info.abbr }}</span>
    <ShareCircle v-if="presidentCode !== null" kind="president" :company-id="companyId" :code="presidentCode" inverted />
  </button>
</template>

<style scoped>
.token {
  position: relative;
  flex: none;
  width: 76px;
  height: 52px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: var(--token-border);
  border-radius: 8px;
  font-weight: 700;
  touch-action: manipulation;
}
.token.selected {
  box-shadow:
    0 0 0 3px #fff,
    0 0 0 6px var(--ink);
}
.abbr {
  font-size: 18px;
}
.rank {
  position: absolute;
  top: -9px;
  left: -9px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  border: 1.5px solid #fff;
  font-size: 12px;
  line-height: 17px;
  text-align: center;
}
@media (max-width: 719px) {
  .token {
    height: 44px;
  }
  .abbr {
    font-size: 17px;
  }
}
</style>
```

**`src/components/EditBanner.vue`** (full file)
```vue
<script setup lang="ts">
defineEmits<{ done: [] }>()
</script>

<template>
  <div class="edit-banner" role="status">
    <i class="pi pi-pencil" aria-hidden="true" />
    <strong>Edit mode</strong>
    <span class="text">Any value is accepted. Rule warnings show but never block.</span>
    <span class="grow" />
    <button type="button" @click="$emit('done')">Done</button>
  </div>
</template>

<style scoped>
.edit-banner {
  flex: none;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 16px;
  background: var(--amber);
  color: #fff;
}
.grow {
  flex: 1;
}
button {
  height: 36px;
  padding: 0 14px;
  border: 1.5px solid #fff;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
@media (max-width: 719px) {
  .text {
    display: none;
  }
}
</style>
```

**`src/components/CountStepper.vue`** (full file)
```vue
<script setup lang="ts">
defineProps<{ modelValue: number; label: string }>()
defineEmits<{ 'update:modelValue': [value: number] }>()
</script>

<template>
  <div class="stepper">
    <button
      type="button"
      :aria-label="`Decrease ${label}`"
      :disabled="modelValue <= 0"
      @click="$emit('update:modelValue', Math.max(0, modelValue - 1))"
    >
      −
    </button>
    <span class="mono value">{{ modelValue }}</span>
    <button type="button" :aria-label="`Increase ${label}`" @click="$emit('update:modelValue', modelValue + 1)">+</button>
  </div>
</template>

<style scoped>
.stepper {
  display: inline-flex;
  align-items: center;
  height: 44px;
  border: 1px solid var(--line-3);
  border-radius: 8px;
  background: var(--card);
  overflow: hidden;
}
button {
  width: 44px;
  height: 42px;
  border: 0;
  background: var(--card);
  color: var(--ink);
  font-size: 20px;
  line-height: 20px;
  font-weight: 500;
}
button:disabled {
  color: var(--line-3);
  cursor: default;
}
.value {
  width: 28px;
  text-align: center;
  font-size: 18px;
}
</style>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/notation.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/format.ts src/components
git commit -m "feat: add share notation and shared components"
```

---

### Task 11: Setup dialog

Board: `Setup.dc.html`.

**Files:**
- Create: `src/dialogs/SetupDialog.vue`
- Test: `src/dialogs/SetupDialog.test.ts`

**Interfaces:**
- Consumes: `STARTING_CASH`, `MIN_PLAYERS`, `MAX_PLAYERS`, `defaultShortGame`, `newGame` from `setup.ts`; `playerCodes`, `codeProblems` from `playerCodes.ts`; `COMPANIES`, `SHORT_GAME_REMOVED` from `companies.ts`; `PHASE_MAX` from `track.ts`; `PHASE_LABEL` from `format.ts`.
- Produces: `<SetupDialog v-model:visible @start="(game: Game) => ..." />`. It emits `start` with a new `Game` and closes itself.

Behavior:
- Opens with 2 empty player rows. "Add player" goes up to 5. Remove is disabled at 2.
- A code follows the names until the user edits that code. A cash value follows the player count until the user edits that cash value. The game length follows the player count until the user picks one.
- "Start game" is disabled while a name is empty or a code is empty or duplicated.

- [ ] **Step 1: Write the failing test**

**`src/dialogs/SetupDialog.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SetupDialog from './SetupDialog.vue'
import type { Game } from '../domain/types'

function open() {
  return mount(SetupDialog, { props: { visible: true } })
}

async function setNames(w: VueWrapper, names: string[]) {
  while (w.findAll('[data-testid="player-name"]').length < names.length) {
    await w.get('[data-testid="add-player"]').trigger('click')
  }
  const inputs = w.findAll('[data-testid="player-name"]')
  for (let i = 0; i < names.length; i++) await inputs[i].setValue(names[i])
}

async function start(w: VueWrapper): Promise<Game> {
  await w.get('[data-testid="start-game"]').trigger('click')
  const events = w.emitted('start')
  if (!events) throw new Error('start was not emitted')
  return events[events.length - 1][0] as Game
}

const button = (w: VueWrapper, text: string) => {
  const found = w.findAll('button').find((b) => b.text().includes(text))
  if (!found) throw new Error(`No button "${text}"`)
  return found
}

const codes = (w: VueWrapper) =>
  w.findAll('[data-testid="player-code"]').map((i) => (i.element as HTMLInputElement).value)

describe('SetupDialog (spec D3 test 12)', () => {
  it('opens with 2 players and keeps Start disabled until the names are filled', async () => {
    const w = open()
    expect(w.findAll('[data-testid="player-name"]')).toHaveLength(2)
    expect(w.get('[data-testid="start-game"]').attributes('disabled')).toBeDefined()
    await setNames(w, ['Haoran', 'Ari'])
    expect(w.get('[data-testid="start-game"]').attributes('disabled')).toBeUndefined()
  })

  it('defaults 2 players to 450 each and a Short Game', async () => {
    const w = open()
    await setNames(w, ['Haoran', 'Ari'])
    const game = await start(w)
    expect(game.players.map((p) => p.cash)).toEqual([450, 450])
    expect(game.settings.shortGame).toBe(true)
    expect(game.companies.adaptive.status).toBe('unavailable')
    expect(game.settings.phase).toBe('yellow')
    expect(w.emitted('update:visible')).toEqual([[false]])
  })

  it('defaults 3, 4 and 5 players to 300, 275 and 220, and a Long Game', async () => {
    for (const [names, cash] of [
      [['A', 'B', 'C'], 300],
      [['A', 'B', 'C', 'D'], 275],
      [['A', 'B', 'C', 'D', 'E'], 220],
    ] as const) {
      const w = open()
      await setNames(w, [...names])
      const game = await start(w)
      expect(game.players.map((p) => p.cash)).toEqual(names.map(() => cash))
      expect(game.settings.shortGame).toBe(false)
      expect(game.companies.adaptive.status).toBe('unstarted')
    }
  })

  it('allows at most 5 players and at least 2', async () => {
    const w = open()
    expect(w.findAll('[aria-label="Remove player"]').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    await setNames(w, ['A', 'B', 'C', 'D', 'E'])
    expect(w.get('[data-testid="add-player"]').attributes('disabled')).toBeDefined()
    await w.findAll('[aria-label="Remove player"]')[0].trigger('click')
    expect(w.findAll('[data-testid="player-name"]')).toHaveLength(4)
    expect((await start(w)).players.map((p) => p.name)).toEqual(['B', 'C', 'D', 'E'])
  })

  it('keeps a game length the user picked when the player count changes', async () => {
    const w = open()
    await setNames(w, ['A', 'B', 'C'])
    await button(w, 'Short').trigger('click')
    await setNames(w, ['A', 'B', 'C', 'D'])
    expect((await start(w)).settings.shortGame).toBe(true)
  })

  it('generates codes from the names', async () => {
    const w = open()
    await setNames(w, ['Haoran', 'Ari', 'John', 'James'])
    expect(codes(w)).toEqual(['H', 'A', 'Jo', 'Ja'])
    expect((await start(w)).players.map((p) => p.code)).toEqual(['H', 'A', 'Jo', 'Ja'])
  })

  it('keeps a code the user edited and rejects a duplicate code', async () => {
    const w = open()
    await setNames(w, ['Haoran', 'Ari'])
    await w.findAll('[data-testid="player-code"]')[1].setValue('h')
    expect(w.text()).toContain('This code is already used')
    expect(w.get('[data-testid="start-game"]').attributes('disabled')).toBeDefined()

    await w.findAll('[data-testid="player-code"]')[1].setValue('X')
    await setNames(w, ['Haoran', 'Ariadne'])
    expect(codes(w)).toEqual(['H', 'X'])
    expect(w.get('[data-testid="start-game"]').attributes('disabled')).toBeUndefined()
  })

  it('uses the chosen phase and game name', async () => {
    const w = open()
    await setNames(w, ['A', 'B'])
    await w.get('[data-testid="game-name"]').setValue('Friday game')
    await button(w, 'Green').trigger('click')
    const game = await start(w)
    expect(game.name).toBe('Friday game')
    expect(game.settings.phase).toBe('green')
  })

  it('trims names and blocks a name that is only spaces', async () => {
    const w = open()
    await setNames(w, ['  Haoran ', '   '])
    expect(w.get('[data-testid="start-game"]').attributes('disabled')).toBeDefined()
    await setNames(w, ['  Haoran ', 'Ari'])
    expect((await start(w)).players.map((p) => p.name)).toEqual(['Haoran', 'Ari'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/dialogs/SetupDialog.test.ts`
Expected: FAIL, `./SetupDialog.vue` cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/dialogs/SetupDialog.vue`** (full file)
```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { COMPANIES, SHORT_GAME_REMOVED } from '../domain/companies'
import { PHASE_LABEL } from '../domain/format'
import { codeProblems, playerCodes } from '../domain/playerCodes'
import { MAX_PLAYERS, MIN_PLAYERS, STARTING_CASH, defaultShortGame, newGame } from '../domain/setup'
import { PHASE_MAX } from '../domain/track'
import type { Game, Phase } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ start: [game: Game] }>()

interface Row {
  key: number
  name: string
  code: string
  codeEdited: boolean
  cash: number
  cashEdited: boolean
}

let nextKey = 0
const blankRow = (): Row => ({ key: nextKey++, name: '', code: '', codeEdited: false, cash: 0, cashEdited: false })

const gameName = ref('')
const rows = ref<Row[]>([])
const shortGame = ref(true)
const lengthPicked = ref(false)
const phase = ref<Phase>('yellow')

const lengthOptions = [
  { label: 'Short · 4 cycles', value: true },
  { label: 'Long · 6 cycles', value: false },
]
const phaseOptions = (['yellow', 'green', 'purple'] as Phase[]).map((value) => ({
  value,
  label: PHASE_LABEL[value],
  range: `60–${PHASE_MAX[value]}`,
}))

/** Applies the defaults that follow the names and the player count. */
function refresh() {
  const count = rows.value.length
  const auto = playerCodes(rows.value.map((r) => r.name))
  rows.value.forEach((row, i) => {
    if (!row.codeEdited) row.code = auto[i]
    if (!row.cashEdited) row.cash = STARTING_CASH[count]
  })
  if (!lengthPicked.value) shortGame.value = defaultShortGame(count)
}

function reset() {
  gameName.value = `Game ${new Date().toLocaleDateString()}`
  rows.value = [blankRow(), blankRow()]
  lengthPicked.value = false
  phase.value = 'yellow'
  refresh()
}

watch(visible, (open) => open && reset(), { immediate: true })

function addPlayer() {
  if (rows.value.length >= MAX_PLAYERS) return
  rows.value.push(blankRow())
  refresh()
}

function removePlayer(index: number) {
  if (rows.value.length <= MIN_PLAYERS) return
  rows.value.splice(index, 1)
  refresh()
}

function setName(row: Row, name: string | undefined) {
  row.name = name ?? ''
  refresh()
}

function setCode(row: Row, code: string | undefined) {
  row.code = code ?? ''
  row.codeEdited = true
}

function setCash(row: Row, cash: number | null) {
  row.cash = cash ?? 0
  row.cashEdited = true
}

function pickLength(value: boolean) {
  shortGame.value = value
  lengthPicked.value = true
}

const problems = computed(() => codeProblems(rows.value.map((r) => r.code)))
const valid = computed(
  () => rows.value.every((r) => r.name.trim() !== '') && problems.value.every((p) => p === null),
)
const summary = computed(() => {
  const count = rows.value.length
  return `${count} players, ${STARTING_CASH[count]} each. Codes come from the names and can be edited.`
})
const removed = SHORT_GAME_REMOVED.map((id) => COMPANIES[id])

function start() {
  if (!valid.value) return
  emit(
    'start',
    newGame({
      name: gameName.value.trim() || 'Untitled game',
      players: rows.value.map((r) => ({ name: r.name.trim(), code: r.code.trim(), cash: r.cash })),
      shortGame: shortGame.value,
      phase: phase.value,
    }),
  )
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="New game" :style="{ width: 'min(560px, 100vw)' }">
    <div class="dialog-body">
      <label class="field">
        <span class="field-label">Game name</span>
        <InputText v-model="gameName" data-testid="game-name" fluid />
      </label>

      <div class="field">
        <div class="player-row field-label">
          <span class="name">Players, in seating order</span>
          <span class="code">Code</span>
          <span class="cash">Starting cash</span>
          <span class="remove" />
        </div>
        <div v-for="(row, i) in rows" :key="row.key">
          <div class="player-row">
            <InputText
              class="name"
              :model-value="row.name"
              :placeholder="`Player ${i + 1}`"
              :aria-label="`Player ${i + 1} name`"
              data-testid="player-name"
              @update:model-value="(v) => setName(row, v)"
            />
            <InputText
              class="code mono"
              :model-value="row.code"
              :invalid="problems[i] !== null"
              :aria-label="`Player ${i + 1} code`"
              maxlength="6"
              data-testid="player-code"
              @update:model-value="(v) => setCode(row, v)"
            />
            <InputNumber
              class="cash"
              :model-value="row.cash"
              :min="0"
              :aria-label="`Player ${i + 1} starting cash`"
              input-class="mono cash-input"
              @update:model-value="(v) => setCash(row, v)"
            />
            <button
              type="button"
              class="icon-btn remove"
              aria-label="Remove player"
              :disabled="rows.length <= MIN_PLAYERS"
              @click="removePlayer(i)"
            >
              <i class="pi pi-trash" aria-hidden="true" />
            </button>
          </div>
          <div v-if="problems[i] !== null && row.name.trim() !== ''" class="error-text">{{ problems[i] }}</div>
        </div>
        <div class="under">
          <Button
            label="Add player"
            icon="pi pi-plus"
            text
            :disabled="rows.length >= MAX_PLAYERS"
            data-testid="add-player"
            @click="addPlayer"
          />
          <span class="small muted">{{ summary }}</span>
        </div>
      </div>

      <div class="field">
        <span class="field-label">Game length</span>
        <SelectButton
          :model-value="shortGame"
          :options="lengthOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          fluid
          @update:model-value="pickLength"
        />
        <span class="small muted">2 players default to short. 3 to 5 players default to long.</span>
        <div class="removed small muted">
          {{ shortGame ? 'A short game removes:' : 'A short game would remove:' }}
          <span v-for="m in removed" :key="m.id" class="pill">
            <span class="dot" :style="{ background: m.color }" />{{ m.names[0] }}
          </span>
        </div>
      </div>

      <div class="field">
        <span class="field-label">Current phase, limits the start price of new companies</span>
        <SelectButton v-model="phase" :options="phaseOptions" option-label="label" option-value="value" :allow-empty="false" fluid>
          <template #option="{ option }">
            <span class="phase-option">
              <span><span class="swatch" :class="`zone-${option.value}`" />{{ option.label }}</span>
              <span class="mono small">{{ option.range }}</span>
            </span>
          </template>
        </SelectButton>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" outlined @click="visible = false" />
        <Button label="Start game" :disabled="!valid" data-testid="start-game" @click="start" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.player-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.player-row .name {
  flex: 1;
  min-width: 0;
}
.player-row .code {
  width: 72px;
  text-align: center;
}
.player-row .cash {
  width: 104px;
}
.player-row .remove {
  width: 44px;
  border: 0;
  background: transparent;
}
.player-row :deep(.cash-input) {
  width: 104px;
  text-align: right;
}
.under {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.removed {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--line-2);
  border-radius: 12px;
  text-decoration: line-through;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(24, 24, 27, 0.45);
}
.phase-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 18px;
}
.swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border-radius: 3px;
  border: 1px solid rgba(24, 24, 27, 0.45);
  vertical-align: -1px;
}
</style>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/dialogs/SetupDialog.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/dialogs
git commit -m "feat: add new game setup dialog"
```

---

### Task 12: Track view

Boards: `Main.dc.html` (tablet), `TrackPhone.dc.html` (phone).

**Files:**
- Create: `src/components/TrackQueue.vue`, `src/views/TrackView.vue`
- Test: `src/views/TrackView.test.ts`

**Interfaces:**
- Consumes: `TRACK`, `TOP`, `zoneOf`, `findToken`, `moveToken`, `placeToken`, `MoveResult` from `track.ts`; `turnOrder` from `scoring.ts`; `closeCompany` from `company.ts`; `displayName` from `companies.ts`; `ordinal`, `ZONE_LABEL` from `format.ts`; `TokenChip`, `CompanyTag`.
- Produces:
  - `<TrackQueue :index :edit-mode @drop="({ id, index, slot }) => ..."><slot /></TrackQueue>`, one sortable queue container. Dragging is on only in edit mode.
  - `<TrackView :game :edit-mode @update="(game: Game) => ..." />`.

Behavior:
- Positions run from the highest price to the lowest (left to right on a tablet, top to bottom on a phone). The view shows the occupied positions plus one on each side. With no tokens it shows 100 down to 50. "Show full track" shows all 27.
- A queue shows its front token first. A queue with more than one token shows a rank badge on each token.
- Tapping a token selects it and shows the bottom dock with "Up" and "Down". Each tap on those is one `moveToken` step. The two buttons have the `aria-label`s "Up to 120" and "Down to 100" ("Stay at 500" at the top, "Down to 0, close" at 10).
- A move to 0 opens a confirm dialog. Accepting closes the company.
- In edit mode, tokens can be dragged to any position and slot, and the dock adds "To front", "To back", "Move to price" and "Close company".

- [ ] **Step 1: Write the failing test**

**`src/views/TrackView.test.ts`** (full file)
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import TrackView from './TrackView.vue'
import TrackQueue from '../components/TrackQueue.vue'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const confirmRequire = vi.fn()
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }))

const [J, K] = ['p1', 'p2']

function sample(): Game {
  let g = put(testGame(), 'northernPort', { price: 90, president: J, treasury: 3 })
  g = put(g, 'tunneling', { price: 90, president: K, treasury: 3 })
  g = put(g, 'resourceful', { price: 60, president: J, treasury: 3 })
  return g
}

const view = (game: Game, editMode = false) => mount(TrackView, { props: { game, editMode } })
const prices = (w: VueWrapper) => w.findAll('.pos').map((p) => Number(p.attributes('data-price')))
const tokens = (w: VueWrapper) => w.findAll('.token').map((t) => t.attributes('data-id'))
const lastUpdate = (w: VueWrapper) => {
  const events = w.emitted('update')
  if (!events) throw new Error('update was not emitted')
  return events[events.length - 1][0] as Game
}
const button = (w: VueWrapper, text: string) => {
  const found = w.findAll('button').find((b) => b.text().includes(text))
  if (!found) throw new Error(`No button "${text}"`)
  return found
}

beforeEach(() => confirmRequire.mockReset())

describe('TrackView', () => {
  it('shows the occupied positions plus one each side, highest first', () => {
    expect(prices(view(sample()))).toEqual([100, 90, 80, 70, 60, 50])
  })

  it('shows 100 to 50 when the track is empty', () => {
    expect(prices(view(testGame()))).toEqual([100, 90, 80, 70, 60, 50])
  })

  it('shows all 27 positions with the full track toggle', async () => {
    const w = view(sample())
    await w.get('[data-testid="full-track"] input').setValue(true)
    expect(prices(w)).toHaveLength(27)
    expect(prices(w)[0]).toBe(500)
    expect(prices(w)[26]).toBe(0)
  })

  it('lists tokens in turn order with a rank badge in a shared queue', () => {
    const w = view(sample())
    expect(tokens(w)).toEqual(['northernPort', 'tunneling', 'resourceful'])
    expect(w.findAll('.rank').map((r) => r.text())).toEqual(['1', '2'])
    expect(w.get('[data-id="tunneling"]').attributes('aria-label')).toBe('Tunneling at 90, president K')
  })

  it('shows the dock for the selected token', async () => {
    const w = view(sample())
    expect(w.find('[data-testid="dock"]').exists()).toBe(false)
    await w.get('[data-id="tunneling"]').trigger('click')
    const dock = w.get('[data-testid="dock"]')
    expect(dock.text()).toContain('Tunneling at 90')
    expect(dock.text()).toContain('President K')
    expect(dock.text()).toContain('acts 2nd of 3')
    expect(dock.find('[aria-label="Up to 100"]').exists()).toBe(true)
    expect(dock.find('[aria-label="Down to 80"]').exists()).toBe(true)
  })

  it('moves the selected token one step per tap', async () => {
    const w = view(sample())
    await w.get('[data-id="northernPort"]').trigger('click')
    await w.get('[aria-label="Up to 100"]').trigger('click')
    expect(lastUpdate(w).track[10]).toEqual(['northernPort'])
    expect(lastUpdate(w).track[9]).toEqual(['tunneling'])
    await w.get('[aria-label="Down to 80"]').trigger('click')
    expect(w.emitted('update')).toHaveLength(2)
  })

  it('asks before closing a company that reaches 0', async () => {
    const g = put(testGame(), 'express', { price: 10, president: J, treasury: 3 })
    const w = view(g)
    await w.get('[data-id="express"]').trigger('click')
    await w.get('[aria-label="Down to 0, close"]').trigger('click')
    expect(w.emitted('update')).toBeUndefined()
    expect(confirmRequire).toHaveBeenCalledTimes(1)
    expect(confirmRequire.mock.calls[0][0].message).toContain('Express')

    confirmRequire.mock.calls[0][0].accept()
    expect(lastUpdate(w).companies.express.status).toBe('closed')
    expect(lastUpdate(w).track[1]).toEqual([])
  })

  it('keeps a token at 500 and sends it to the back', async () => {
    let g = put(testGame(), 'express', { price: 500, president: J, treasury: 3 })
    g = put(g, 'tunneling', { price: 500, president: K, treasury: 3 })
    const w = view(g)
    await w.get('[data-id="express"]').trigger('click')
    await w.get('[aria-label="Stay at 500"]').trigger('click')
    expect(lastUpdate(w).track[26]).toEqual(['tunneling', 'express'])
  })

  it('offers the edit actions only in edit mode', async () => {
    const plain = view(sample())
    await plain.get('[data-id="tunneling"]').trigger('click')
    expect(plain.find('[data-testid="edit-actions"]').exists()).toBe(false)

    const w = view(sample(), true)
    await w.get('[data-id="tunneling"]').trigger('click')
    await button(w, 'To front').trigger('click')
    expect(lastUpdate(w).track[9]).toEqual(['tunneling', 'northernPort'])
    await button(w, 'To back').trigger('click')
    expect(lastUpdate(w).track[9]).toEqual(['northernPort', 'tunneling'])
  })

  it('moves a token to any price in edit mode', async () => {
    const w = view(sample(), true)
    await w.get('[data-id="resourceful"]').trigger('click')
    await button(w, 'Move to price').trigger('click')
    await w.get('[data-testid="price-245"]').trigger('click')
    expect(lastUpdate(w).track[19]).toEqual(['resourceful'])
  })

  it('closes a company from the edit actions after a confirm', async () => {
    const w = view(sample(), true)
    await w.get('[data-id="resourceful"]').trigger('click')
    await button(w, 'Close company').trigger('click')
    expect(confirmRequire).toHaveBeenCalledTimes(1)
    confirmRequire.mock.calls[0][0].accept()
    expect(lastUpdate(w).companies.resourceful.status).toBe('closed')
  })

  it('places a dragged token at the dropped position and slot', async () => {
    const w = view(sample(), true)
    const queue = w.findAllComponents(TrackQueue).find((q) => q.props('index') === 9)!
    queue.vm.$emit('drop', { id: 'resourceful', index: 9, slot: 1 })
    expect(lastUpdate(w).track[9]).toEqual(['northernPort', 'resourceful', 'tunneling'])
    expect(lastUpdate(w).track[6]).toEqual([])
  })

  it('clears the selection when the selected company leaves the track', async () => {
    const w = view(sample())
    await w.get('[data-id="resourceful"]').trigger('click')
    const next = { ...sample(), track: sample().track.map((q) => q.filter((id) => id !== 'resourceful')) }
    await w.setProps({ game: next })
    expect(w.find('[data-testid="dock"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/views/TrackView.test.ts`
Expected: FAIL, `./TrackView.vue` cannot be resolved.

- [ ] **Step 3: Write the queue component**

**`src/components/TrackQueue.vue`** (full file)
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'
import type { CompanyId } from '../domain/types'

// One track position's queue. In edit mode its tokens can be dragged to any queue.
// The parent re-creates this component after every drop, because SortableJS moves
// DOM nodes itself and Vue must render the new state from scratch.
const props = defineProps<{ index: number; editMode: boolean }>()
const emit = defineEmits<{ drop: [payload: { id: CompanyId; index: number; slot: number }] }>()

const el = ref<HTMLElement | null>(null)

useSortable(el, ref<CompanyId[]>([]), {
  group: 'track',
  animation: 150,
  draggable: '.token',
  disabled: !props.editMode,
  // Replace the default handler, which would reorder the list argument.
  onUpdate: () => {},
  onEnd(event) {
    const id = event.item.dataset.id
    const index = Number(event.to.dataset.index)
    if (!id || Number.isNaN(index)) return
    if (event.from === event.to && event.oldDraggableIndex === event.newDraggableIndex) return
    emit('drop', { id, index, slot: event.newDraggableIndex ?? 0 })
  },
})
</script>

<template>
  <div ref="el" class="queue" :data-index="index">
    <slot />
  </div>
</template>

<style scoped>
.queue {
  flex: 1;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 14px 4px;
}
@media (max-width: 719px) {
  .queue {
    min-height: 0;
    flex-direction: row;
    padding: 8px 12px;
  }
}
</style>
```

- [ ] **Step 4: Write the view**

**`src/views/TrackView.vue`** (full file)
```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import CompanyTag from '../components/CompanyTag.vue'
import TokenChip from '../components/TokenChip.vue'
import TrackQueue from '../components/TrackQueue.vue'
import { closeCompany } from '../domain/company'
import { displayName } from '../domain/companies'
import { ZONE_LABEL, ordinal } from '../domain/format'
import { turnOrder } from '../domain/scoring'
import { TOP, TRACK, findToken, moveToken, placeToken, zoneOf, type MoveResult } from '../domain/track'
import type { CompanyId, Game } from '../domain/types'

const props = defineProps<{ game: Game; editMode: boolean }>()
const emit = defineEmits<{ update: [game: Game] }>()
const confirm = useConfirm()

const showFull = ref(false)
const selectedId = ref<CompanyId | null>(null)
const priceDialog = ref(false)
/** Changes after every drag, to re-create the queues (see TrackQueue). */
const epoch = ref(0)

const order = computed(() => turnOrder(props.game))

/** Track indices to show, highest price first. */
const indices = computed(() => {
  let low = 5
  let high = 10
  const occupied = props.game.track.flatMap((queue, i) => (queue.length > 0 ? [i] : []))
  if (showFull.value) {
    low = 0
    high = TOP
  } else if (occupied.length > 0) {
    low = Math.max(0, Math.min(...occupied) - 1)
    high = Math.min(TOP, Math.max(...occupied) + 1)
  }
  const out: number[] = []
  for (let i = high; i >= low; i--) out.push(i)
  return out
})

const codeOf = (id: CompanyId) => {
  const president = props.game.companies[id].president
  return props.game.players.find((p) => p.id === president)?.code ?? null
}
const nameOf = (id: CompanyId) => displayName(props.game.companies[id])
const tokenLabel = (id: CompanyId, index: number) =>
  `${nameOf(id)} at ${TRACK[index]}, president ${codeOf(id) ?? 'none'}`

const selected = computed(() => {
  const id = selectedId.value
  const pos = id === null ? null : findToken(props.game, id)
  if (id === null || pos === null) return null
  return {
    id,
    index: pos.index,
    price: TRACK[pos.index],
    name: nameOf(id),
    code: codeOf(id),
    acts: order.value.indexOf(id) + 1,
    up: pos.index < TOP ? { text: 'Up to', price: TRACK[pos.index + 1] } : { text: 'Stay at', price: TRACK[TOP] },
    down: { text: 'Down to', price: TRACK[pos.index - 1], note: pos.index > 1 ? '' : ', close' },
  }
})

watch(selected, (value) => {
  if (value === null) selectedId.value = null
})

function askClose(id: CompanyId) {
  const name = nameOf(id)
  confirm.require({
    header: `Close ${name}?`,
    message: `${name} reaches 0 and closes. All its shares leave the game. You can undo this.`,
    acceptProps: { label: 'Close company', severity: 'danger' },
    rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
    accept: () => emit('update', closeCompany(props.game, id)),
  })
}

function apply(result: MoveResult) {
  if (result.kind === 'moved') emit('update', result.game)
  else askClose(result.companyId)
}

function step(steps: number) {
  if (selected.value) apply(moveToken(props.game, selected.value.id, steps))
}

function toSlot(slot?: number) {
  if (selected.value) apply(placeToken(props.game, selected.value.id, selected.value.index, slot))
}

function toPrice(index: number) {
  priceDialog.value = false
  if (selected.value) apply(placeToken(props.game, selected.value.id, index))
}

function onDrop(payload: { id: CompanyId; index: number; slot: number }) {
  selectedId.value = payload.id
  apply(placeToken(props.game, payload.id, payload.index, payload.slot))
  epoch.value++
}
</script>

<template>
  <section class="track-view">
    <div class="bar">
      <span class="hint">
        <i class="pi pi-arrow-right wide" aria-hidden="true" />
        <i class="pi pi-arrow-down narrow" aria-hidden="true" />
        <span class="wide">Turn order: highest price acts first, left to right</span>
        <span class="narrow">Top acts first</span>
      </span>
      <span class="grow" />
      <span class="small muted wide">Showing {{ indices.length }} of {{ TRACK.length }} positions</span>
      <label class="toggle" data-testid="full-track">
        <ToggleSwitch v-model="showFull" />
        <span>Show full track</span>
      </label>
    </div>

    <div :key="`${epoch}-${editMode}`" class="track card">
      <div
        v-for="i in indices"
        :key="i"
        class="pos"
        :class="{ occupied: game.track[i].length > 0 }"
        :data-price="TRACK[i]"
      >
        <div class="pos-head" :class="`zone-${zoneOf(TRACK[i])}`">
          <span class="mono price">{{ TRACK[i] }}</span>
          <span class="zone-name">{{ ZONE_LABEL[zoneOf(TRACK[i])] }}</span>
        </div>
        <TrackQueue :index="i" :edit-mode="editMode" @drop="onDrop">
          <TokenChip
            v-for="(id, slot) in game.track[i]"
            :key="id"
            :company-id="id"
            :president-code="codeOf(id)"
            :label="tokenLabel(id, i)"
            :rank="game.track[i].length > 1 ? slot + 1 : null"
            :selected="id === selectedId"
            @click="selectedId = id"
          />
        </TrackQueue>
      </div>
    </div>

    <p v-if="order.length === 0" class="empty muted">No company has started. Use Start company.</p>

    <div v-if="selected" class="dock" data-testid="dock">
      <CompanyTag :company-id="selected.id" large />
      <div class="about">
        <div class="title">{{ selected.name }} at {{ selected.price }}</div>
        <div class="small muted">
          President {{ selected.code ?? 'none' }} · acts {{ ordinal(selected.acts) }} of {{ order.length }}
        </div>
      </div>
      <span class="grow" />
      <div v-if="editMode" class="edit-actions" data-testid="edit-actions">
        <Button label="To front" severity="secondary" outlined @click="toSlot(0)" />
        <Button label="To back" severity="secondary" outlined @click="toSlot()" />
        <Button label="Move to price" severity="secondary" outlined @click="priceDialog = true" />
        <Button label="Close company" severity="danger" outlined @click="askClose(selected.id)" />
      </div>
      <!-- On a phone only the arrow and the price show, as on the TrackPhone board. -->
      <button type="button" class="move" :aria-label="`${selected.up.text} ${selected.up.price}`" @click="step(1)">
        <i class="pi pi-chevron-up" aria-hidden="true" />
        <span><span class="wide">{{ selected.up.text }}&nbsp;</span><span class="mono">{{ selected.up.price }}</span></span>
      </button>
      <button
        type="button"
        class="move"
        :aria-label="`${selected.down.text} ${selected.down.price}${selected.down.note}`"
        @click="step(-1)"
      >
        <i class="pi pi-chevron-down" aria-hidden="true" />
        <span>
          <span class="wide">{{ selected.down.text }}&nbsp;</span><span class="mono">{{ selected.down.price }}</span
          ><span class="wide">{{ selected.down.note }}</span>
        </span>
      </button>
    </div>

    <Dialog
      v-model:visible="priceDialog"
      modal
      :header="selected ? `Move ${selected.name} to a price` : 'Move to a price'"
      :style="{ width: 'min(480px, 100vw)' }"
    >
      <div class="price-grid">
        <button
          v-for="(price, i) in TRACK.slice(1)"
          :key="price"
          type="button"
          class="mono price-btn"
          :class="`zone-${zoneOf(price)}`"
          :data-testid="`price-${price}`"
          @click="toPrice(i + 1)"
        >
          {{ price }}
        </button>
      </div>
      <p class="small muted">The token joins the back of the queue at that price.</p>
    </Dialog>
  </section>
</template>

<style scoped>
.track-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.bar {
  flex: none;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 0;
}
.hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.grow {
  flex: 1;
}
.narrow {
  display: none;
}
.toggle {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}
.track {
  flex: 1;
  min-height: 0;
  margin: 8px 16px 12px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(88px, 1fr);
  overflow: auto;
}
.pos {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
}
.pos-head {
  flex: none;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--line-2);
}
.price {
  font-size: 20px;
  line-height: 24px;
}
.zone-name {
  height: 16px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  color: var(--ink-2);
}
.empty {
  margin: 0 16px 12px;
}
.dock {
  flex: none;
  min-height: 88px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 14px;
  padding: 12px 16px;
  background: var(--card);
  border-top: 1px solid var(--line);
}
.dock .title {
  font-size: 16px;
  line-height: 22px;
  font-weight: 600;
}
.edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.move {
  height: 56px;
  min-width: 150px;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--line-2);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  font-size: 16px;
  font-weight: 600;
}
.price-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 6px;
}
.price-btn {
  height: 44px;
  border: 1px solid var(--line-3);
  border-radius: 8px;
  font-size: 15px;
}

@media (max-width: 719px) {
  .wide {
    display: none;
  }
  .narrow {
    display: inline;
  }
  .bar {
    padding: 0 8px 0 16px;
  }
  .track {
    margin: 0 8px 8px;
    grid-auto-flow: row;
    grid-auto-columns: auto;
    grid-auto-rows: min-content;
  }
  .pos {
    flex-direction: row;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .pos-head {
    width: 72px;
    height: auto;
    min-height: 30px;
    border-bottom: 0;
    border-right: 1px solid var(--line-2);
  }
  .pos.occupied .pos-head {
    min-height: 60px;
  }
  .pos:not(.occupied) .price {
    font-size: 14px;
    line-height: 16px;
    font-weight: 500;
    color: var(--muted);
  }
  .pos:not(.occupied) .zone-name {
    display: none;
  }
  .dock {
    padding: 10px 12px;
  }
  .dock .grow {
    display: none;
  }
  .about {
    flex: 1;
    min-width: 0;
  }
  .edit-actions {
    order: 10;
    width: 100%;
  }
  .move {
    flex: none;
    min-width: 76px;
    padding: 0 8px;
    gap: 4px;
  }
}
</style>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/views/TrackView.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/TrackQueue.vue src/views
git commit -m "feat: add track view with token moves, queues and edit actions"
```

---

### Task 13: Start company dialog

Board: `StartCompany.dc.html`.

**Files:**
- Create: `src/dialogs/StartCompanyDialog.vue`
- Test: `src/dialogs/StartCompanyDialog.test.ts`

**Interfaces:**
- Consumes: `MINOR_IDS`, `COMPANIES` from `companies.ts`; `startPrice`, `startPrices`, `snapDown`, `PHASE_MAX`, `zoneOf` from `track.ts`; `startCompany` from `company.ts`; `PHASE_LABEL` from `format.ts`; `CompanyTag`, `PlayerCode`.
- Produces: `<StartCompanyDialog v-model:visible :game @start="(game: Game) => ..." />`. It emits `start` with the game after `startCompany` and closes itself.

Behavior:
- Lists the unstarted minors. The user picks one, picks the president, and enters the winning bid (default 120, plus and minus change it by 5).
- Shows the price from `startPrice(bid, phase)` with the working. The user can instead tap a price on the small track; prices above the phase maximum are disabled. Changing the bid clears a tapped price.
- An invalid bid (below 120 or not a multiple of 5) shows a message and disables Start unless a price was tapped.
- Cash is not changed.

- [ ] **Step 1: Write the failing test**

**`src/dialogs/StartCompanyDialog.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import StartCompanyDialog from './StartCompanyDialog.vue'
import { setPhase, setShortGame } from '../domain/edit'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const open = (game: Game) => mount(StartCompanyDialog, { props: { visible: true, game } })
const startButton = (w: VueWrapper) => w.get('[data-testid="start-company"]')
const disabled = (w: VueWrapper) => startButton(w).attributes('disabled') !== undefined

async function pick(w: VueWrapper, company: string, player: string) {
  await w.get(`[data-testid="company-${company}"]`).trigger('click')
  await w.get(`[data-testid="president-${player}"]`).trigger('click')
}

async function start(w: VueWrapper): Promise<Game> {
  await startButton(w).trigger('click')
  const events = w.emitted('start')
  if (!events) throw new Error('start was not emitted')
  return events[0][0] as Game
}

describe('StartCompanyDialog', () => {
  it('lists only the unstarted minors', () => {
    const long = open(put(testGame(), 'express', { price: 80, president: 'p1', treasury: 3 }))
    expect(long.findAll('[data-testid^="company-"]')).toHaveLength(11)
    expect(long.find('[data-testid="company-express"]').exists()).toBe(false)
    expect(long.find('[data-testid="company-union"]').exists()).toBe(false)

    const short = open(setShortGame(testGame(), true))
    expect(short.findAll('[data-testid^="company-"]')).toHaveLength(8)
    expect(short.find('[data-testid="company-adaptive"]').exists()).toBe(false)
  })

  it('needs a company and a president', async () => {
    const w = open(testGame())
    expect(disabled(w)).toBe(true)
    await w.get('[data-testid="company-express"]').trigger('click')
    expect(disabled(w)).toBe(true)
    await w.get('[data-testid="president-p2"]').trigger('click')
    expect(disabled(w)).toBe(false)
  })

  it('starts at half the default bid of 120 and leaves cash alone', async () => {
    const w = open(testGame())
    await pick(w, 'express', 'p2')
    const game = await start(w)
    expect(game.track[6]).toEqual(['express'])
    expect(game.companies.express).toMatchObject({ status: 'active', president: 'p2', treasuryShares: 3 })
    expect(game.players.map((p) => p.cash)).toEqual([0, 0])
    expect(w.emitted('update:visible')).toEqual([[false]])
  })

  it('shows the price for a bid, snapped down and limited by the phase', async () => {
    const w = open(testGame())
    await pick(w, 'express', 'p1')
    const bid = w.get('[data-testid="bid"]')
    await bid.setValue(175)
    expect(w.get('[data-testid="start-price"]').text()).toBe('80')
    expect(w.text()).toContain('175 ÷ 2 = 87.5, snapped down to 80')
    await bid.setValue(200)
    expect(w.get('[data-testid="start-price"]').text()).toBe('90')
    expect(w.text()).toContain('limited to 90')
    expect((await start(w)).track[9]).toEqual(['express'])
  })

  it('allows a higher price in a later phase', async () => {
    const w = open(setPhase(testGame(), 'green'))
    await pick(w, 'express', 'p1')
    await w.get('[data-testid="bid"]').setValue(200)
    expect(w.get('[data-testid="start-price"]').text()).toBe('100')
  })

  it('changes the bid by 5 and not below 120', async () => {
    const w = open(testGame())
    const bid = () => (w.get('[data-testid="bid"]').element as HTMLInputElement).value
    await w.get('[aria-label="Raise bid by 5"]').trigger('click')
    expect(bid()).toBe('125')
    await w.get('[aria-label="Lower bid by 5"]').trigger('click')
    await w.get('[aria-label="Lower bid by 5"]').trigger('click')
    expect(bid()).toBe('120')
  })

  it('blocks an invalid bid with a message', async () => {
    const w = open(testGame())
    await pick(w, 'express', 'p1')
    await w.get('[data-testid="bid"]').setValue(122)
    expect(disabled(w)).toBe(true)
    expect(w.text()).toContain('A bid is at least 120, in steps of 5')
    await w.get('[data-testid="bid"]').setValue('')
    expect(disabled(w)).toBe(true)
  })

  it('lets the user tap a price, and disables prices above the phase maximum', async () => {
    const w = open(testGame())
    await pick(w, 'express', 'p1')
    expect(w.get('[data-testid="pick-100"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="bid"]').setValue(122)
    await w.get('[data-testid="pick-70"]').trigger('click')
    expect(w.get('[data-testid="start-price"]').text()).toBe('70')
    expect(disabled(w)).toBe(false)
    expect((await start(w)).track[7]).toEqual(['express'])
  })

  it('goes back to the bid price when the bid changes', async () => {
    const w = open(testGame())
    await pick(w, 'express', 'p1')
    await w.get('[data-testid="pick-70"]').trigger('click')
    await w.get('[data-testid="bid"]').setValue(160)
    expect(w.get('[data-testid="start-price"]').text()).toBe('80')
  })

  it('says so when every minor has started', () => {
    let g = setShortGame(testGame(), true)
    for (const id of ['tunneling', 'resourceful', 'easternMining', 'agricultural', 'northernPort', 'expansive', 'express', 'suburban']) {
      g = put(g, id, { price: 80, president: 'p1', treasury: 3 })
    }
    const w = open(g)
    expect(w.text()).toContain('Every minor company has started')
    expect(disabled(w)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/dialogs/StartCompanyDialog.test.ts`
Expected: FAIL, `./StartCompanyDialog.vue` cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/dialogs/StartCompanyDialog.vue`** (full file)
```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import CompanyTag from '../components/CompanyTag.vue'
import PlayerCode from '../components/PlayerCode.vue'
import { startCompany } from '../domain/company'
import { COMPANIES, MINOR_IDS } from '../domain/companies'
import { PHASE_LABEL } from '../domain/format'
import { PHASE_MAX, snapDown, startPrice, startPrices, zoneOf } from '../domain/track'
import type { CompanyId, Game, PlayerId } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ start: [game: Game] }>()

const MIN_BID = 120
const companyId = ref<CompanyId | null>(null)
const presidentId = ref<PlayerId | null>(null)
/** The text field's value: a number, or '' while the field is empty. */
const bid = ref<number | string>(MIN_BID)
/** A price tapped on the track. It overrides the price from the bid. */
const tapped = ref<number | null>(null)

watch(
  visible,
  (open) => {
    if (!open) return
    companyId.value = null
    presidentId.value = null
    bid.value = MIN_BID
    tapped.value = null
  },
  { immediate: true },
)

watch(bid, () => {
  tapped.value = null
})

const phase = computed(() => props.game.settings.phase)
const minors = computed(() => MINOR_IDS.filter((id) => props.game.companies[id].status === 'unstarted'))
const allowed = computed(() => startPrices(phase.value))
const trackPrices = startPrices('purple')

const bidPrice = computed(() => {
  try {
    return startPrice(Number(bid.value), phase.value)
  } catch {
    return null
  }
})
const price = computed(() => tapped.value ?? bidPrice.value)

const working = computed(() => {
  if (tapped.value !== null) return 'Price chosen on the track.'
  if (bidPrice.value === null) return 'A bid is at least 120, in steps of 5.'
  const half = Number(bid.value) / 2
  const snapped = snapDown(half)
  let text = `${bid.value} ÷ 2 = ${half}`
  if (snapped !== half) text += `, snapped down to ${snapped}`
  if (bidPrice.value !== snapped) text += `, limited to ${bidPrice.value}`
  return `${text}.`
})

const president = computed(() => props.game.players.find((p) => p.id === presidentId.value))
const canStart = computed(() => companyId.value !== null && presidentId.value !== null && price.value !== null)

function changeBid(delta: number) {
  const current = Number(bid.value)
  bid.value = Math.max(MIN_BID, (Number.isFinite(current) ? current : MIN_BID) + delta)
}

function start() {
  if (companyId.value === null || presidentId.value === null || price.value === null) return
  emit('start', startCompany(props.game, companyId.value, presidentId.value, price.value))
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Start a minor company" :style="{ width: 'min(560px, 100vw)' }">
    <div class="dialog-body">
      <div class="field">
        <span class="field-label">Company</span>
        <p v-if="minors.length === 0" class="note">Every minor company has started.</p>
        <div class="companies">
          <button
            v-for="id in minors"
            :key="id"
            type="button"
            class="pick"
            :aria-pressed="companyId === id"
            :data-testid="`company-${id}`"
            @click="companyId = id"
          >
            <CompanyTag :company-id="id" />
            <span class="grow">{{ COMPANIES[id].names[0] }}</span>
            <i v-if="companyId === id" class="pi pi-check tick" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="field">
        <span class="field-label">President</span>
        <div class="players">
          <button
            v-for="p in game.players"
            :key="p.id"
            type="button"
            class="pick player"
            :aria-pressed="presidentId === p.id"
            :data-testid="`president-${p.id}`"
            @click="presidentId = p.id"
          >
            <PlayerCode :code="p.code" />{{ p.name }}
          </button>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="bid">Winning bid</label>
        <div class="bid-row">
          <button type="button" class="bid-btn" aria-label="Lower bid by 5" @click="changeBid(-5)">−</button>
          <input
            id="bid"
            v-model.number="bid"
            class="mono bid-input"
            type="number"
            inputmode="numeric"
            :min="MIN_BID"
            step="5"
            data-testid="bid"
          />
          <button type="button" class="bid-btn" aria-label="Raise bid by 5" @click="changeBid(5)">+</button>
        </div>
        <span class="small muted">Minimum 120, in steps of 5.</span>
      </div>

      <div class="result">
        <div class="result-head">
          <span class="field-label">Starting price</span>
          <span class="mono big" data-testid="start-price">{{ price ?? '–' }}</span>
          <span class="small" :class="bidPrice === null && tapped === null ? 'error-text' : 'muted'">
            {{ working }} {{ PHASE_LABEL[phase] }} phase allows 60–{{ PHASE_MAX[phase] }}.
          </span>
        </div>
        <div class="mini-track">
          <button
            v-for="p in trackPrices"
            :key="p"
            type="button"
            class="mono mini"
            :class="[allowed.includes(p) ? `zone-${zoneOf(p)}` : 'off', { on: price === p }]"
            :disabled="!allowed.includes(p)"
            :aria-pressed="price === p"
            :data-testid="`pick-${p}`"
            @click="tapped = p"
          >
            {{ p }}
          </button>
        </div>
        <span class="small muted">Or tap a price on the track.</span>
      </div>

      <p class="note">
        <i class="pi pi-info-circle" aria-hidden="true" />
        <span>
          {{ president ? president.name : 'The president' }} receives the president card, worth 2 shares. The other 3
          shares go to the company treasury. Cash is not changed in Phase 1.
        </span>
      </p>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" outlined @click="visible = false" />
        <Button label="Start company" :disabled="!canStart" data-testid="start-company" @click="start" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.companies {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.players {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.player {
  flex: 1;
  min-height: 52px;
  justify-content: center;
}
.grow {
  flex: 1;
}
.tick {
  color: var(--primary);
}
.bid-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bid-btn {
  width: 56px;
  height: 56px;
  border: 1px solid var(--line-3);
  border-radius: 8px;
  background: var(--card);
  color: var(--ink);
  font-size: 24px;
}
.bid-input {
  flex: 1;
  min-width: 0;
  height: 56px;
  border: 2px solid var(--primary);
  border-radius: 8px;
  font-size: 28px;
  text-align: center;
}
.result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg);
}
.result-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.big {
  font-size: 32px;
  line-height: 36px;
}
.mini-track {
  display: flex;
  gap: 4px;
}
.mini {
  flex: 1;
  height: 44px;
  padding: 0;
  border: 1px solid var(--line-3);
  border-radius: 8px;
  color: var(--ink);
  font-size: 15px;
}
.mini.on {
  border: 3px solid var(--ink);
}
.mini.off {
  background: var(--bg);
  border-style: dashed;
  color: var(--faint);
  text-decoration: line-through;
  cursor: default;
}
.note {
  margin: 0;
}
</style>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/dialogs/StartCompanyDialog.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/dialogs
git commit -m "feat: add start company dialog"
```

---
### Task 14: Ownership view

Boards: `Ownership.dc.html`, `OwnershipEdit.dc.html`.

**Files:**
- Create: `src/views/OwnershipView.vue`
- Test: `src/views/OwnershipView.test.ts`

**Interfaces:**
- Consumes: `turnOrder` from `scoring.ts`; `shares`, `shareTotal`, `validate`, `TOTAL_SHARES` from `shares.ts`; `presidencyCandidate`, `transferPresidency` from `presidency.ts`; `setHolding`, `setTreasuryShares`, `setMarketShares`, `setPresident` from `edit.ts`; `priceOf` from `track.ts`; `displayName`, `kindOf` from `companies.ts`; `ordinal` from `format.ts`; `ShareCircle`, `PlayerCode`, `CompanyTag`, `CountStepper`.
- Produces: `<OwnershipView :game :edit-mode @update="(game: Game) => ..." />`.

Behavior:
- One row per active company, in turn order. Each row has `data-company="<id>"`. Each player cell has `data-holder="<playerId>"`; the treasury and market cells have `data-holder="treasury"` and `data-holder="market"`.
- Normal mode: a cell shows the president card (crown circle) and one circle per regular card. An empty cell shows a dash.
- The check cell shows `5/5` or `10/10` with a tick, or the wrong total with the warnings for that company. A row with warnings has the class `warn`.
- "Transfer presidency" appears in both modes when `presidencyCandidate` returns a player.
- Edit mode: each cell has a stepper, and the company cell has a president picker (PrimeVue `Select`).

- [ ] **Step 1: Write the failing test**

**`src/views/OwnershipView.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import OwnershipView from './OwnershipView.vue'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const [J, K] = ['p1', 'p2']

function sample(): Game {
  let g = put(testGame(), 'tunneling', { price: 70, president: K, treasury: 3 })
  g = put(g, 'express', { price: 80, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
  g = put(g, 'union', { price: 100, president: K, holdings: { [J]: 2 }, treasury: 4, market: 2 })
  return g
}

const view = (game: Game, editMode = false) => mount(OwnershipView, { props: { game, editMode } })
const row = (w: VueWrapper, id: string) => w.get(`[data-company="${id}"]`)
const kinds = (w: VueWrapper, id: string, holder: string) =>
  row(w, id).get(`[data-holder="${holder}"]`).findAll('.share').map((s) => s.attributes('data-kind'))
const lastUpdate = (w: VueWrapper) => {
  const events = w.emitted('update')
  if (!events) throw new Error('update was not emitted')
  return events[events.length - 1][0] as Game
}

describe('OwnershipView', () => {
  it('lists active companies in turn order', () => {
    const w = view(sample())
    expect(w.findAll('[data-company]').map((r) => r.attributes('data-company'))).toEqual(['union', 'express', 'tunneling'])
    expect(row(w, 'express').text()).toContain('Express')
    expect(row(w, 'express').text()).toContain('80')
    expect(row(w, 'express').text()).toContain('acts 2nd')
  })

  it('shows each holding as circles', () => {
    const w = view(sample())
    expect(kinds(w, 'express', J)).toEqual(['president'])
    expect(kinds(w, 'express', K)).toEqual(['share'])
    expect(kinds(w, 'express', 'treasury')).toEqual(['treasury'])
    expect(kinds(w, 'express', 'market')).toEqual(['market'])
    expect(kinds(w, 'union', J)).toEqual(['share', 'share'])
    expect(kinds(w, 'union', 'treasury')).toHaveLength(4)
    expect(kinds(w, 'tunneling', J)).toEqual([])
    expect(row(w, 'tunneling').get(`[data-holder="${J}"]`).text()).toBe('–')
  })

  it('shows the share check per row', () => {
    const w = view(sample())
    expect(row(w, 'express').get('.check').text()).toContain('5/5')
    expect(row(w, 'union').get('.check').text()).toContain('10/10')
    expect(row(w, 'express').classes()).not.toContain('warn')
  })

  it('marks a row with warnings', () => {
    const g = put(testGame(), 'express', { price: 80, president: J, treasury: 2 })
    const w = view(g)
    expect(row(w, 'express').classes()).toContain('warn')
    expect(row(w, 'express').get('.check').text()).toContain('4/5')
    expect(row(w, 'express').get('.check').text()).toContain('shares total 4 of 5')
  })

  it('offers a one-tap presidency transfer', async () => {
    const g = put(testGame(), 'express', { price: 80, president: J, holdings: { [K]: 3 } })
    const w = view(g)
    expect(row(w, 'express').text()).toContain('K has 3, president J has 2')
    await row(w, 'express').get('[data-testid="transfer"]').trigger('click')
    expect(lastUpdate(w).companies.express.president).toBe(K)
    expect(lastUpdate(w).companies.express.holdings).toEqual({ [J]: 2, [K]: 1 })
  })

  it('has no transfer button when the president holds the most', () => {
    expect(view(sample()).find('[data-testid="transfer"]').exists()).toBe(false)
  })

  it('edits share counts with steppers in edit mode', async () => {
    const w = view(sample(), true)
    await w.get('[aria-label="Increase Express, K"]').trigger('click')
    expect(lastUpdate(w).companies.express.holdings[K]).toBe(2)
    await w.get('[aria-label="Decrease Express, treasury"]').trigger('click')
    expect(lastUpdate(w).companies.express.treasuryShares).toBe(0)
    await w.get('[aria-label="Increase Express, market"]').trigger('click')
    expect(lastUpdate(w).companies.express.marketShares).toBe(2)
    expect(w.emitted('update')).toHaveLength(3)
  })

  it('marks the president card next to the stepper in edit mode', () => {
    const w = view(sample(), true)
    expect(row(w, 'express').get(`[data-holder="${J}"]`).text()).toContain('+2 card')
    expect(row(w, 'express').get(`[data-holder="${K}"]`).text()).not.toContain('+2 card')
  })

  it('sets the president from the picker in edit mode', () => {
    const w = view(sample(), true)
    const picker = row(w, 'express').getComponent({ name: 'Select' })
    picker.vm.$emit('update:modelValue', K)
    expect(lastUpdate(w).companies.express.president).toBe(K)
    picker.vm.$emit('update:modelValue', null)
    expect(lastUpdate(w).companies.express.president).toBeNull()
  })

  it('has no steppers outside edit mode', () => {
    expect(view(sample()).find('[aria-label^="Increase"]').exists()).toBe(false)
  })

  it('explains an empty board', () => {
    expect(view(testGame()).text()).toContain('No active companies')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/views/OwnershipView.test.ts`
Expected: FAIL, `./OwnershipView.vue` cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/views/OwnershipView.vue`** (full file)
```vue
<script setup lang="ts">
import { computed } from 'vue'
import Select from 'primevue/select'
import CompanyTag from '../components/CompanyTag.vue'
import CountStepper from '../components/CountStepper.vue'
import PlayerCode from '../components/PlayerCode.vue'
import ShareCircle from '../components/ShareCircle.vue'
import { displayName, kindOf } from '../domain/companies'
import { setHolding, setMarketShares, setPresident, setTreasuryShares } from '../domain/edit'
import { ordinal } from '../domain/format'
import { presidencyCandidate, transferPresidency } from '../domain/presidency'
import { turnOrder } from '../domain/scoring'
import { TOTAL_SHARES, shareTotal, shares, validate } from '../domain/shares'
import { priceOf } from '../domain/track'
import type { CompanyId, Game, PlayerId } from '../domain/types'

const props = defineProps<{ game: Game; editMode: boolean }>()
const emit = defineEmits<{ update: [game: Game] }>()

const warnings = computed(() => validate(props.game))
const codeOf = (id: PlayerId | null) => props.game.players.find((p) => p.id === id)?.code ?? ''

const rows = computed(() =>
  turnOrder(props.game).map((id, i) => {
    const company = props.game.companies[id]
    const name = displayName(company)
    const candidate = presidencyCandidate(props.game, id)
    return {
      id,
      company,
      name,
      price: priceOf(props.game, id),
      acts: ordinal(i + 1),
      total: shareTotal(company),
      expected: TOTAL_SHARES[kindOf(id)],
      // The row already names the company, so drop the "Name: " prefix.
      warnings: warnings.value.filter((w) => w.companyId === id).map((w) => w.message.replace(`${name}: `, '')),
      candidate,
      candidateCode: codeOf(candidate),
    }
  }),
)

const presidentOptions = computed(() => [
  ...props.game.players.map((p) => ({ label: `${p.code} · ${p.name}`, value: p.id as PlayerId | null })),
  { label: 'No president', value: null },
])

function transfer(id: CompanyId, to: PlayerId) {
  emit('update', transferPresidency(props.game, id, to))
}
</script>

<template>
  <section class="ownership">
    <p v-if="rows.length === 0" class="muted">No active companies. Start a company to see its shares here.</p>

    <div v-else class="scroll">
      <div class="table card" :class="{ editing: editMode }" :style="{ '--cols': game.players.length + 2 }">
        <div class="row head">
          <div class="company small label">{{ editMode ? 'Company, president' : 'Company, in turn order' }}</div>
          <div v-for="p in game.players" :key="p.id" class="col-head">
            <PlayerCode :code="p.code" />
            <span class="small muted">{{ p.name }}</span>
          </div>
          <div class="col-head">
            <ShareCircle kind="treasury" />
            <span class="small muted">Treasury</span>
          </div>
          <div class="col-head">
            <ShareCircle kind="market" />
            <span class="small muted">Market</span>
          </div>
          <div class="small label center">Total check</div>
        </div>

        <div v-for="r in rows" :key="r.id" class="row" :class="{ warn: r.warnings.length > 0 }" :data-company="r.id">
          <div class="company">
            <div class="company-name">
              <CompanyTag :company-id="r.id" />
              <span>{{ r.name }}</span>
            </div>
            <div v-if="!editMode" class="small muted">
              <span class="mono ink">{{ r.price }}</span> · acts {{ r.acts }}
            </div>
            <Select
              v-else
              class="president-picker"
              :model-value="r.company.president"
              :options="presidentOptions"
              option-label="label"
              option-value="value"
              placeholder="No president"
              :aria-label="`President of ${r.name}`"
              @update:model-value="(v: PlayerId | null) => emit('update', setPresident(game, r.id, v))"
            />
          </div>

          <div v-for="p in game.players" :key="p.id" class="cell" :data-holder="p.id">
            <template v-if="!editMode">
              <ShareCircle v-if="r.company.president === p.id" kind="president" :company-id="r.id" :code="p.code" />
              <ShareCircle
                v-for="n in r.company.holdings[p.id] ?? 0"
                :key="n"
                kind="share"
                :company-id="r.id"
                :code="p.code"
              />
              <span v-if="shares(r.company, p.id) === 0" class="none" aria-label="none">–</span>
            </template>
            <template v-else>
              <CountStepper
                :model-value="r.company.holdings[p.id] ?? 0"
                :label="`${r.name}, ${p.code}`"
                @update:model-value="(n) => emit('update', setHolding(game, r.id, p.id, n))"
              />
              <span v-if="r.company.president === p.id" class="plus-two small">
                <ShareCircle kind="president" :company-id="r.id" :code="p.code" />+2 card
              </span>
            </template>
          </div>

          <div class="cell" data-holder="treasury">
            <template v-if="!editMode">
              <ShareCircle v-for="n in r.company.treasuryShares" :key="n" kind="treasury" />
              <span v-if="r.company.treasuryShares === 0" class="none" aria-label="none">–</span>
            </template>
            <CountStepper
              v-else
              :model-value="r.company.treasuryShares"
              :label="`${r.name}, treasury`"
              @update:model-value="(n) => emit('update', setTreasuryShares(game, r.id, n))"
            />
          </div>

          <div class="cell" data-holder="market">
            <template v-if="!editMode">
              <ShareCircle v-for="n in r.company.marketShares" :key="n" kind="market" />
              <span v-if="r.company.marketShares === 0" class="none" aria-label="none">–</span>
            </template>
            <CountStepper
              v-else
              :model-value="r.company.marketShares"
              :label="`${r.name}, market`"
              @update:model-value="(n) => emit('update', setMarketShares(game, r.id, n))"
            />
          </div>

          <div class="check">
            <div class="sum" :class="r.total === r.expected ? 'ok' : 'bad'">
              <i :class="r.total === r.expected ? 'pi pi-check' : 'pi pi-exclamation-triangle'" aria-hidden="true" />
              <span class="mono">{{ r.total }}/{{ r.expected }}</span>
            </div>
            <div v-for="message in r.warnings" :key="message" class="warning small">{{ message }}</div>
            <button
              v-if="r.candidate"
              type="button"
              class="transfer"
              data-testid="transfer"
              @click="transfer(r.id, r.candidate)"
            >
              Transfer presidency to {{ r.candidateCode }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="legend small">
      <span><ShareCircle kind="share" company-id="express" code="H" />Share, letter is the holder</span>
      <span><ShareCircle kind="president" company-id="express" code="H" />President card, counts as 2 shares</span>
      <span><ShareCircle kind="treasury" />In company treasury</span>
      <span><ShareCircle kind="market" />In the market</span>
    </div>
  </section>
</template>

<style scoped>
.ownership {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.scroll {
  overflow-x: auto;
}
.table {
  --col: 72px;
  min-width: calc(164px + var(--cols) * var(--col) + 108px);
}
/* 120px fits a 118px stepper. 4 players plus treasury and market then fit a 1024px tablet. */
.table.editing {
  --col: 120px;
}
.row {
  display: grid;
  grid-template-columns: 164px repeat(var(--cols), minmax(var(--col), 1fr)) 108px;
  align-items: center;
  min-height: 84px;
  border-top: 1px solid var(--line);
}
.row.head {
  min-height: 64px;
  border-top: 0;
  background: var(--head);
}
.row.warn {
  background: var(--amber-bg);
}
.label {
  font-weight: 600;
  color: var(--muted);
}
.center {
  text-align: center;
}
.company {
  min-width: 0;
  padding: 6px 8px 6px 12px;
}
.company-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 4px;
}
.company-name span:last-child {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ink {
  color: var(--ink);
}
.president-picker {
  width: 100%;
  min-height: 44px;
}
.col-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.cell {
  align-self: stretch;
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px 4px;
  border-left: 1px solid var(--bg);
}
.editing .cell {
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
}
.none {
  color: var(--faint);
}
.plus-two {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.check {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px;
  text-align: center;
}
.sum {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}
.sum.ok {
  color: var(--primary);
}
.sum.bad,
.warning {
  color: var(--amber-ink);
  font-weight: 600;
}
.transfer {
  min-height: 44px;
  padding: 4px 8px;
  border: 1px solid var(--amber);
  border-radius: 8px;
  background: var(--card);
  color: var(--amber-ink);
  font-size: 12px;
  line-height: 14px;
  font-weight: 700;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  color: var(--ink-2);
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 719px) {
  .ownership {
    padding: 8px;
  }
}
</style>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/views/OwnershipView.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/views
git commit -m "feat: add ownership view with edit mode and presidency transfer"
```

---

### Task 15: Scoreboard view

Boards: `Scoreboard.dc.html` (tablet), `ScoreboardPhone.dc.html` (phone, 5 players).

**Files:**
- Create: `src/views/ScoreboardView.vue`
- Test: `src/views/ScoreboardView.test.ts`

**Interfaces:**
- Consumes: `ranking`, `tieNotes`, `turnOrder`, `playerTotal` from `scoring.ts`; `shares`, `validate` from `shares.ts`; `setCash` from `edit.ts`; `priceOf` from `track.ts`; `displayName` from `companies.ts`; `PlayerCode`, `CompanyTag`.
- Produces: `<ScoreboardView :game @update="(game: Game) => ..." />`.

Behavior:
- A ranked strip on top: one card per player in ranking order, with rank, code, total and a note. Cards have `data-rank-card="<playerId>"`.
- A table with players as columns, in seating order. Rows: Cash, one row per active company in turn order, Total. Cells have `data-player="<playerId>"`.
- Cash is always editable (PrimeVue `InputNumber`). It commits on blur or Enter, so one edit is one undo step. A cleared field becomes 0.
- The columns of the rank 1 players have the class `lead`.
- Each sentence from `tieNotes` is shown under the table.

- [ ] **Step 1: Write the failing test**

**`src/views/ScoreboardView.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ScoreboardView from './ScoreboardView.vue'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const [J, K, L] = ['p1', 'p2', 'p3']

function withCash(game: Game, cash: number[]): Game {
  return { ...game, players: game.players.map((p, i) => ({ ...p, cash: cash[i] })) }
}

/** Spec D3 test 5: J has 100 cash, 3 shares of Express at 80 and 1 share of Union at 60. */
function sample(): Game {
  let g = withCash(testGame(), [100, 0])
  g = put(g, 'express', { price: 80, president: J, holdings: { [J]: 1 }, treasury: 2 })
  g = put(g, 'union', { price: 60, president: K, holdings: { [J]: 1 }, treasury: 7 })
  return g
}

const view = (game: Game) => mount(ScoreboardView, { props: { game } })
const cell = (w: VueWrapper, rowSelector: string, player: string) =>
  w.get(`${rowSelector} [data-player="${player}"]`)
const lastUpdate = (w: VueWrapper) => {
  const events = w.emitted('update')
  if (!events) throw new Error('update was not emitted')
  return events[events.length - 1][0] as Game
}

describe('ScoreboardView', () => {
  it('shows each total (spec D3 test 5)', () => {
    const w = view(sample())
    expect(cell(w, '[data-row="total"]', J).text()).toBe('400')
    expect(cell(w, '[data-row="total"]', K).text()).toBe('120')
  })

  it('shows shares times price with the count and the price', () => {
    const w = view(sample())
    expect(cell(w, '[data-row="express"]', J).text()).toContain('240')
    expect(cell(w, '[data-row="express"]', J).text()).toContain('3 × 80')
    expect(cell(w, '[data-row="express"]', K).text()).toBe('–')
    expect(cell(w, '[data-row="union"]', K).text()).toContain('2 × 60')
  })

  it('lists company rows in turn order', () => {
    const rows = view(sample()).findAll('[data-row]').map((r) => r.attributes('data-row'))
    expect(rows).toEqual(['cash', 'express', 'union', 'total'])
  })

  it('ranks the players and highlights the leader', () => {
    const w = view(sample())
    const cards = w.findAll('[data-rank-card]')
    expect(cards.map((c) => c.attributes('data-rank-card'))).toEqual([J, K])
    expect(cards[0].text()).toContain('1')
    expect(cards[0].text()).toContain('400')
    expect(cards[0].text()).toContain('Leader')
    expect(cards[0].classes()).toContain('lead')
    expect(cards[1].classes()).not.toContain('lead')
    expect(cell(w, '[data-row="total"]', J).classes()).toContain('lead')
    expect(cell(w, '[data-row="total"]', K).classes()).not.toContain('lead')
  })

  it('names the tie-break rule when it decides the order (spec D3 test 6)', () => {
    let g = withCash(testGame(), [40, 0])
    g = put(g, 'tunneling', { price: 70, president: J, treasury: 3 })
    g = put(g, 'express', { price: 90, president: K, treasury: 3 })
    const w = view(g)
    expect(w.findAll('[data-rank-card]').map((c) => c.attributes('data-rank-card'))).toEqual([K, J])
    expect(w.get('[data-rank-card="p2"]').text()).toContain('Leader, won the tie-break')
    expect(w.text()).toContain('K ranks higher: K is president of Express, which acts before Tunneling')
  })

  it('shows the same rank for players that stay tied', () => {
    const w = view(withCash(testGame(['J', 'K', 'L']), [100, 50, 100]))
    expect(w.get(`[data-rank-card="${J}"] .rank`).text()).toBe('1')
    expect(w.get(`[data-rank-card="${L}"] .rank`).text()).toBe('1')
    expect(w.get(`[data-rank-card="${K}"] .rank`).text()).toBe('3')
    expect(w.text()).toContain('Neither is president of a company, so they stay tied.')
  })

  it('commits a cash edit as one update', () => {
    const w = view(sample())
    const inputs = w.findAllComponents({ name: 'InputNumber' })
    expect(inputs).toHaveLength(2)
    inputs[1].vm.$emit('update:modelValue', 275)
    expect(lastUpdate(w).players.map((p) => p.cash)).toEqual([100, 275])
    expect(w.emitted('update')).toHaveLength(1)
  })

  // Review Focus 1.
  it('turns a cleared cash field into 0', () => {
    const w = view(sample())
    w.findAllComponents({ name: 'InputNumber' })[0].vm.$emit('update:modelValue', null)
    expect(lastUpdate(w).players[0].cash).toBe(0)
  })

  it('flags negative cash', () => {
    const w = view(withCash(testGame(), [-20, 0]))
    expect(cell(w, '[data-row="cash"]', J).text()).toContain('Negative')
    expect(cell(w, '[data-row="cash"]', K).text()).not.toContain('Negative')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/views/ScoreboardView.test.ts`
Expected: FAIL, `./ScoreboardView.vue` cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/views/ScoreboardView.vue`** (full file)
```vue
<script setup lang="ts">
import { computed } from 'vue'
import InputNumber from 'primevue/inputnumber'
import CompanyTag from '../components/CompanyTag.vue'
import PlayerCode from '../components/PlayerCode.vue'
import { displayName } from '../domain/companies'
import { setCash } from '../domain/edit'
import { ranking, tieNotes, turnOrder } from '../domain/scoring'
import { shares, validate } from '../domain/shares'
import { priceOf } from '../domain/track'
import type { Game, PlayerId } from '../domain/types'

const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ update: [game: Game] }>()

const ranks = computed(() => ranking(props.game))
const notes = computed(() => tieNotes(props.game))
const leaders = computed(() => new Set(ranks.value.filter((r) => r.rank === 1).map((r) => r.playerId)))
const totals = computed(() => new Map(ranks.value.map((r) => [r.playerId, r.total])))
const negative = computed(
  () => new Set(validate(props.game).filter((w) => w.code === 'negative-cash').map((w) => w.playerId)),
)

const cards = computed(() =>
  ranks.value.map((r, i) => {
    const player = props.game.players.find((p) => p.id === r.playerId)!
    const next = ranks.value[i + 1]
    let note = player.name
    if (r.rank === 1) note = leaders.value.size > 1 ? 'Tied for the lead' : 'Leader'
    // A player who is ahead of another player with the same total won the tie-break.
    if (r.tieBreakApplied && next && next.total === r.total && next.rank !== r.rank) {
      note = r.rank === 1 ? 'Leader, won the tie-break' : 'Won the tie-break'
    }
    return { ...r, player, note }
  }),
)

const companyRows = computed(() =>
  turnOrder(props.game).map((id) => {
    const company = props.game.companies[id]
    const price = priceOf(props.game, id) ?? 0
    return {
      id,
      name: displayName(company),
      price,
      cells: props.game.players.map((p) => ({ playerId: p.id, count: shares(company, p.id) })),
    }
  }),
)

const lead = (id: PlayerId) => ({ lead: leaders.value.has(id) })
</script>

<template>
  <section class="scoreboard" :style="{ '--players': game.players.length }">
    <div class="ranked">
      <div
        v-for="c in cards"
        :key="c.playerId"
        class="rank-card"
        :class="{ lead: c.rank === 1 }"
        :data-rank-card="c.playerId"
      >
        <span class="mono rank">{{ c.rank }}</span>
        <PlayerCode :code="c.player.code" :size="36" />
        <div class="rank-text">
          <div class="mono rank-total">{{ c.total }}</div>
          <div class="small note-text">{{ c.note }}</div>
        </div>
      </div>
    </div>

    <div class="table card">
      <div class="row head">
        <div class="label small strong">Seating order</div>
        <div v-for="p in game.players" :key="p.id" class="cell player-head" :class="lead(p.id)">
          <span class="small muted player-name">{{ p.name }}</span>
          <PlayerCode :code="p.code" />
        </div>
      </div>

      <div class="row cash" data-row="cash">
        <div class="label">
          <div class="strong">Cash</div>
          <div class="small muted hint">Tap a value to edit</div>
        </div>
        <div v-for="p in game.players" :key="p.id" class="cell" :class="lead(p.id)" :data-player="p.id">
          <InputNumber
            :model-value="p.cash"
            :use-grouping="false"
            :aria-label="`Cash of ${p.name}`"
            input-class="mono cash-input"
            @update:model-value="(v) => emit('update', setCash(game, p.id, v))"
          />
          <span v-if="negative.has(p.id)" class="small negative">Negative</span>
        </div>
      </div>

      <div v-for="r in companyRows" :key="r.id" class="row" :data-row="r.id">
        <div class="label company">
          <CompanyTag :company-id="r.id" />
          <span class="strong company-name">{{ r.name }}</span>
          <span class="mono small muted">@{{ r.price }}</span>
        </div>
        <div v-for="c in r.cells" :key="c.playerId" class="cell" :class="lead(c.playerId)" :data-player="c.playerId">
          <template v-if="c.count > 0">
            <span class="mono value">{{ c.count * r.price }}</span>
            <span class="mono small muted sub">{{ c.count }} × {{ r.price }}</span>
          </template>
          <span v-else class="mono value none">–</span>
        </div>
      </div>

      <div class="row total" data-row="total">
        <div class="label strong">Total value</div>
        <div v-for="p in game.players" :key="p.id" class="cell" :class="lead(p.id)" :data-player="p.id">
          <span class="mono total-value">{{ totals.get(p.id) }}</span>
        </div>
      </div>
    </div>

    <p v-for="note in notes" :key="note" class="note tie-note">
      <i class="pi pi-info-circle" aria-hidden="true" />
      <span>{{ note }}</span>
    </p>
  </section>
</template>

<style scoped>
.scoreboard {
  --label: 220px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px 16px;
}
.strong {
  font-weight: 600;
}
.ranked {
  display: grid;
  grid-template-columns: repeat(var(--players), minmax(0, 1fr));
  gap: 12px;
}
.rank-card {
  min-height: 84px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border: 1px solid var(--line-2);
  border-radius: 12px;
  background: var(--card);
}
.rank-card.lead {
  border: 2px solid var(--primary);
  background: var(--lead);
}
.rank {
  width: 22px;
  font-size: 28px;
  line-height: 32px;
}
.rank-text {
  min-width: 0;
}
.rank-total {
  font-size: 24px;
  line-height: 28px;
}
.note-text {
  color: var(--ink-2);
}
.row {
  display: grid;
  grid-template-columns: var(--label) repeat(var(--players), minmax(0, 1fr));
  align-items: stretch;
  min-height: 52px;
  border-top: 1px solid var(--line);
}
.row.head {
  min-height: 56px;
  border-top: 0;
  background: var(--head);
}
.row.cash,
.row.total {
  min-height: 60px;
}
.row.total {
  border-top: 2px solid var(--ink);
}
.label {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 16px;
}
.label.company {
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
}
.company-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.head .label {
  color: var(--muted);
}
.cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  padding: 4px 16px;
}
.cell.lead {
  background: var(--lead);
}
.player-head {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.cell :deep(.cash-input) {
  width: 112px;
  max-width: 100%;
  min-height: 44px;
  text-align: right;
  font-size: 16px;
}
.negative {
  color: var(--amber-ink);
  font-weight: 600;
}
.value {
  font-size: 18px;
  line-height: 22px;
}
.sub {
  line-height: 14px;
  font-weight: 500;
}
.none {
  color: var(--faint);
}
.total-value {
  font-size: 24px;
}
.tie-note {
  margin: 0;
  background: var(--card);
  border: 1px solid var(--line-2);
  font-size: 14px;
  line-height: 20px;
}

@media (max-width: 719px) {
  .scoreboard {
    --label: 84px;
    gap: 8px;
    padding: 8px;
  }
  .ranked {
    grid-template-columns: 1fr;
    gap: 0;
    border: 1px solid var(--line-2);
    border-radius: 12px;
    overflow: hidden;
  }
  .rank-card,
  .rank-card.lead {
    min-height: 40px;
    padding: 2px 12px;
    border: 0;
    border-top: 1px solid var(--bg);
    border-radius: 0;
  }
  .rank {
    width: 18px;
    font-size: 16px;
  }
  .rank-text {
    flex: 1;
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
    justify-content: space-between;
  }
  .rank-total {
    font-size: 16px;
  }
  .label,
  .cell {
    padding: 4px 6px;
  }
  .label.company {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 2px;
  }
  .company-name,
  .player-name,
  .hint {
    display: none;
  }
  .player-head {
    justify-content: center;
  }
  .cell :deep(.cash-input) {
    width: 100%;
    padding: 0 6px;
    font-size: 14px;
  }
  .value {
    font-size: 15px;
    line-height: 20px;
  }
  .total-value {
    font-size: 16px;
  }
}
</style>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/views/ScoreboardView.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/views
git commit -m "feat: add scoreboard view with ranking and tie-break notes"
```

---

### Task 16: Merge wizard

Boards: `MergeSelect.dc.html`, `MergeMajor.dc.html`, `MergePreview.dc.html`, `MergeChoice.dc.html`.

**Files:**
- Create: `src/dialogs/MergeWizard.vue`
- Test: `src/dialogs/MergeWizard.test.ts`

**Interfaces:**
- Consumes: `activeMinors`, `mergePlan`, `applyMerge`, `MergePlan` from `merge.ts`; `COMPANIES`, `MAJOR_IDS`, `displayName` from `companies.ts`; `shares`, `shareTotal` from `shares.ts`; `priceOf` from `track.ts`; `CompanyTag`, `PlayerCode`, `ShareCircle`.
- Produces: `<MergeWizard v-model:visible :game @merge="(game: Game) => ..." />`. It emits `merge` with the game after `applyMerge` and closes itself.

Behavior:
- PrimeVue `Stepper` with three steps: Minors, Major, Preview. The footer buttons move between steps.
- Step 1: the active minors in turn order. The user picks two; the first is marked A and the second B. Picking a third replaces B.
- Step 2: six major cards. A major that has already started is disabled. A major with two names has a toggle that changes the name only.
- Step 3: the new president with the reason, the new price with the working, and the conversion table. When the rules cannot decide, a required choice between the tied players appears and "Confirm merge" stays disabled until one is picked.

- [ ] **Step 1: Write the failing test**

**`src/dialogs/MergeWizard.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MergeWizard from './MergeWizard.vue'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const [J, K] = ['p1', 'p2']

/** Spec D3 test 7. */
function test7(): Game {
  let g = put(testGame(), 'tunneling', { price: 70, president: J, holdings: { [K]: 1 }, treasury: 1, market: 1 })
  g = put(g, 'express', { price: 80, president: K, holdings: { [J]: 1, [K]: 1 }, treasury: 1 })
  return g
}

/** The MergeChoice board: the tied players preside over neither minor. */
function choiceGame(): Game {
  let g = testGame(['Haoran', 'Ari', 'John', 'James'])
  g = put(g, 'resourceful', { price: 60, president: 'p1', holdings: { p3: 3 } })
  g = put(g, 'express', { price: 110, president: 'p2', holdings: { p4: 3 } })
  return g
}

const open = (game: Game) => mount(MergeWizard, { props: { visible: true, game } })
const next = (w: VueWrapper) => w.get('[data-testid="next"]')
const confirm = (w: VueWrapper) => w.get('[data-testid="confirm-merge"]')
const isDisabled = (b: ReturnType<VueWrapper['get']>) => b.attributes('disabled') !== undefined

async function toPreview(w: VueWrapper, a: string, b: string, major: string) {
  await w.get(`[data-testid="minor-${a}"]`).trigger('click')
  await w.get(`[data-testid="minor-${b}"]`).trigger('click')
  await next(w).trigger('click')
  await w.get(`[data-testid="major-${major}"]`).trigger('click')
  await next(w).trigger('click')
}

function merged(w: VueWrapper): Game {
  const events = w.emitted('merge')
  if (!events) throw new Error('merge was not emitted')
  return events[0][0] as Game
}

describe('MergeWizard', () => {
  it('lists active minors in turn order and needs two of them', async () => {
    const w = open(put(test7(), 'union', { price: 100, president: J, treasury: 8 }))
    const ids = w.findAll('[data-testid^="minor-"]').map((b) => b.attributes('data-testid'))
    expect(ids).toEqual(['minor-express', 'minor-tunneling'])
    expect(isDisabled(next(w))).toBe(true)
    await w.get('[data-testid="minor-express"]').trigger('click')
    expect(isDisabled(next(w))).toBe(true)
    await w.get('[data-testid="minor-tunneling"]').trigger('click')
    expect(isDisabled(next(w))).toBe(false)
    expect(w.get('[data-testid="minor-express"]').text()).toContain('A')
    expect(w.get('[data-testid="minor-tunneling"]').text()).toContain('B')
  })

  it('disables a major that has already started', async () => {
    const w = open(put(test7(), 'union', { price: 100, president: J, treasury: 8 }))
    await w.get('[data-testid="minor-express"]').trigger('click')
    await w.get('[data-testid="minor-tunneling"]').trigger('click')
    await next(w).trigger('click')
    expect(isDisabled(w.get('[data-testid="major-union"]'))).toBe(true)
    expect(isDisabled(w.get('[data-testid="major-system"]'))).toBe(false)
    expect(isDisabled(next(w))).toBe(true)
  })

  it('previews and applies a merge (spec D3 test 7)', async () => {
    const w = open(test7())
    await toPreview(w, 'tunneling', 'express', 'union')
    const preview = w.get('[data-testid="preview"]')
    expect(preview.get('[data-testid="new-president"]').text()).toContain('K')
    expect(preview.get('[data-testid="new-price"]').text()).toContain('70')
    expect(preview.text()).toContain('Average of 70 and 80 is 75, snapped down to 70')
    expect(preview.text()).toContain('K holds the most shares (4) and becomes president.')
    expect(preview.get('[data-testid="total-m"]').text()).toBe('10')

    await confirm(w).trigger('click')
    const game = merged(w)
    expect(game.companies.union).toMatchObject({ status: 'active', president: K, holdings: { [J]: 3, [K]: 2 } })
    expect(game.companies.tunneling.status).toBe('merged')
    expect(game.track[7]).toEqual(['union'])
    expect(w.emitted('update:visible')).toEqual([[false]])
  })

  it('explains a tie-break', async () => {
    let g = testGame(['Haoran', 'Ari', 'John', 'James'])
    g = put(g, 'tunneling', { price: 90, president: 'p4', holdings: { p2: 1 }, treasury: 1, market: 1 })
    g = put(g, 'agricultural', { price: 70, president: 'p2', holdings: { p4: 1 }, market: 2 })
    const w = open(g)
    await toPreview(w, 'tunneling', 'agricultural', 'federation')
    expect(w.get('[data-testid="preview"]').text()).toContain(
      'Ari and James tie at 3 shares. James is president of Tunneling, which acts before Agricultural, so James takes the presidency.',
    )
    expect(w.get('[data-testid="new-price"]').text()).toContain('Average of 90 and 70 is 80.')
  })

  it('requires a choice when the rules cannot decide (spec D3 test 8)', async () => {
    const w = open(choiceGame())
    await toPreview(w, 'resourceful', 'express', 'federation')
    expect(w.text()).toContain('John and James tie at 3 shares.')
    expect(w.text()).toContain('Choose the new president.')
    expect(isDisabled(confirm(w))).toBe(true)
    expect(w.findAll('[data-testid^="choose-"]').map((b) => b.attributes('data-testid'))).toEqual(['choose-p3', 'choose-p4'])

    await w.get('[data-testid="choose-p4"]').trigger('click')
    expect(isDisabled(confirm(w))).toBe(false)
    await confirm(w).trigger('click')
    expect(merged(w).companies.federation.president).toBe('p4')
    expect(merged(w).companies.federation.holdings).toEqual({ p1: 2, p2: 2, p3: 3, p4: 1 })
  })

  it('lets the user pick the second name of a major', async () => {
    const w = open(test7())
    await w.get('[data-testid="minor-tunneling"]').trigger('click')
    await w.get('[data-testid="minor-express"]').trigger('click')
    await next(w).trigger('click')
    expect(w.find('[data-testid="name-federation-1"]').exists()).toBe(false)
    await w.get('[data-testid="name-system-1"]').trigger('click')
    await w.get('[data-testid="major-system"]').trigger('click')
    expect(w.get('[data-testid="major-system"]').text()).toContain('Syndicate')
    await next(w).trigger('click')
    expect(w.get('[data-testid="preview"]').text()).toContain('Syndicate')
    await confirm(w).trigger('click')
    expect(merged(w).companies.system.identity).toBe(1)
  })

  it('goes back a step and keeps the choices', async () => {
    const w = open(test7())
    await toPreview(w, 'tunneling', 'express', 'union')
    await w.get('[data-testid="back"]').trigger('click')
    expect(w.get('[data-testid="major-union"]').attributes('aria-pressed')).toBe('true')
    await w.get('[data-testid="back"]').trigger('click')
    expect(w.get('[data-testid="minor-tunneling"]').attributes('aria-pressed')).toBe('true')
  })

  it('replaces B when a third minor is picked', async () => {
    const w = open(put(test7(), 'suburban', { price: 60, president: J, treasury: 3 }))
    await w.get('[data-testid="minor-express"]').trigger('click')
    await w.get('[data-testid="minor-tunneling"]').trigger('click')
    await w.get('[data-testid="minor-suburban"]').trigger('click')
    expect(w.get('[data-testid="minor-tunneling"]').attributes('aria-pressed')).toBe('false')
    expect(w.get('[data-testid="minor-suburban"]').text()).toContain('B')
  })

  // Review Focus 5.
  it('shows a total that is not 10 for broken share counts', async () => {
    let g = put(testGame(), 'tunneling', { price: 70, president: J, treasury: 2 })
    g = put(g, 'express', { price: 80, president: K, treasury: 3 })
    const w = open(g)
    await toPreview(w, 'tunneling', 'express', 'union')
    expect(w.get('[data-testid="total-m"]').text()).toBe('9')
    expect(w.get('[data-testid="total-m"]').classes()).toContain('bad')
    expect(w.text()).toContain('The shares do not total 10')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/dialogs/MergeWizard.test.ts`
Expected: FAIL, `./MergeWizard.vue` cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/dialogs/MergeWizard.vue`** (full file)
```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Step from 'primevue/step'
import StepList from 'primevue/steplist'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
import CompanyTag from '../components/CompanyTag.vue'
import PlayerCode from '../components/PlayerCode.vue'
import ShareCircle from '../components/ShareCircle.vue'
import { COMPANIES, MAJOR_IDS, displayName } from '../domain/companies'
import { activeMinors, applyMerge, mergePlan, type MergePlan } from '../domain/merge'
import { shareTotal, shares } from '../domain/shares'
import { priceOf } from '../domain/track'
import type { CompanyId, Game, PlayerId } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ merge: [game: Game] }>()

const step = ref('1')
const picked = ref<CompanyId[]>([])
const majorId = ref<CompanyId | null>(null)
/** Chosen name index per major. */
const identities = ref<Record<CompanyId, number>>({})
const chosen = ref<PlayerId | null>(null)

watch(
  visible,
  (open) => {
    if (!open) return
    step.value = '1'
    picked.value = []
    majorId.value = null
    identities.value = {}
    chosen.value = null
  },
  { immediate: true },
)

const player = (id: PlayerId) => props.game.players.find((p) => p.id === id)
const playerName = (id: PlayerId) => player(id)?.name ?? id
const playerCode = (id: PlayerId | null) => (id === null ? null : (player(id)?.code ?? null))
const companyName = (id: CompanyId) => displayName(props.game.companies[id])
const majorName = (id: CompanyId) => COMPANIES[id].names[identities.value[id] ?? 0]

const minors = computed(() =>
  activeMinors(props.game).map((id) => ({
    id,
    name: companyName(id),
    price: priceOf(props.game, id),
    presidentCode: playerCode(props.game.companies[id].president),
    mark: ['A', 'B'][picked.value.indexOf(id)] ?? '',
  })),
)

function toggleMinor(id: CompanyId) {
  const at = picked.value.indexOf(id)
  if (at !== -1) picked.value = picked.value.filter((x) => x !== id)
  else if (picked.value.length < 2) picked.value = [...picked.value, id]
  else picked.value = [picked.value[0], id]
  chosen.value = null
}

const majors = computed(() =>
  MAJOR_IDS.map((id) => ({
    id,
    names: COMPANIES[id].names,
    name: majorName(id),
    identity: identities.value[id] ?? 0,
    available: props.game.companies[id].status === 'unstarted',
  })),
)

function pickName(id: CompanyId, index: number) {
  identities.value = { ...identities.value, [id]: index }
}

const plan = computed<MergePlan | null>(() => {
  if (picked.value.length !== 2 || majorId.value === null) return null
  try {
    return mergePlan(props.game, picked.value[0], picked.value[1], majorId.value, {
      identity: identities.value[majorId.value] ?? 0,
      president: chosen.value ?? undefined,
    })
  } catch {
    return null
  }
})

const list = (ids: PlayerId[]) => {
  const names = ids.map(playerName)
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const reason = computed(() => {
  const p = plan.value
  if (!p) return ''
  const most = Math.max(...Object.values(p.shares))
  const tie = `${list(p.tiedPlayers)} tie at ${most} shares.`
  if (p.reason === 'most-shares' && p.newPresident) {
    return `${playerName(p.newPresident)} holds the most shares (${most}) and becomes president.`
  }
  if (p.reason === 'tie-break' && p.newPresident && p.decidingCompany) {
    const other = p.decidingCompany === p.aId ? p.bId : p.aId
    const name = playerName(p.newPresident)
    return `${tie} ${name} is president of ${companyName(p.decidingCompany)}, which acts before ${companyName(other)}, so ${name} takes the presidency.`
  }
  if (p.reason === 'chosen' && p.newPresident) return `${tie} You chose ${playerName(p.newPresident)}.`
  return `${tie} None of them is president of ${companyName(p.aId)} or ${companyName(p.bId)}, so the rules cannot decide. Choose the new president.`
})

const priceText = computed(() => {
  const p = plan.value
  if (!p) return ''
  const a = priceOf(props.game, p.aId) ?? 0
  const b = priceOf(props.game, p.bId) ?? 0
  const average = (a + b) / 2
  return `Average of ${a} and ${b} is ${average}${average === p.price ? '' : `, snapped down to ${p.price}`}.`
})

const table = computed(() => {
  const p = plan.value
  if (!p) return null
  const a = props.game.companies[p.aId]
  const b = props.game.companies[p.bId]
  return {
    players: props.game.players.map((pl) => ({
      id: pl.id,
      code: pl.code,
      name: pl.name,
      a: shares(a, pl.id),
      b: shares(b, pl.id),
      m: p.shares[pl.id],
      aPresident: a.president === pl.id,
      bPresident: b.president === pl.id,
      mPresident: p.newPresident === pl.id,
    })),
    treasury: { a: a.treasuryShares, b: b.treasuryShares, m: p.treasuryShares },
    market: { a: a.marketShares, b: b.marketShares, m: p.marketShares },
    total: { a: shareTotal(a), b: shareTotal(b), m: p.total },
  }
})

const dash = (n: number) => (n === 0 ? '–' : String(n))

const summary = computed(() => {
  if (step.value === '1') return picked.value.length === 0 ? 'Choose two minors' : picked.value.map(companyName).join(' + ')
  if (step.value === '2') return majorId.value === null ? 'Choose a major' : `${majorName(majorId.value)} (${COMPANIES[majorId.value].abbr})`
  return plan.value?.needsChoice ? 'Choose a president to continue' : ''
})

const canNext = computed(() => (step.value === '1' ? picked.value.length === 2 : majorId.value !== null))

function back() {
  if (step.value === '1') visible.value = false
  else step.value = String(Number(step.value) - 1)
}

function confirmMerge() {
  if (!plan.value || plan.value.needsChoice) return
  emit('merge', applyMerge(props.game, plan.value))
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Merge two minors into a major" :style="{ width: 'min(600px, 100vw)' }">
    <Stepper :value="step" linear>
      <StepList>
        <Step value="1">Minors</Step>
        <Step value="2">Major</Step>
        <Step value="3">Preview</Step>
      </StepList>
      <StepPanels>
        <StepPanel value="1">
          <div v-if="step === '1'" class="panel">
            <p class="lead-text">Choose two active minors. They are listed in turn order.</p>
            <button
              v-for="m in minors"
              :key="m.id"
              type="button"
              class="pick minor"
              :aria-pressed="m.mark !== ''"
              :data-testid="`minor-${m.id}`"
              @click="toggleMinor(m.id)"
            >
              <span class="mark" :class="{ on: m.mark !== '' }">{{ m.mark }}</span>
              <CompanyTag :company-id="m.id" />
              <span class="grow strong">{{ m.name }}</span>
              <span class="mono price">{{ m.price }}</span>
              <ShareCircle v-if="m.presidentCode !== null" kind="president" :company-id="m.id" :code="m.presidentCode" />
            </button>
          </div>
        </StepPanel>

        <StepPanel value="2">
          <div v-if="step === '2'" class="panel">
            <p class="lead-text">
              Choose the major that replaces {{ picked.map(companyName).join(' and ') }}. Where a major has two names,
              pick the one on your box.
            </p>
            <div class="majors">
              <div v-for="m in majors" :key="m.id" class="major" :class="{ on: majorId === m.id, off: !m.available }">
                <button
                  type="button"
                  class="major-main"
                  :aria-pressed="majorId === m.id"
                  :disabled="!m.available"
                  :data-testid="`major-${m.id}`"
                  @click="majorId = m.id"
                >
                  <CompanyTag :company-id="m.id" large />
                  <span class="grow major-name">{{ m.name }}</span>
                  <i v-if="majorId === m.id" class="pi pi-check tick" aria-hidden="true" />
                </button>
                <div v-if="!m.available" class="small muted one-name">Already in play</div>
                <div v-else-if="m.names.length > 1" class="names">
                  <button
                    v-for="(name, i) in m.names"
                    :key="name"
                    type="button"
                    :aria-pressed="m.identity === i"
                    :data-testid="`name-${m.id}-${i}`"
                    @click="pickName(m.id, i)"
                  >
                    {{ name }}
                  </button>
                </div>
                <div v-else class="small muted one-name">One name only</div>
              </div>
            </div>
          </div>
        </StepPanel>

        <StepPanel value="3">
          <div v-if="step === '3' && plan && table && majorId" class="panel" data-testid="preview">
            <div class="equation strong">
              <CompanyTag :company-id="plan.aId" />{{ companyName(plan.aId) }}
              <span class="muted">+</span>
              <CompanyTag :company-id="plan.bId" />{{ companyName(plan.bId) }}
              <i class="pi pi-arrow-right" aria-hidden="true" />
              <CompanyTag :company-id="majorId" />{{ majorName(majorId) }}
            </div>

            <p class="note" :class="{ warn: plan.needsChoice }">
              <i :class="plan.needsChoice ? 'pi pi-exclamation-triangle' : 'pi pi-info-circle'" aria-hidden="true" />
              <span>{{ reason }}</span>
            </p>

            <div v-if="plan.reason === 'needs-choice' || plan.reason === 'chosen'" class="choice">
              <span class="field-label">New president, required</span>
              <div class="choices" role="radiogroup">
                <button
                  v-for="id in plan.tiedPlayers"
                  :key="id"
                  type="button"
                  role="radio"
                  class="pick choose"
                  :aria-checked="chosen === id"
                  :data-testid="`choose-${id}`"
                  @click="chosen = id"
                >
                  <span class="radio" :class="{ on: chosen === id }" />
                  <PlayerCode :code="playerCode(id) ?? ''" :size="32" />
                  <span class="grow">
                    {{ playerName(id) }}
                    <span class="small muted block">{{ plan.shares[id] }} shares</span>
                  </span>
                </button>
              </div>
            </div>

            <div class="cards">
              <div class="result lead" data-testid="new-president">
                <ShareCircle
                  v-if="plan.newPresident"
                  kind="president"
                  :company-id="majorId"
                  :code="playerCode(plan.newPresident) ?? ''"
                  large
                />
                <div>
                  <div class="small strong">New president</div>
                  <div class="strong big-name">{{ plan.newPresident ? playerName(plan.newPresident) : 'Not chosen' }}</div>
                </div>
              </div>
              <div class="result" data-testid="new-price">
                <span class="mono big">{{ plan.price }}</span>
                <div>
                  <div class="small strong">New price</div>
                  <div class="small muted">{{ priceText }}</div>
                </div>
              </div>
            </div>

            <div class="table">
              <div class="trow thead small">
                <span>Shares held</span>
                <span class="num">{{ companyName(plan.aId) }}</span>
                <span class="num">{{ companyName(plan.bId) }}</span>
                <span class="num">{{ majorName(majorId) }}</span>
              </div>
              <div v-for="r in table.players" :key="r.id" class="trow" :class="{ faint: r.m === 0 }">
                <span class="who"><PlayerCode :code="r.code" :size="24" />{{ r.name }}</span>
                <span class="num mono">
                  <ShareCircle v-if="r.aPresident" kind="president" :company-id="plan.aId" :code="r.code" />{{ dash(r.a) }}
                </span>
                <span class="num mono">
                  <ShareCircle v-if="r.bPresident" kind="president" :company-id="plan.bId" :code="r.code" />{{ dash(r.b) }}
                </span>
                <span class="num mono strong">
                  <ShareCircle v-if="r.mPresident" kind="president" :company-id="majorId" :code="r.code" />{{ dash(r.m) }}
                </span>
              </div>
              <div class="trow">
                <span class="who"><ShareCircle kind="treasury" />Treasury</span>
                <span class="num mono">{{ dash(table.treasury.a) }}</span>
                <span class="num mono">{{ dash(table.treasury.b) }}</span>
                <span class="num mono strong">{{ dash(table.treasury.m) }}</span>
              </div>
              <div class="trow">
                <span class="who"><ShareCircle kind="market" />Market</span>
                <span class="num mono">{{ dash(table.market.a) }}</span>
                <span class="num mono">{{ dash(table.market.b) }}</span>
                <span class="num mono strong">{{ dash(table.market.m) }}</span>
              </div>
              <div class="trow tfoot">
                <span class="strong">Total</span>
                <span class="num mono">{{ table.total.a }}</span>
                <span class="num mono">{{ table.total.b }}</span>
                <span class="num mono" :class="{ bad: table.total.m !== 10 }" data-testid="total-m">{{ table.total.m }}</span>
              </div>
            </div>

            <p v-if="table.total.m !== 10" class="note warn">
              <i class="pi pi-exclamation-triangle" aria-hidden="true" />
              <span>The shares do not total 10. You can still merge and fix the counts in edit mode.</span>
            </p>
            <p class="small muted">
              {{ majorName(majorId) }} joins the back of the {{ plan.price }} queue. {{ companyName(plan.aId) }} and
              {{ companyName(plan.bId) }} leave the track. This is one undoable step.
            </p>
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>

    <template #footer>
      <div class="dialog-footer">
        <span class="grow" :class="{ 'need-choice': step === '3' && plan?.needsChoice }">{{ summary }}</span>
        <Button :label="step === '1' ? 'Cancel' : 'Back'" severity="secondary" outlined data-testid="back" @click="back" />
        <Button
          v-if="step !== '3'"
          label="Next"
          :disabled="!canNext"
          data-testid="next"
          @click="step = String(Number(step) + 1)"
        />
        <Button
          v-else
          label="Confirm merge"
          :disabled="!plan || plan.needsChoice"
          data-testid="confirm-merge"
          @click="confirmMerge"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lead-text {
  margin: 0;
  color: var(--ink-2);
}
.strong {
  font-weight: 600;
}
.grow {
  flex: 1;
}
.block {
  display: block;
}
.minor {
  min-height: 56px;
  gap: 12px;
  border-radius: 10px;
}
.mark {
  flex: none;
  width: 28px;
  height: 28px;
  border: 2px solid var(--faint);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 24px;
  text-align: center;
}
.mark.on {
  border-color: var(--ink);
  border-radius: 50%;
  background: var(--ink);
}
.price {
  width: 44px;
  text-align: right;
  font-size: 16px;
}
.majors {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.major {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--line-3);
  border-radius: 12px;
  background: var(--card);
}
.major.on {
  border: 2px solid var(--primary);
  padding: 7px;
  background: var(--lead);
}
.major.off {
  opacity: 0.5;
}
.major-main {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 6px;
  border: 0;
  background: transparent;
  color: var(--ink);
  text-align: left;
}
.major-main:disabled {
  cursor: default;
}
.major-name {
  font-size: 16px;
  font-weight: 600;
}
.tick {
  color: var(--primary);
}
.names {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--line-2);
  border-radius: 10px;
  background: var(--bg);
}
.names button {
  flex: 1;
  min-height: 38px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
}
.names button[aria-pressed='true'] {
  background: var(--card);
  box-shadow: 0 1px 3px rgba(24, 24, 27, 0.2);
  color: var(--ink);
  font-weight: 600;
}
.one-name {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 8px;
}
.equation {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.note {
  margin: 0;
}
.choice {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.choose {
  flex: 1;
  min-height: 60px;
  gap: 12px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
}
.radio {
  flex: none;
  width: 24px;
  height: 24px;
  border: 2px solid var(--faint);
  border-radius: 50%;
}
.radio.on {
  border: 7px solid var(--primary);
}
.cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line-2);
  border-radius: 12px;
}
.result.lead {
  border: 2px solid var(--primary);
  background: var(--lead);
}
.big {
  font-size: 32px;
  line-height: 36px;
}
.big-name {
  font-size: 16px;
}
.table {
  border: 1px solid var(--line-2);
  border-radius: 12px;
  overflow: hidden;
}
.trow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 96px 108px;
  align-items: center;
  min-height: 38px;
  padding: 0 12px;
  border-top: 1px solid var(--bg);
}
.trow.thead {
  min-height: 36px;
  border-top: 0;
  background: var(--head);
  font-weight: 600;
  color: var(--muted);
}
.trow.tfoot {
  border-top: 2px solid var(--ink);
  font-weight: 600;
}
.trow.faint {
  color: var(--faint);
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.num {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  text-align: right;
}
.thead .num {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.bad,
.need-choice {
  color: var(--amber-ink);
  font-weight: 600;
}
@media (max-width: 519px) {
  .majors,
  .cards {
    grid-template-columns: 1fr;
  }
  .trow {
    grid-template-columns: minmax(0, 1fr) 64px 64px 72px;
  }
}
</style>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/dialogs/MergeWizard.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/dialogs
git commit -m "feat: add merge wizard"
```

---

### Task 17: Saved games list and settings dialog

**Files:**
- Create: `src/state/download.ts`, `src/components/SavesList.vue`, `src/dialogs/SettingsDialog.vue`
- Test: `src/components/SavesList.test.ts`, `src/dialogs/SettingsDialog.test.ts`

**Interfaces:**
- Consumes: `Saves`, `exportGame`, `exportFileName`, `ImportError` from `saves.ts`; `memoryStorage`; `setPhase`, `setMainView`, `renameGame`, `setShortGame`, `canChangeShortGame` from `edit.ts`; `PHASE_LABEL` from `format.ts`.
- Produces:
  - `downloadText(filename: string, text: string): void` saves a text file from the browser.
  - `<SavesList :saves :current-id @open="(id) => ..." @rename="(id, name) => ..." @remove="(id) => ..." />`. It lists `saves.index` in a PrimeVue `DataTable`. Duplicate, export and import run inside the component. Open, rename and remove are emitted, because the shell must also update the open game.
  - `<SettingsDialog v-model:visible :game :edit-mode @update="(game: Game) => ..." />`.

- [ ] **Step 1: Write the failing tests**

**`src/components/SavesList.test.ts`** (full file)
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SavesList from './SavesList.vue'
import { createSaves, exportGame } from '../state/saves'
import { memoryStorage } from '../state/memoryStorage'
import { testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const confirmRequire = vi.fn()
const toastAdd = vi.fn()
const downloadText = vi.fn()
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }))
vi.mock('../state/download', () => ({ downloadText: (...args: unknown[]) => downloadText(...args) }))

const game = (id: string, name: string): Game => ({ ...testGame(['Haoran', 'Ari']), id, name })

function setup() {
  const saves = createSaves(memoryStorage())
  saves.write({ schemaVersion: 1, game: game('g1', 'Friday game'), undo: [], redo: [] })
  saves.write({ schemaVersion: 1, game: game('g2', 'Sunday game'), undo: [], redo: [] })
  const w = mount(SavesList, { props: { saves, currentId: 'g1' } })
  return { saves, w }
}

const rowOf = (w: VueWrapper, id: string) => w.get(`[data-save="${id}"]`).element.closest('tr')!
const action = (w: VueWrapper, id: string, label: string) => w.get(`[data-save="${id}"] ~ * [aria-label="${label}"], [aria-label="${label} ${id}"]`)

async function importFile(w: VueWrapper, text: string) {
  const input = w.get('input[type="file"]')
  const file = new File([text], 'game.json', { type: 'application/json' })
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

beforeEach(() => {
  confirmRequire.mockReset()
  toastAdd.mockReset()
  downloadText.mockReset()
})

describe('SavesList', () => {
  it('lists saved games, most recent first, and marks the open one', () => {
    const { w } = setup()
    expect(w.findAll('[data-save]').map((e) => e.attributes('data-save'))).toEqual(['g2', 'g1'])
    expect(rowOf(w, 'g1').textContent).toContain('Friday game')
    expect(rowOf(w, 'g1').textContent).toContain('Haoran, Ari')
    expect(rowOf(w, 'g1').textContent).toContain('Open now')
    expect(rowOf(w, 'g2').textContent).not.toContain('Open now')
  })

  it('emits open', async () => {
    const { w } = setup()
    await action(w, 'g2', 'Open').trigger('click')
    expect(w.emitted('open')).toEqual([['g2']])
  })

  it('duplicates a game', async () => {
    const { w, saves } = setup()
    await action(w, 'g2', 'Duplicate').trigger('click')
    expect(saves.index.value).toHaveLength(3)
    expect(w.text()).toContain('Sunday game copy')
  })

  it('exports a game as a file', async () => {
    const { w } = setup()
    await action(w, 'g1', 'Export').trigger('click')
    expect(downloadText).toHaveBeenCalledWith('friday-game.lost-atlas.json', exportGame(game('g1', 'Friday game')))
  })

  it('emits remove after a confirm', async () => {
    const { w } = setup()
    await action(w, 'g2', 'Delete').trigger('click')
    expect(w.emitted('remove')).toBeUndefined()
    expect(confirmRequire.mock.calls[0][0].message).toContain('Sunday game')
    confirmRequire.mock.calls[0][0].accept()
    expect(w.emitted('remove')).toEqual([['g2']])
  })

  it('emits rename with the new name', async () => {
    const { w } = setup()
    await action(w, 'g2', 'Rename').trigger('click')
    await w.get('[data-testid="rename-input"]').setValue('Monday game')
    await w.get('[data-testid="rename-save"]').trigger('click')
    expect(w.emitted('rename')).toEqual([['g2', 'Monday game']])
  })

  it('imports a file as a new saved game', async () => {
    const { w, saves } = setup()
    await importFile(w, exportGame(game('g9', 'Imported game')))
    expect(saves.index.value.map((e) => e.name)).toContain('Imported game')
    expect(toastAdd.mock.calls[0][0]).toMatchObject({ severity: 'success' })
  })

  // Review Focus 3.
  it('shows a clear message for a bad file and changes nothing', async () => {
    const { w, saves } = setup()
    await importFile(w, 'this is not json')
    expect(saves.index.value).toHaveLength(2)
    expect(toastAdd.mock.calls[0][0]).toMatchObject({ severity: 'error', detail: 'This file is not valid JSON.' })
  })

  it('shows an empty state', () => {
    const w = mount(SavesList, { props: { saves: createSaves(memoryStorage()), currentId: null } })
    expect(w.text()).toContain('No saved games yet')
  })
})
```

**`src/dialogs/SettingsDialog.test.ts`** (full file)
```ts
import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SettingsDialog from './SettingsDialog.vue'
import { put, testGame } from '../domain/fixtures'
import type { Game } from '../domain/types'

const open = (game: Game, editMode = false) => mount(SettingsDialog, { props: { visible: true, game, editMode } })
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

describe('SettingsDialog', () => {
  it('changes the phase', async () => {
    const w = open(testGame())
    await button(w, 'Green').trigger('click')
    expect(lastUpdate(w).settings.phase).toBe('green')
  })

  it('changes the default view', async () => {
    const w = open(testGame())
    await button(w, 'Scoreboard').trigger('click')
    expect(lastUpdate(w).settings.mainView).toBe('scoreboard')
  })

  it('renames the game when the field loses focus', async () => {
    const w = open(testGame())
    const input = w.get('[data-testid="settings-name"]')
    await input.setValue('Friday game')
    expect(w.emitted('update')).toBeUndefined()
    await input.trigger('blur')
    expect(lastUpdate(w).name).toBe('Friday game')
    await w.setProps({ game: lastUpdate(w) })
    await input.trigger('blur')
    expect(w.emitted('update')).toHaveLength(1)
  })

  it('keeps the old name when the field is left empty', async () => {
    const w = open(testGame())
    const input = w.get('[data-testid="settings-name"]')
    await input.setValue('   ')
    await input.trigger('blur')
    expect(w.emitted('update')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('Test')
  })

  it('locks the game length outside edit mode', () => {
    const w = open(testGame())
    expect(button(w, 'Short').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Turn on edit mode to change the game length')
  })

  it('changes the game length in edit mode before a company starts', async () => {
    const w = open(testGame(), true)
    await button(w, 'Short').trigger('click')
    expect(lastUpdate(w).settings.shortGame).toBe(true)
    expect(lastUpdate(w).companies.adaptive.status).toBe('unavailable')
  })

  it('locks the game length once a company has started', () => {
    const w = open(put(testGame(), 'express', { price: 80, president: 'p1', treasury: 3 }), true)
    expect(button(w, 'Short').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('fixed once a company has started')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/SavesList.test.ts src/dialogs/SettingsDialog.test.ts`
Expected: FAIL, the two components cannot be resolved.

- [ ] **Step 3: Write the implementation**

**`src/state/download.ts`** (full file)
```ts
/** Saves `text` as a file named `filename` from the browser. */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
```

**`src/components/SavesList.vue`** (full file)
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { downloadText } from '../state/download'
import { ImportError, exportFileName, exportGame, type SaveIndexEntry, type Saves } from '../state/saves'

const props = defineProps<{ saves: Saves; currentId: string | null }>()
const emit = defineEmits<{ open: [id: string]; rename: [id: string, name: string]; remove: [id: string] }>()

const confirm = useConfirm()
const toast = useToast()

const entries = computed(() => props.saves.index.value)
const fileInput = ref<HTMLInputElement | null>(null)
const renaming = ref<SaveIndexEntry | null>(null)
const renameOpen = ref(false)
const newName = ref('')

const when = (iso: string) => new Date(iso).toLocaleString()
const failed = (detail: string) => toast.add({ severity: 'error', summary: 'Saved games', detail, life: 6000 })

function duplicate(id: string) {
  if (props.saves.duplicate(id) === null) failed('This game could not be copied.')
}

function exportSave(id: string) {
  const save = props.saves.read(id)
  if (!save) return failed('This saved game could not be read.')
  downloadText(exportFileName(save.game), exportGame(save.game))
}

function askRemove(entry: SaveIndexEntry) {
  confirm.require({
    header: 'Delete saved game?',
    message: `${entry.name} and its undo history will be deleted. This cannot be undone.`,
    acceptProps: { label: 'Delete', severity: 'danger' },
    rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
    accept: () => emit('remove', entry.id),
  })
}

function startRename(entry: SaveIndexEntry) {
  renaming.value = entry
  newName.value = entry.name
  renameOpen.value = true
}

function saveRename() {
  const name = newName.value.trim()
  if (renaming.value && name !== '') emit('rename', renaming.value.id, name)
  renameOpen.value = false
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const game = props.saves.importText(await file.text())
    toast.add({ severity: 'success', summary: 'Saved games', detail: `Imported ${game.name}.`, life: 4000 })
  } catch (error) {
    failed(error instanceof ImportError ? error.message : 'The file could not be read.')
  }
  input.value = ''
}
</script>

<template>
  <div class="saves">
    <div class="saves-bar">
      <span class="field-label">Saved games</span>
      <span class="grow" />
      <Button label="Import" icon="pi pi-upload" severity="secondary" outlined @click="fileInput?.click()" />
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFile" />
    </div>

    <DataTable :value="entries" data-key="id" size="small">
      <template #empty>No saved games yet.</template>
      <Column header="Game">
        <template #body="{ data }">
          <div :data-save="data.id" class="game-name">
            {{ data.name }}
            <span v-if="data.id === currentId" class="open-now">Open now</span>
          </div>
          <div class="small muted">{{ data.playerNames.join(', ') }} · {{ when(data.updatedAt) }}</div>
        </template>
      </Column>
      <Column header="Actions" class="actions-col">
        <template #body="{ data }">
          <div class="actions">
            <button type="button" class="icon-btn" :aria-label="`Open ${data.id}`" title="Open" @click="emit('open', data.id)">
              <i class="pi pi-folder-open" aria-hidden="true" />
            </button>
            <button type="button" class="icon-btn" :aria-label="`Rename ${data.id}`" title="Rename" @click="startRename(data)">
              <i class="pi pi-pencil" aria-hidden="true" />
            </button>
            <button type="button" class="icon-btn" :aria-label="`Duplicate ${data.id}`" title="Duplicate" @click="duplicate(data.id)">
              <i class="pi pi-copy" aria-hidden="true" />
            </button>
            <button type="button" class="icon-btn" :aria-label="`Export ${data.id}`" title="Export" @click="exportSave(data.id)">
              <i class="pi pi-download" aria-hidden="true" />
            </button>
            <button type="button" class="icon-btn" :aria-label="`Delete ${data.id}`" title="Delete" @click="askRemove(data)">
              <i class="pi pi-trash" aria-hidden="true" />
            </button>
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="renameOpen" modal header="Rename game" :style="{ width: 'min(420px, 100vw)' }">
      <InputText v-model="newName" fluid aria-label="Game name" data-testid="rename-input" @keydown.enter="saveRename" />
      <template #footer>
        <div class="dialog-footer">
          <Button label="Cancel" severity="secondary" outlined @click="renameOpen = false" />
          <Button label="Save" :disabled="newName.trim() === ''" data-testid="rename-save" @click="saveRename" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.saves {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.saves-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grow {
  flex: 1;
}
.game-name {
  font-weight: 600;
}
.open-now {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--lead);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}
</style>
```

**`src/dialogs/SettingsDialog.vue`** (full file)
```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { canChangeShortGame, renameGame, setMainView, setPhase, setShortGame } from '../domain/edit'
import { PHASE_LABEL } from '../domain/format'
import { PHASE_MAX } from '../domain/track'
import type { Game, Phase, ViewId } from '../domain/types'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ game: Game; editMode: boolean }>()
const emit = defineEmits<{ update: [game: Game] }>()

const name = ref(props.game.name)
watch(
  () => [visible.value, props.game.name],
  () => {
    name.value = props.game.name
  },
)

const phaseOptions = (['yellow', 'green', 'purple'] as Phase[]).map((value) => ({
  value,
  label: `${PHASE_LABEL[value]} 60–${PHASE_MAX[value]}`,
}))
const viewOptions: { label: string; value: ViewId }[] = [
  { label: 'Track', value: 'track' },
  { label: 'Ownership', value: 'ownership' },
  { label: 'Scoreboard', value: 'scoreboard' },
]
const lengthOptions = [
  { label: 'Short · 4 cycles', value: true },
  { label: 'Long · 6 cycles', value: false },
]

const lengthOpen = computed(() => canChangeShortGame(props.game))
const lengthHelp = computed(() => {
  if (!lengthOpen.value) return 'The game length is fixed once a company has started.'
  if (!props.editMode) return 'Turn on edit mode to change the game length.'
  return 'A short game removes Adaptive, Overnight, Bridging and Spacious.'
})

/** Commits the name on blur or Enter, so a rename is one undo step. */
function commitName() {
  const trimmed = name.value.trim()
  if (trimmed === '' || trimmed === props.game.name) {
    name.value = props.game.name
    return
  }
  emit('update', renameGame(props.game, trimmed))
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Settings" :style="{ width: 'min(520px, 100vw)' }">
    <div class="dialog-body">
      <label class="field">
        <span class="field-label">Game name</span>
        <InputText v-model="name" fluid data-testid="settings-name" @blur="commitName" @keydown.enter="commitName" />
      </label>

      <div class="field">
        <span class="field-label">Current phase, limits the start price of new companies</span>
        <SelectButton
          :model-value="game.settings.phase"
          :options="phaseOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          fluid
          @update:model-value="(v: Phase) => emit('update', setPhase(game, v))"
        />
      </div>

      <div class="field">
        <span class="field-label">View shown when this game opens</span>
        <SelectButton
          :model-value="game.settings.mainView"
          :options="viewOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          fluid
          @update:model-value="(v: ViewId) => emit('update', setMainView(game, v))"
        />
      </div>

      <div class="field">
        <span class="field-label">Game length</span>
        <SelectButton
          :model-value="game.settings.shortGame"
          :options="lengthOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="!editMode || !lengthOpen"
          fluid
          @update:model-value="(v: boolean) => emit('update', setShortGame(game, v))"
        />
        <span class="small muted">{{ lengthHelp }}</span>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Done" @click="visible = false" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/SavesList.test.ts src/dialogs/SettingsDialog.test.ts`
Expected: PASS, 2 files, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/state/download.ts src/components src/dialogs
git commit -m "feat: add saved games list and settings dialog"
```

---

### Task 18: App shell

Boards: the top bar of `Main.dc.html` and `TrackPhone.dc.html`; the banner and frame of `OwnershipEdit.dc.html`.

**Files:**
- Create: `src/components/AppTopBar.vue`
- Modify: `src/App.vue` (replace), `src/App.test.ts` (replace)

**Interfaces:**
- Consumes: everything built in Tasks 2 to 17. `useGame()` from `state/game.ts`, `useSaves()` from `state/saves.ts`.
- Produces:
  - `<AppTopBar :game v-model:view v-model:edit-mode :can-undo :can-redo :can-merge :badges @start @merge @undo @redo @action="(name) => ..." />`, where `name` is `'saves' | 'new' | 'export' | 'settings' | 'close'` and `badges` is `{ ownership: number; scoreboard: number }`.
  - The running app.

Behavior:
- With no game open, the app shows a home screen: the app name, "New game", and the saved games list.
- On launch it reopens the game that was open last time.
- With a game open: the top bar, the edit banner and a 4px amber frame in edit mode, and one of the three views. The view starts at `settings.mainView`.
- The view switcher is a PrimeVue `SelectButton`. Ownership shows a badge with the number of company warnings; Scoreboard shows a badge with the number of players with negative cash.
- Merge is disabled unless `canMerge(game)` is true.
- The menu (PrimeVue `Menu`) has: Saved games, New game, Export this game, Settings, Close game.
- On a phone (narrower than 720px) the view switcher moves to a second row, and Start company and Merge move to a bottom bar.
- A storage warning from the store is shown as a toast.

- [ ] **Step 1: Write the failing test**

**`src/App.test.ts`** (full file)
```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import App from './App.vue'
import { useGame } from './state/game'
import { useSaves } from './state/saves'
import { put, testGame } from './domain/fixtures'
import type { Game } from './domain/types'

const [J, K] = ['p1', 'p2']

function sample(): Game {
  let g = put(testGame(['Haoran', 'Ari']), 'tunneling', { price: 70, president: J, treasury: 3 })
  g = put(g, 'express', { price: 80, president: K, treasury: 3 })
  return { ...g, name: 'Friday game' }
}

const button = (w: VueWrapper, text: string) => {
  const found = w.findAll('button').find((b) => b.text().includes(text))
  if (!found) throw new Error(`No button "${text}"`)
  return found
}

beforeEach(() => {
  const saves = useSaves()
  useGame().close()
  for (const entry of [...saves.index.value]) saves.remove(entry.id)
  localStorage.clear()
})

describe('App without a game', () => {
  it('shows the app name when no game is open', () => {
    const w = mount(App)
    expect(w.text()).toContain('Lost Atlas Tracker')
    expect(w.text()).toContain('New game')
    expect(w.find('header').exists()).toBe(false)
  })

  it('opens the setup dialog from New game and starts a game', async () => {
    const w = mount(App)
    await w.get('[data-testid="home-new"]').trigger('click')
    const names = w.findAll('[data-testid="player-name"]')
    await names[0].setValue('Haoran')
    await names[1].setValue('Ari')
    await w.get('[data-testid="start-game"]').trigger('click')
    expect(useGame().game.value?.players.map((p) => p.name)).toEqual(['Haoran', 'Ari'])
    expect(w.find('header').exists()).toBe(true)
  })

  it('lists a saved game on the home screen and opens it', async () => {
    useGame().create(sample())
    useGame().close()
    const w = mount(App)
    expect(w.text()).toContain('Friday game')
    await w.get('[aria-label="Open g1"]').trigger('click')
    expect(w.get('header').text()).toContain('Friday game')
  })
})

describe('App with a game', () => {
  beforeEach(() => useGame().create(sample()))

  it('shows the game name, phase and length, and the Track view', () => {
    const w = mount(App)
    expect(w.get('header').text()).toContain('Friday game')
    expect(w.get('header').text()).toContain('Yellow · Long game')
    expect(w.findAll('.token')).toHaveLength(2)
  })

  it('reopens the last game on launch', () => {
    useGame().close()
    useSaves().setCurrent('g1')
    const w = mount(App)
    expect(w.get('header').text()).toContain('Friday game')
  })

  it('switches views', async () => {
    const w = mount(App)
    await button(w, 'Ownership').trigger('click')
    expect(w.find('[data-company="express"]').exists()).toBe(true)
    await button(w, 'Scoreboard').trigger('click')
    expect(w.find('[data-row="total"]').exists()).toBe(true)
  })

  it('starts on the view from the settings', () => {
    useGame().create({ ...sample(), settings: { ...sample().settings, mainView: 'scoreboard' } })
    const w = mount(App)
    expect(w.find('[data-row="total"]').exists()).toBe(true)
  })

  it('commits a view action and undoes it', async () => {
    const w = mount(App)
    const undo = w.get('[aria-label="Undo"]')
    expect(undo.attributes('disabled')).toBeDefined()
    await w.get('[data-id="express"]').trigger('click')
    await w.get('[aria-label="Up to 90"]').trigger('click')
    expect(useGame().game.value!.track[9]).toEqual(['express'])
    expect(undo.attributes('disabled')).toBeUndefined()
    await undo.trigger('click')
    expect(useGame().game.value!.track[8]).toEqual(['express'])
    await w.get('[aria-label="Redo"]').trigger('click')
    expect(useGame().game.value!.track[9]).toEqual(['express'])
  })

  it('shows the edit banner and frame in edit mode', async () => {
    const w = mount(App)
    expect(w.find('.edit-banner').exists()).toBe(false)
    await w.get('[aria-label="Edit mode"]').trigger('click')
    expect(w.find('.edit-banner').exists()).toBe(true)
    expect(w.find('.frame').exists()).toBe(true)
    expect(w.get('[aria-label="Edit mode"]').attributes('aria-pressed')).toBe('true')
    await button(w, 'Done').trigger('click')
    expect(w.find('.edit-banner').exists()).toBe(false)
  })

  it('enables Merge only with two active minors and a free major', () => {
    const w = mount(App)
    expect(w.get('[data-testid="merge"]').attributes('disabled')).toBeUndefined()
    useGame().create(put(testGame(), 'express', { price: 80, president: J, treasury: 3 }))
    const single = mount(App)
    expect(single.get('[data-testid="merge"]').attributes('disabled')).toBeDefined()
  })

  it('opens the start company dialog and commits the new company', async () => {
    const w = mount(App)
    await w.get('[data-testid="start"]').trigger('click')
    await w.get('[data-testid="company-suburban"]').trigger('click')
    await w.get('[data-testid="president-p1"]').trigger('click')
    await w.get('[data-testid="start-company"]').trigger('click')
    expect(useGame().game.value!.companies.suburban.status).toBe('active')
    expect(useSaves().read('g1')?.game.companies.suburban.status).toBe('active')
  })

  it('shows a warning badge on Ownership', async () => {
    useGame().create(put(testGame(), 'express', { price: 80, president: J, treasury: 1 }))
    const w = mount(App)
    expect(button(w, 'Ownership').find('.badge').text()).toBe('1')
    expect(button(w, 'Scoreboard').find('.badge').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/App.test.ts`
Expected: FAIL. The placeholder `App.vue` has no buttons, top bar or views, so the tests cannot find them.

- [ ] **Step 3: Write the top bar**

**`src/components/AppTopBar.vue`** (full file)
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import SelectButton from 'primevue/selectbutton'
import { PHASE_LABEL } from '../domain/format'
import type { Game, ViewId } from '../domain/types'

export type MenuAction = 'saves' | 'new' | 'export' | 'settings' | 'close'

const props = defineProps<{
  game: Game
  canUndo: boolean
  canRedo: boolean
  canMerge: boolean
  badges: { ownership: number; scoreboard: number }
}>()
const view = defineModel<ViewId>('view', { required: true })
const editMode = defineModel<boolean>('editMode', { required: true })
const emit = defineEmits<{ start: []; merge: []; undo: []; redo: []; action: [name: MenuAction] }>()

const views: { label: string; value: ViewId }[] = [
  { label: 'Track', value: 'track' },
  { label: 'Ownership', value: 'ownership' },
  { label: 'Scoreboard', value: 'scoreboard' },
]
const badge = (value: ViewId) => (value === 'ownership' ? props.badges.ownership : value === 'scoreboard' ? props.badges.scoreboard : 0)

const subtitle = computed(
  () => `${PHASE_LABEL[props.game.settings.phase]} · ${props.game.settings.shortGame ? 'Short' : 'Long'} game`,
)

const menu = ref<InstanceType<typeof Menu> | null>(null)
const items = [
  { label: 'Saved games', icon: 'pi pi-folder-open', command: () => emit('action', 'saves') },
  { label: 'New game', icon: 'pi pi-plus', command: () => emit('action', 'new') },
  { label: 'Export this game', icon: 'pi pi-download', command: () => emit('action', 'export') },
  { label: 'Settings', icon: 'pi pi-cog', command: () => emit('action', 'settings') },
  { label: 'Close game', icon: 'pi pi-sign-out', command: () => emit('action', 'close') },
]
</script>

<template>
  <header class="top">
    <div class="title">
      <div class="name">{{ game.name }}</div>
      <div class="small muted">{{ subtitle }}</div>
    </div>

    <SelectButton
      v-model="view"
      class="views"
      :options="views"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      aria-label="View"
    >
      <template #option="{ option }">
        <span>{{ option.label }}</span>
        <span v-if="badge(option.value) > 0" class="badge" :aria-label="`${badge(option.value)} warnings`">
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />{{ badge(option.value) }}
        </span>
      </template>
    </SelectButton>

    <span class="grow" />

    <div class="actions">
      <Button label="Start company" icon="pi pi-plus" data-testid="start" @click="emit('start')" />
      <Button
        label="Merge"
        icon="pi pi-share-alt"
        severity="secondary"
        outlined
        :disabled="!canMerge"
        data-testid="merge"
        @click="emit('merge')"
      />
    </div>

    <button
      type="button"
      class="icon-btn edit"
      :class="{ on: editMode }"
      aria-label="Edit mode"
      :aria-pressed="editMode"
      @click="editMode = !editMode"
    >
      <i class="pi pi-pencil" aria-hidden="true" />
    </button>
    <button type="button" class="icon-btn" aria-label="Undo" :disabled="!canUndo" @click="emit('undo')">
      <i class="pi pi-undo" aria-hidden="true" />
    </button>
    <button type="button" class="icon-btn" aria-label="Redo" :disabled="!canRedo" @click="emit('redo')">
      <i class="pi pi-refresh" aria-hidden="true" />
    </button>
    <button type="button" class="icon-btn" aria-label="Menu" aria-haspopup="true" @click="(e) => menu?.toggle(e)">
      <i class="pi pi-bars" aria-hidden="true" />
    </button>
    <Menu ref="menu" :model="items" popup />
  </header>
</template>

<style scoped>
.top {
  flex: none;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--card);
  border-bottom: 1px solid var(--line);
}
.title {
  min-width: 0;
  max-width: 200px;
}
.name {
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.grow {
  flex: 1;
}
.actions {
  display: flex;
  gap: 8px;
}
.views :deep(button) {
  min-height: 44px;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--amber-chip);
  color: var(--amber-ink);
  font-size: 12px;
  font-weight: 700;
}
.badge .pi {
  font-size: 11px;
}
.edit.on {
  border-color: var(--amber);
  background: var(--amber);
  color: #fff;
}
@media (max-width: 719px) {
  .top {
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 8px 8px 12px;
  }
  .title {
    flex: 1;
    max-width: none;
  }
  .grow,
  .actions {
    display: none;
  }
  .views {
    order: 10;
    width: 100%;
    display: flex;
  }
  .views :deep(button) {
    flex: 1;
  }
}
</style>
```

- [ ] **Step 4: Write the shell**

**`src/App.vue`** (full file)
```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import Dialog from 'primevue/dialog'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import AppTopBar, { type MenuAction } from './components/AppTopBar.vue'
import EditBanner from './components/EditBanner.vue'
import SavesList from './components/SavesList.vue'
import MergeWizard from './dialogs/MergeWizard.vue'
import SettingsDialog from './dialogs/SettingsDialog.vue'
import SetupDialog from './dialogs/SetupDialog.vue'
import StartCompanyDialog from './dialogs/StartCompanyDialog.vue'
import { renameGame } from './domain/edit'
import { canMerge } from './domain/merge'
import { validate } from './domain/shares'
import type { Game, ViewId } from './domain/types'
import { downloadText } from './state/download'
import { useGame } from './state/game'
import { exportFileName, exportGame, useSaves } from './state/saves'
import OwnershipView from './views/OwnershipView.vue'
import ScoreboardView from './views/ScoreboardView.vue'
import TrackView from './views/TrackView.vue'

const store = useGame()
const saves = useSaves()
const toast = useToast()
const { game, canUndo, canRedo, saveWarning } = store

if (game.value === null) store.resume()

const view = ref<ViewId>('track')
const editMode = ref(false)
const setupOpen = ref(false)
const startOpen = ref(false)
const mergeOpen = ref(false)
const savesOpen = ref(false)
const settingsOpen = ref(false)

// A different game starts on its own main view, outside edit mode.
watch(
  () => game.value?.id,
  () => {
    const main = game.value?.settings.mainView
    view.value = main === 'ownership' || main === 'scoreboard' ? main : 'track'
    editMode.value = false
  },
  { immediate: true },
)

const warnings = computed(() => (game.value ? validate(game.value) : []))
const badges = computed(() => ({
  ownership: warnings.value.filter((w) => w.companyId !== undefined).length,
  scoreboard: warnings.value.filter((w) => w.code === 'negative-cash').length,
}))
const mergeable = computed(() => game.value !== null && canMerge(game.value))

watch(
  saveWarning,
  (message) => {
    if (message === null) return
    toast.add({ severity: 'warn', summary: 'Storage', detail: message, life: 8000 })
    saveWarning.value = null
  },
  { immediate: true },
)

function commit(next: Game) {
  store.commit(next)
}

function onAction(name: MenuAction) {
  if (name === 'saves') savesOpen.value = true
  else if (name === 'new') setupOpen.value = true
  else if (name === 'settings') settingsOpen.value = true
  else if (name === 'close') store.close()
  else if (name === 'export' && game.value) downloadText(exportFileName(game.value), exportGame(game.value))
}

function openSaved(id: string) {
  const save = saves.read(id)
  if (!save) {
    toast.add({ severity: 'error', summary: 'Saved games', detail: 'This saved game could not be read.', life: 6000 })
    return
  }
  store.open(save)
  savesOpen.value = false
}

function renameSaved(id: string, name: string) {
  if (game.value?.id === id) store.commit(renameGame(game.value, name))
  else saves.rename(id, name)
}

function removeSaved(id: string) {
  if (game.value?.id === id) store.close()
  saves.remove(id)
}
</script>

<template>
  <Toast position="bottom-center" />
  <ConfirmDialog />

  <div v-if="game" class="app">
    <AppTopBar
      v-model:view="view"
      v-model:edit-mode="editMode"
      :game="game"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :can-merge="mergeable"
      :badges="badges"
      @start="startOpen = true"
      @merge="mergeOpen = true"
      @undo="store.undo()"
      @redo="store.redo()"
      @action="onAction"
    />
    <EditBanner v-if="editMode" @done="editMode = false" />

    <main class="main">
      <TrackView v-if="view === 'track'" :game="game" :edit-mode="editMode" @update="commit" />
      <OwnershipView v-else-if="view === 'ownership'" :game="game" :edit-mode="editMode" @update="commit" />
      <ScoreboardView v-else :game="game" @update="commit" />
    </main>

    <footer class="bottom-actions">
      <Button label="Start company" icon="pi pi-plus" class="primary" @click="startOpen = true" />
      <Button label="Merge" icon="pi pi-share-alt" severity="secondary" outlined :disabled="!mergeable" @click="mergeOpen = true" />
    </footer>

    <div v-if="editMode" class="frame" aria-hidden="true" />

    <StartCompanyDialog v-model:visible="startOpen" :game="game" @start="commit" />
    <MergeWizard v-model:visible="mergeOpen" :game="game" @merge="commit" />
    <SettingsDialog v-model:visible="settingsOpen" :game="game" :edit-mode="editMode" @update="commit" />
    <Dialog v-model:visible="savesOpen" modal header="Saved games" :style="{ width: 'min(640px, 100vw)' }">
      <SavesList :saves="saves" :current-id="game.id" @open="openSaved" @rename="renameSaved" @remove="removeSaved" />
    </Dialog>
  </div>

  <main v-else class="home">
    <h1>Lost Atlas Tracker</h1>
    <p class="muted">Scorekeeper for Railways of the Lost Atlas. Games are saved on this device.</p>
    <div>
      <Button label="New game" icon="pi pi-plus" data-testid="home-new" @click="setupOpen = true" />
    </div>
    <SavesList :saves="saves" :current-id="null" @open="openSaved" @rename="renameSaved" @remove="removeSaved" />
  </main>

  <SetupDialog v-model:visible="setupOpen" @start="store.create" />
</template>

<style scoped>
.app {
  height: 100dvh;
  display: flex;
  flex-direction: column;
}
.main {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.bottom-actions {
  display: none;
}
/* Edit mode signal: a 4px amber frame around the whole screen. */
.frame {
  position: fixed;
  inset: 0;
  border: 4px solid var(--amber);
  pointer-events: none;
  z-index: 10;
}
.home {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
h1 {
  margin: 0;
  font-size: 24px;
  line-height: 32px;
}
.home p {
  margin: 0;
}
@media (max-width: 719px) {
  .bottom-actions {
    flex: none;
    display: flex;
    gap: 8px;
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
    background: var(--card);
    border-top: 1px solid var(--line);
  }
  .bottom-actions :deep(button) {
    min-height: 48px;
    flex: 2;
  }
  .bottom-actions :deep(button.primary) {
    flex: 3;
  }
}
</style>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/App.test.ts`
Expected: PASS, 12 tests.

Run: `npm test`
Expected: every test file passes.

Run: `npm run build`
Expected: no type errors, and Vite writes `dist/`. Vite prints a warning that one chunk is larger than 500 kB. That is expected: the app is one bundle so that it can be precached for offline use.

- [ ] **Step 6: Check the app by hand**

Run: `npm run dev`, and open the printed Local URL. Check each line:

1. The home screen shows "Lost Atlas Tracker" and "New game".
2. New game with Haoran, Ari, John, James: the codes are H, A, Jo, Ja, the cash is 275 each, and Long is selected. Start the game.
3. Start company: Express, president Haoran, bid 160. The price shows 80, and 100 to 135 are struck out (yellow phase). Start. The token XP appears at 80 with a crown and H.
4. Select the token. The dock shows "Express at 80". Tap Up twice. The token is at 100.
5. Ownership shows Express with a crown circle under H and three dashed rings under Treasury, and `5/5`.
6. Scoreboard shows H with 275 + 2 × 100 = 475 and rank 1.
7. Tap the pencil. The amber banner and the amber frame appear. On Ownership, the steppers appear. On Track, drag the token to another column: it lands at that price. Outside edit mode, a drag does nothing.
8. Undo steps back one action at a time. Redo steps forward.
9. Narrow the window below 720px. The view switcher moves to its own row, and Start company and Merge move to the bottom.
10. Reload the page. The same game opens, and Undo still works.

Stop the dev server with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add app shell with top bar, edit mode and saved games"
```

---

### Task 19: Offline install (PWA) and final acceptance

**Files:**
- Create: `scripts/make-icons.mjs`, `public/icon.svg`, `README.md`
- Create (generated): `public/pwa-192.png`, `public/pwa-512.png`, `public/apple-touch-icon.png`
- Modify: `vite.config.ts` (replace), `index.html` (replace), `package.json` (add one script)

**Interfaces:**
- Consumes: the built app.
- Produces: a production build with a web app manifest and a service worker that precaches every asset, so the app opens with no network.

- [ ] **Step 1: Write the icon generator**

The icons are drawn by a script with no dependencies, so no image tool is needed.

**`scripts/make-icons.mjs`** (full file)
```js
// Writes the PWA icons as PNG files. Run: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** `pixel(x, y)` gets coordinates from 0 to 1 and returns [r, g, b]. */
function png(size, pixel) {
  const stride = size * 3 + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel((x + 0.5) / size, (y + 0.5) / size)
      raw.set([r, g, b], y * stride + 1 + x * 3)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8 bit, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const EMERALD = [4, 120, 87]
const INK = [24, 24, 27]
const WHITE = [255, 255, 255]
const CELLS = [
  { from: 0.16, to: 0.36, color: [253, 230, 138] }, // yellow zone
  { from: 0.4, to: 0.6, color: [187, 247, 208] }, // green zone
  { from: 0.64, to: 0.84, color: [233, 213, 255] }, // purple zone
]

// Three track cells on emerald, with a token on the middle cell.
// Everything sits inside the central 80%, so the icon also works as a maskable icon.
function pixel(x, y) {
  const d = Math.hypot(x - 0.5, y - 0.5)
  if (d < 0.07) return WHITE
  if (d < 0.095) return INK
  if (y > 0.38 && y < 0.62) {
    for (const cell of CELLS) if (x > cell.from && x < cell.to) return cell.color
  }
  return EMERALD
}

mkdirSync('public', { recursive: true })
for (const [name, size] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/${name}`, png(size, pixel))
  console.log(`public/${name}`)
}
```

**`public/icon.svg`** (full file)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#047857"/>
  <rect x="16" y="38" width="20" height="24" fill="#fde68a"/>
  <rect x="40" y="38" width="20" height="24" fill="#bbf7d0"/>
  <rect x="64" y="38" width="20" height="24" fill="#e9d5ff"/>
  <circle cx="50" cy="50" r="8.25" fill="#ffffff" stroke="#18181b" stroke-width="2.5"/>
</svg>
```

- [ ] **Step 2: Add the script and generate the icons**

In `package.json`, add this line to `"scripts"`, after `"typecheck"`:

```json
    "icons": "node scripts/make-icons.mjs"
```

The `"scripts"` block is then:

```json
  "scripts": {
    "dev": "vite --host",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "vue-tsc --noEmit",
    "icons": "node scripts/make-icons.mjs"
  },
```

Run: `npm run icons`
Expected: three lines, `public/pwa-192.png`, `public/pwa-512.png`, `public/apple-touch-icon.png`.

- [ ] **Step 3: Configure the PWA plugin**

**`vite.config.ts`** (full file)
```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lost Atlas Tracker',
        short_name: 'Lost Atlas',
        description: 'Scorekeeper for Railways of the Lost Atlas.',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#047857',
        background_color: '#f4f4f5',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app, the icons and the woff2 fonts. Every current browser uses woff2.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['**/primeicons-*.svg'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

**`index.html`** (full file)
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#047857" />
    <meta name="description" content="Scorekeeper for Railways of the Lost Atlas." />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <title>Lost Atlas Tracker</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Write the README**

**`README.md`** (full file)
````markdown
# Lost Atlas Tracker

A scorekeeper for the board game Railways of the Lost Atlas. It tracks companies on the stock track, share ownership, and each player's total value. It runs in the browser, works offline, and saves games on the device.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start the dev server (also reachable from a phone on the same network)
npm test           # run the tests once
npm run typecheck  # check types
npm run build      # type check and build to dist/
npm run preview    # serve the production build
npm run icons      # regenerate the PWA icons
```

## Layout

- `src/domain/`: the game rules. Pure TypeScript, no Vue. Each function takes a game and returns a new game.
- `src/state/`: the game store (undo history, autosave) and saved games (export, import).
- `src/components/`, `src/views/`, `src/dialogs/`: the Vue interface.
- `docs/design/`: the spec and the design boards.

## Scope

Phase 1: setup, track, ownership, scoreboard, start company, merge, edit mode, undo and redo, saved games.
Phase 2 (not built): dividends, buy and sell, treasury cash, round tracking, score history.
````

- [ ] **Step 5: Build and check the offline bundle**

Run: `npm run build`
Expected: the output ends with a `PWA` section that lists `precache` with a number of entries, and `files generated` with `dist/sw.js`.

Run: `ls dist/sw.js dist/manifest.webmanifest dist/pwa-192.png dist/pwa-512.png`
Expected: all four paths are listed.

Run: `grep -c "woff2" dist/sw.js`
Expected: `1` or more (the fonts are in the precache list).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 22 test files and 219 tests pass.

Run: `npm run typecheck`
Expected: no output.

- [ ] **Step 7: Acceptance walkthrough**

Run: `npm run preview`, and open the printed Local URL. This is the Phase 1 acceptance test from spec A3: enter a final game state and read the ranked scores.

1. New game, 4 players: Haoran, Ari, John, James. Start the game.
2. Start five minors (Start company), each with a president and a price:
   - Express, Haoran, tap 90.
   - Northern Port, John, tap 90.
   - Tunneling, James, tap 90.
   - Agricultural, Ari, tap 70.
   - Resourceful, Haoran, tap 60.
3. Select Express and tap Up twice. It is at 110, and the order on the track is XP, NP, TU, AG, RE.
4. Turn on edit mode. On Ownership, set these regular cards, and set every Treasury count so each row shows `5/5`:
   - Express: Ari 1, John 1, Treasury 1.
   - Northern Port: Haoran 1, James 1, Treasury 1.
   - Tunneling: Ari 1, Treasury 1, Market 1.
   - Agricultural: James 1, Treasury 0, Market 2.
   - Resourceful: Ari 1, John 1, Treasury 1.
5. On Scoreboard, set cash: Haoran 142, Ari 85, John 210, James 70.
6. Check the totals:
   - Haoran: 142 + 2 × 110 + 1 × 90 + 2 × 60 = 572.
   - Ari: 85 + 1 × 110 + 1 × 90 + 2 × 70 + 1 × 60 = 485.
   - John: 210 + 1 × 110 + 2 × 90 + 1 × 60 = 560.
   - James: 70 + 1 × 90 + 2 × 90 + 1 × 70 = 410.
   The rank cards read Haoran 1, John 2, Ari 3, James 4.
7. Set James's cash to 220. James now totals 560 and ties with John. John ranks above James, and the note under the table says John is president of Northern Port, which acts before Tunneling.
8. Merge: pick Tunneling and Agricultural, then Federation. The preview shows the new president, the price 80 (average of 90 and 70), and a total of 10. Confirm. Federation is on the track at 80.
9. Tap Undo once. Tunneling and Agricultural are back and Federation is gone.
10. Menu, Export this game. A `.lost-atlas.json` file downloads. Menu, Saved games, Import, and choose that file. A second saved game appears.
11. In the browser's developer tools, set the network to Offline and reload. The app still opens with the game.

Stop the preview server with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add scripts public vite.config.ts index.html package.json README.md
git commit -m "feat: add offline install with a service worker and icons"
```
