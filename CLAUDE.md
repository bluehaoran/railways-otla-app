# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lost Atlas Tracker: a scorekeeper for the board game Railways of the Lost Atlas. A client-only Vue 3 + TypeScript PWA (Vite, PrimeVue 4, VueUse, Vitest). No backend; games are saved in `localStorage`.

## Commands

```bash
npm run dev          # dev server, exposed on the LAN (--host) for phone testing
npm test             # run all tests once (vitest run)
npm run test:watch   # watch mode
npm run typecheck    # vue-tsc --noEmit
npm run build        # typecheck, then build to dist/
npm run icons        # regenerate the PWA icons in public/
```

Single test file or test name:

```bash
npx vitest run src/domain/merge.test.ts
npx vitest run src/domain/merge.test.ts -t "tie-break"
```

There is no linter or formatter. `tsconfig.json` is strict with `noUnusedLocals` and `noUnusedParameters`, so `npm run typecheck` is the only static check; run it alongside the tests.

## Deployment

A push to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`): tests, build, publish `dist/`. A failing test blocks the deploy. The site is https://bluehaoran.github.io/railways-otla-app/, so `base` in `vite.config.ts` is `/railways-otla-app/` and the dev and preview servers serve under that path too. Reference public assets through the base (Vite rewrites absolute URLs in `index.html`; in code use `import.meta.env.BASE_URL`), never a bare `/file`.

## Architecture

Three layers, with dependencies pointing one way: UI → state → domain.

### `src/domain/`: the rules

Pure TypeScript, no Vue imports. `types.ts` defines `Game`, the single serialisable object that holds everything. Every rule function takes a `Game` and returns a new `Game` (spread copies, never mutation).

- `Company.holdings` counts regular cards only. The president card is `Company.president` and counts as 2 shares. Always go through `shares()` in `shares.ts` instead of reading `holdings` directly.
- `Game.track` is 27 queues, one per entry in `TRACK` (`track.ts`). `track[i][0]` is the front of the queue. Index 0 is price 0, which means closed: a token never rests there, so `placeToken`/`moveToken` return `{ kind: 'close' }` for the caller to confirm instead of moving it.
- A company is on the track exactly when its status is `active`. `checkGame` in `state/saves.ts` rejects saves that break this.
- `validate()` in `shares.ts` returns rule warnings. Warnings never block an action; the UI shows them as badges.
- `edit.ts` holds the direct setters for edit mode. They accept any value and skip the rules on purpose (`setPresident` exchanges no cards; `transferPresidency` is the rule version).
- `companies.ts` builds the static catalogue from `src/data/companies.json`. Text ink per company colour comes from `contrast.ts`.
- `fixtures.ts` has the test helpers `testGame()` and `put()`. App code does not import it.

### `src/state/`: store and persistence

- `game.ts`: `createGameStore(saves)` owns the current game in one `ref<Game | null>`. Every change goes through `commit(next)`, which assigns a whole new `Game`, so one user action is one undo step. Undo history is `useRefHistory` with `flush: 'sync'`. A sync watcher registered after it autosaves the game with its undo and redo stacks. The order of those two registrations matters.
- `saves.ts`: `createSaves(storage)` handles the `lostAtlas.*` keys (index, current id, one key per game), export and import, `checkGame` shape validation, and the `MIGRATIONS` hook keyed by `schemaVersion`. A change to the `Game` shape needs a schema version bump, a migration, and a matching update to `checkGame`.
- `write()` handles a full quota by dropping other games' histories, then halving this game's undo stack. The store mirrors the trim through the returned `kept` count.
- `useGame()` and `useSaves()` are the app singletons. `useGame()` also listens for the `storage` event so two tabs do not overwrite each other. Tests call the `create*` factories with `memoryStorage()` instead.

### UI: `src/App.vue`, `views/`, `dialogs/`, `components/`

- `App.vue` is the only place that touches the store. Views and dialogs receive `game` as a prop and emit the next `Game` (`update`, `start`, `merge`); `App.vue` commits it. Keep new views and dialogs on this pattern so each action stays one undo step.
- View state that is not part of the game (current view, edit mode, open dialogs) lives in `App.vue` refs and is not saved or undone.
- The phone/tablet breakpoint is 720px (`max-width: 719px` in CSS, `useMediaQuery('(min-width: 720px)')` in `TrackView`).
- `theme.ts` is the PrimeVue Aura preset (emerald primary, zinc surfaces). Light scheme only. Shared CSS variables are in `src/styles/app.css`.

## Tests

Tests sit next to the code as `*.test.ts` and run in jsdom. `src/test-setup.ts` installs the PrimeVue plugins without a theme, replaces PrimeVue `Dialog` with an inline stub (so dialog content is findable in the wrapper, with no teleport), and stubs `matchMedia` to return `matches: false`. Components therefore render their phone layout in tests unless a test overrides `matchMedia`.

Component tests mount with a game built from `testGame()` and `put()`, then assert on the emitted `Game`. Tests that need `useConfirm` mock `primevue/useconfirm`.

## Design and spec

- `docs/design/lost-atlas-tracker-design-spec.md` is the current spec: Part A rules, Part B architecture, Part C UI, Part D phases and open items. `docs/2026-10-05-lost-atlas-tracker-design.md` is an earlier draft of the same document.
- `docs/design/README.md` lists the design boards and the decisions made after the spec. The boards in `docs/design/boards/` supersede Part C of the spec where they differ. Read this folder before building or changing a screen.
- `docs/design/company-colors.json` is the source of truth for company names and colours. `src/data/companies.json` is a copy of it; keep the two in step.
- `docs/design/phase-2-implementation-list.md` is the Phase 2 work list (items P2-xx, open decisions D1 to D7, and the mobile feedback overrides F1 to F5). `docs/design/mobile-ux-feedback.md` overrides Part C of the spec. `docs/reference/` holds the rulebook PDFs (git-ignored, local only); the rulebook overrides the spec for game rules.
- Phase 1 is built. Phase 2 (dividends, buy and sell, treasury cash, round tracking, score history) is not, although `ViewId` already includes `'dividend'`.
