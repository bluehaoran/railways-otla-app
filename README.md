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
