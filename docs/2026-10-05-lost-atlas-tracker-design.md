# Railways of the Lost Atlas Scoring App: Design Spec

Date: 2026-10-05
Status: Draft for review
Owner: Haoran
Audience: (1) UI design agents, (2) Claude Code for implementation.

Parts of this document:
- Part A: product and rules (what the app does). Read by both audiences.
- Part B: logic and architecture (implementation). Read by Claude Code.
- Part C: UI requirements (screens). Read by both. UI design agents own the visual design; Claude Code owns the behavior.
- Part D: phases, acceptance tests, assumptions, open items.

Source documents: the rulebook PDF and `company-colors.json` (both in the project). Where an interview decision differs from the rulebook, section D4 lists the difference for Haoran to resolve.

---

# Part A: Product and rules

## A1. Purpose

A scorekeeper companion for the board game Railways of the Lost Atlas. The app tracks:
1. Companies (minor and major), including their current share price.
2. Share ownership per player, treasury and market.
3. Each player's total value, which is the victory score.

## A2. Users and device

- One scorekeeper uses one phone or tablet, shared at the table.
- Touch first. Works in portrait and landscape. Works offline.
- Single user. No accounts, no sync, no server.

## A3. Success criteria

Phase 1 acceptance (from Haoran): enter a final game state (cash, share price per company, shares per player) and see each player's final score, ranked, with the tie-break applied.

Phase 2 acceptance: run a full game live, with stock and operating rounds, dividends, buy and sell, and a per-cycle score history.

## A4. Game facts the app encodes

### Companies

Majors (6) and minors (12). Names, abbreviations and colors come from `company-colors.json`. Copy that file to `src/data/companies.json`. Colors are approximate.

| Kind | Id | Abbr | Color |
|---|---|---|---|
| Major | consortium | C | #e2363c |
| Major | union | U | #e87d3c |
| Major | system (identities: System, Syndicate) | S | #ecb545 |
| Major | international (identities: International, Inc.) | I | #9cc1cd |
| Major | federation | F | #7ab152 |
| Major | experiment | E | #985994 |
| Minor | spacious | SP | #9ed181 |
| Minor | adaptive | AD | #9c83b1 |
| Minor | bridging | BR | #7dc1a5 |
| Minor | overnight | OV | #383232 |
| Minor | tunneling | TU | #b6a998 |
| Minor | resourceful | RE | #f1e1b9 |
| Minor | easternMining | EM | #b9825c |
| Minor | agricultural | AG | #446e4c |
| Minor | northernPort | NP | #385174 |
| Minor | expansive | EX | #e76684 |
| Minor | express | XP | #9f3841 |
| Minor | suburban | SU | #eda794 |

Short Game: Adaptive, Overnight, Bridging and Spacious are unavailable (8 minors remain). All 6 majors stay in the list.

Majors never start directly. A major enters play only through a merge.

### Shares

The unit of ownership is one share. A share is worth the company's current price.

| Kind | Regular cards | Regular card value | President card | Total shares | Share percent |
|---|---|---|---|---|---|
| Minor | 3 | 1 share (20%) | 2 shares (40%) | 5 | 20% per share |
| Major | 8 | 1 share (10%) | 2 shares (20%) | 10 | 10% per share |

The president is the player who started the company (or took over its presidency). The president holds the president card, which counts as 2 shares.

Constants: `UNIT_PCT = { minor: 0.2, major: 0.1 }`, `TOTAL_SHARES = { minor: 5, major: 10 }`.

### Stock track

27 positions, in order:

`0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200, 220, 245, 270, 300, 330, 360, 400, 450, 500`

Zones from `company-colors.json`: 60 to 90 yellow phase start, 100 to 110 green phase start, 120 to 135 purple phase start, 0 closed (red X). Use these to color the track.

A price is always a track position. All track values are multiples of 5.

### Token queues

Each track position holds an ordered queue of company tokens.
- A token that enters a position joins the back of that queue.
- The front of the queue acts first.
- This applies to a company start, a merged major entering, any price change, and a company that keeps its price after a small payout (it moves to the back as if it had just entered).

### Turn order

Companies act in descending price order. Within one position, queue order (front first).

`turnOrder()` = all active companies sorted by track position descending, then queue position ascending.

### Scoring

`playerTotal(p) = p.cash + sum over active companies of (shares(p, c) * price(c))`

- `shares(p, c)` = regular cards held + 2 if p is the president of c.
- Treasury shares and market shares are not counted for anyone.
- Company treasuries (cash) are not counted.
- Closed, merged and unstarted companies contribute nothing.

Ranking: highest total wins. Tie-break: the player who is president of the company that comes earliest in `turnOrder()` wins. If tied players preside over no company, they remain tied.

### Player count and starting cash

| Players | Starting cash | Short Game default |
|---|---|---|
| 2 | 450 | on |
| 3 | 300 | no default, the user must choose |
| 4 | 275 | no default, the user must choose |
| 5 | 220 | off |

Game length: 4 cycles (Short Game) or 6 cycles (Long Game). One cycle = Stock Round, Operating Round 1, Operating Round 2, Merger Round.

### Starting a minor company (auction result)

- Bids are at least 120, in steps of 5.
- The winner pays the bid to the company treasury and receives the president card.
- Starting price = half the bid, snapped down to the highest allowed track position at or below it.
- Allowed positions depend on the game phase: yellow 60 to 90, green 60 to 110, purple 60 to 135 (including all earlier ranges).

Examples: bid 120 (yellow) gives 60. Bid 160 gives 80. Bid 175 gives 87.5, snapped to 80. Bid 200 gives 100 in green, but 90 in yellow (clamped to the phase maximum). Bid 130 gives 65, snapped to 60.

The winner's total score does not change at the start when the half-bid lands on a track position and no phase clamp applies: cash falls by the bid, and 2 shares at half the bid add the same amount.

### Merge (Merger Round)

Two active minors (A and B) become one major (M).

1. Shares per player: `shares(p) = shares in A + shares in B`, where each president card counts 2.
2. New president: the player with the most shares across A and B. Tie: the player who is president of whichever of A or B comes earlier in `turnOrder()`, considering only tied players. If no tied player is a president of A or B, the wizard asks the user to choose among the tied players (rulebook is silent).
3. Conversion, 1 share to 1 share:
   - New president: regular cards = shares(p) minus 2, and holds the president card of M.
   - Every other player: regular cards = shares(p).
   - Treasury shares of M = treasury(A) + treasury(B). Market shares of M = market(A) + market(B).
   - Check: all regular cards + 2 + treasury + market = 10.
4. Price of M = average of the prices of A and B, snapped down to a track position.
5. M joins the back of the queue at that position. A and B leave the track and become `merged`.

A merge is one undoable step.

### Price closes at 0

When a price reaches position 0 for any reason, the company is dissolved: all its shares leave the game and its token leaves the track. The app asks for confirmation, then sets the company to `closed`, clears all its share counts, and removes it from the scoreboard. Manual edit mode can reverse this by undo.

### Presidency changes

If a player other than the president holds strictly more shares than the president, the presidency moves to the player with the most shares. If several players tie for most, it moves to the next tied player clockwise from the old president (clockwise = order of the players list). The exchange: the new president gives 2 regular cards to the old president and takes the president card. Totals are unchanged.

### Share limits (validation)

- A player holds at most 60% of a company (minor: 3 shares, major: 6 shares).
- The market holds at most 50% (minor: 2 shares, major: 5 shares).
- Shares across players, treasury and market must total 100%.

### Phase 2 rules: dividends, sales

Dividend entry for one company, in an Operating Round. Let `E` be the earnings and `P` the current price.

Choice 1, Pay out:
- Each share receives `E * UNIT_PCT`. A president card receives twice that. Treasury shares pay to the company treasury. Market shares pay to the bank. Players' cash increases by their payout.
- Price effect: `0 < E < P`: price unchanged, the token moves to the back of its queue. `P <= E < 2P`: up 1. `E >= 2P`: up 2.

Choice 2, Withhold:
- `E` goes to the company treasury. Price drops 1.

Choice 3, No train:
- Earnings count as 0. Price drops 1. No payout.

Worked example (minor, E = 120): J holds the president card (40%) and receives 48. K holds 1 share (20%) and receives 24. The treasury holds 1 share and receives 24. The market holds 1 share and the bank pays 24. Total 120.

Share sale by a player: price drops 1 for each sale action, regardless of the number of shares sold.

Other rulebook price events (Phase 2, see D4): issuing a share drops price 1; at the end of each Stock Round, a company whose shares are all held by players (none in treasury or market) rises 1.

## A5. Out of scope

Map, tiles, hub tokens, routes, trains, rust events, train purchases, the earnings track, the bank's money, the certificate-limit variant, hostile mergers, voting, bankruptcy handling (use edit mode), network play, accounts.

---

# Part B: Logic and architecture

## B1. Stack

- Vue 3, Vite, TypeScript.
- PrimeVue 4 with the Aura preset (use the current theme package named in the PrimeVue docs). Components: `SelectButton`, `Dialog`, `Stepper`, `DataTable`, `InputNumber`, `Checkbox`, `Button`, `Select`, `Menu`, `Toast`, `ConfirmDialog`.
- VueUse: `useRefHistory` for undo and redo. `useStorage` for the saved-games index. `useSortable` (from `@vueuse/integrations`) for drag in edit mode (touch capable).
- PWA: `vite-plugin-pwa`, offline capable, installable.
- Tests: Vitest for the domain layer. `@vue/test-utils` for the merge wizard and the setup dialog.
- No server. No Pinia (one composable owns the state).

## B2. Layout

```
src/
  data/companies.json        copy of company-colors.json
  domain/                    pure TypeScript, no Vue imports
    track.ts                 TRACK, snapDown, moveToken, startPrice
    shares.ts                shares(), validate()
    scoring.ts               playerTotal, ranking, turnOrder
    merge.ts                 mergePlan, applyMerge
    presidency.ts            presidencyCandidate, transferPresidency
    playerCodes.ts           code generation
    dividend.ts              Phase 2
  state/
    game.ts                  useGame(): ref + useRefHistory + persistence
    saves.ts                 saved games list, export, import
  components/                shared pieces (ShareCircle, PlayerCode, TokenChip, EditBanner)
  views/                     TrackView, OwnershipView, ScoreboardView, DividendView (Phase 2)
  dialogs/                   SetupDialog, StartCompanyDialog, MergeWizard
```

Domain functions take a `Game` and return a new `Game` (or a plan object). They do not mutate their input. The state layer assigns the result to the history ref in one synchronous step.

## B3. Data model

```ts
type PlayerId = string
type CompanyId = string                 // keys from companies.json
type Phase = 'yellow' | 'green' | 'purple'
type ViewId = 'track' | 'ownership' | 'scoreboard' | 'dividend'
type CompanyStatus = 'unavailable' | 'unstarted' | 'active' | 'merged' | 'closed'

interface Player { id: PlayerId; name: string; code: string; cash: number }

interface Company {
  id: CompanyId
  status: CompanyStatus
  president: PlayerId | null
  holdings: Record<PlayerId, number>    // regular cards only
  treasuryShares: number                // regular cards
  marketShares: number                  // regular cards
  // Phase 2: treasuryCash: number
}

interface Game {
  schemaVersion: 1
  id: string
  name: string
  createdAt: string                     // ISO
  settings: { shortGame: boolean; phase: Phase; mainView: ViewId }
  players: Player[]                     // order = clockwise seating
  companies: Record<CompanyId, Company>
  track: CompanyId[][]                  // length 27; track[i] is the queue at TRACK[i]; index 0 is the front
  // Phase 2: round: { cycle: number; type: 'SR'|'OR1'|'OR2'|'MR' }, cycleScores: Record<PlayerId, number>[]
}
```

Single source of truth for price: a company's price is `TRACK[i]` where `track[i]` contains its id. There is no separate price field. A company is active if and only if it appears in `track`.

Shares of a player in a company: `holdings[p] + (president === p ? 2 : 0)`.

## B4. Domain functions

| Function | Behavior |
|---|---|
| `snapDown(value)` | Highest `TRACK` value at or below `value`. Returns 0 for values below 10. |
| `moveToken(game, id, steps)` | Moves along the track by `steps` (negative = down). Clamps at index 26. Removes the token from its queue and appends it to the back of the target queue (also when clamped at 500, since the rulebook is silent). Reaching index 0 returns a plan that requires confirmation to close. |
| `startPrice(bid, phase)` | `snapDown(bid / 2)`, then clamped to the phase maximum (90, 110, 135). Throws if `bid < 120` or `bid % 5 !== 0`. |
| `turnOrder(game)` | Active companies by index descending, then queue position ascending. |
| `playerTotal(game, playerId)` | See A4. |
| `ranking(game)` | Players sorted by total descending, tie-break by `turnOrder` presidency. Returns total, rank and a `tieBreakApplied` flag. |
| `validate(game)` | Returns warnings (never blocks): share sum, 60% limit, 50% market limit, president missing, president outvoted, negative cash. |
| `presidencyCandidate(game, id)` | Player who should take the presidency, or null. |
| `transferPresidency(game, id, to)` | Applies the exchange from A4. |
| `mergePlan(game, aId, bId, mId)` | Returns `{ newPresident | needsChoice, tiedPlayers, holdings, treasuryShares, marketShares, price }` as in A4. Pure. |
| `applyMerge(game, plan)` | Applies the plan. |
| `playerCode(names)` | See B6. |

## B5. State and history

- `useGame()` holds `const game = ref<Game>(...)` and `const history = useRefHistory(game, { deep: true, capacity: 200 })`.
- Every user action assigns a new `Game` in one synchronous step, so it forms one history entry. A merge, a company start, and a price move are each one entry.
- Edit mode inputs commit on blur or Enter (not on each keystroke), so each field edit is one entry.
- `undo()` and `redo()` come from `useRefHistory`. Expose `canUndo` and `canRedo` to the top bar.
- History persists with the saved game, capped at 200 entries. If the browser storage quota is exceeded, drop the oldest history entries first, then warn with a Toast.

Note: `useRefHistory` stores full snapshots, not an action log. Scoreboard history in Phase 2 is stored inside `Game`, so undo rewinds it automatically.

## B6. Player codes

- Code = first letter of the name, uppercase.
- On a clash, extend every clashing name to the shortest prefix that makes all codes unique: John and James give Jo and Ja. Haoran, Ari and John give H, A and J.
- If one name is a prefix of another (Jo and John), use the full shorter name for the shorter one and the shortest unique prefix longer than it for the other, or the full name.
- If names are identical, append a digit (John1, John2).
- Codes are editable. Codes must stay unique. The app rejects a duplicate code.

## B7. Persistence

- Saved games: one `localStorage` entry per game, plus an index (id, name, updatedAt, player names) via `useStorage`. Autosave on every change.
- Operations: new, resume, rename, delete, duplicate.
- Export: download `{ schemaVersion, game }` as a `.json` file. Import: parse, check `schemaVersion`, validate required fields, assign a new id if the id already exists. Reject unknown versions with a clear message.
- Include a migration hook keyed by `schemaVersion`.

## B8. Edit mode behavior

When edit mode is on, the following become editable: cash, share counts (players, treasury, market), president, price (any track position), queue order, company status (start, close, merge undo through history), the Short Game flag only before the first company starts, and the phase setting. Edit mode never blocks on validation: it shows warnings and accepts the value.

---

# Part C: UI requirements

## C1. Shell

- Top bar: game name; view switcher (`SelectButton`: Track, Ownership, Scoreboard; Dividend in Phase 2); Start company button; Merge button; pencil icon (edit mode toggle); undo and redo; menu (saves, export, import, settings).
- Default view is Track. The default view is a setting (`settings.mainView`).
- Warnings from `validate()` appear as a badge on the view switcher and as inline markers on the affected rows.
- Merge is disabled unless there are at least 2 active minors and at least 1 unstarted major.

## C2. Notation

- Players: code letters (A, H, J, Jo, Ja).
- A share is a circle filled with the company color, containing the holder's code. Text color is chosen for contrast (black or white, WCAG 4.5:1 minimum). Charcoal (Overnight) and cream (Resourceful) need explicit checks.
- The president is marked with a crown icon (inline SVG if PrimeIcons has none). The president card is shown as a double-width circle with the crown.
- Treasury shares: dashed ring, no letter. Market shares: hollow ring, no letter.
- Color is never the only signal: every circle also carries a letter or a ring style.

## C3. Setup dialog

- Player names (2 to 5). Code auto-generated, editable.
- Player count drives starting cash from the table in A4, editable per player.
- Short Game checkbox: defaults per A4. At 3 or 4 players it starts unset and Start stays disabled until the user chooses.
- Ticking Short Game marks Adaptive, Overnight, Bridging and Spacious unavailable.
- Phase selector (yellow, green, purple), default yellow. Used only to clamp the start price.

## C4. Track view

- Horizontal grid of track positions, colored by zone (A4). Cropped to the occupied positions plus one position each side. A "show full track" toggle shows all 27.
- Each position shows its queue as a vertical stack, front on top. Each token is a company chip (abbreviation, company color) with its president's code.
- Non-edit mode: up and down buttons on a token move it one increment (`moveToken`).
- Edit mode: drag tokens to any position and any queue slot (`useSortable`). Also provide a per-token menu: "Move to price...", "Move to front", "Move to back", for touch and keyboard users.
- A confirm dialog appears when a move reaches position 0 (A4, closing).
- Turn order is readable directly: right to left or left to right is a design decision (see C9).

## C5. Ownership view

- One row per active company, in turn order.
- Columns: a column per player, then Treasury, then Market.
- Each cell shows that holder's regular shares as circles (C2). The president's cell also shows the crown double-circle.
- Row footer shows the check (shares total 100%) and any warnings.
- Edit mode: each cell has a number stepper. The president column offers a picker. A "Transfer presidency" button appears when `presidencyCandidate` returns a player.

## C6. Scoreboard view

- Spreadsheet layout. Players are columns. Rows, top to bottom: Cash (editable in the Scoreboard), one row per active company (shares times price, with the share count and price visible), Total.
- Rank and leader are highlighted. If the tie-break decides the order, show a note naming the rule.
- Phase 2 extended mode: one column per completed cycle, plus a cycle indicator (C10).

## C7. Start company dialog (Phase 1)

- Choose an unstarted minor. Choose the president (player). Enter the winning bid (multiples of 5, minimum 120), or choose the starting price directly on the track.
- Shows the resulting price using `startPrice(bid, phase)`.
- The winning bid is deducted from the president's cash, in Phase 1 too (decided 2026-10-06). Phase 2 also adds it to the company treasury, which Phase 1 does not track.
- The dialog gives the president card to the chosen player and puts the 3 regular cards in the company treasury.

## C8. Merge wizard

`Stepper` in a `Dialog`, three steps:
1. Select minor A and minor B (two different active minors).
2. Select an unstarted major.
3. Preview: new president (with the reason: most shares, or tie-break), new price, and the conversion table. If `needsChoice`, show a required selector for the tied players. Confirm applies the merge as one undoable step.

## C9. Design handoff notes

For the UI design agents:
- Deliver wireframes and visual specs for: Track view, Ownership view, Scoreboard view, Setup dialog, Start company dialog, Merge wizard, the edit-mode banner and state, the share circle and crown, and (Phase 2) the Dividend view and its helper window.
- Open design decisions: turn order direction on the track (highest price left or right), compact layout for 5 players on a phone, how edit mode is signaled (banner plus a colored frame), and the crown artwork.
- Constraints: PrimeVue components and Aura tokens, touch targets at least 44 px, readable at arm's length on a shared table, all information carried by more than color alone.

## C10. Phase 2 screens

### Dividend view

- Lists active companies in turn order. For each, enter earnings `E` and choose Pay, Withhold or No train.
- Shows per-player payout from share ownership, plus the treasury amount and the bank amount (information only, because the bank is not tracked).
- Applies the price rule from A4. A helper window states the rule applied and reminds the user to move the physical token. Examples of text:
  - "Payout is at least 2x the share price. Price rises 2 steps (80 to 100). Move the physical token."
  - "Payout is above 0 and below the share price. Price is unchanged. Move the token below the other tokens in its column."
  - "Earnings withheld. Price drops 1 step."
  - "No train. Earnings count as 0. Price drops 1 step."

### Round tracking and history

- Round indicator: cycle number (of 4 or 6), and round type (SR, OR1, OR2, MR).
- Scoreboard snapshot at the end of each full cycle (after the MR). Extended mode shows one column per cycle.

### Transactions

- Buy: player pays the current price to the company treasury or to the bank. Maximum one buy per turn. Sell: any number of shares, one price drop per sale action. Enforce the 60% and 50% limits and block selling the president card.
- Start company: as C7, with the cash changes.
- Issue and redeem shares (see D4).
- Company treasuries (cash) are tracked in Phase 2.

---

# Part D: Phases, tests, assumptions

## D1. Phase 1

Setup, Track view with queues, Ownership view, Scoreboard (manual cash), Start company dialog, Merge wizard, edit mode, undo and redo, multiple saved games, JSON export and import, player codes and share circles, validation warnings, presidency transfer helper, price-0 closing.

Not in Phase 1: Dividend view, buy and sell transactions, treasury cash, round tracking, scoreboard history.

## D2. Phase 2

Dividend view with automatic cash credit, buy and sell transactions, start company with cash, treasury cash, issue and redeem, end-of-Stock-Round bonus, round tracking, scoreboard history per cycle.

## D3. Acceptance tests (Vitest fixtures)

1. Track: `TRACK.length === 27`. `snapDown(87.5) === 80`. `snapDown(137) === 135`. `snapDown(9) === 0`.
2. Start price: `startPrice(120,'yellow')=60`, `(160,'yellow')=80`, `(175,'yellow')=80`, `(130,'yellow')=60`, `(200,'yellow')=90`, `(200,'green')=100`, `(300,'green')=110`, `(300,'purple')=135`. `startPrice(115,...)` and `startPrice(122,...)` throw.
3. Move: from 110, up 2 gives 135 (via 120). From 500, up stays 500 and the token goes to the back. From 10, down 1 requires a close confirmation.
4. Queue: a token entering an occupied position joins the back. `turnOrder` is price descending, then queue order.
5. Score: player J has cash 100, the president card plus 1 regular card of minor X (price 80), and 1 regular card of major Y (price 60). Shares = 3 in X and 1 in Y. Total = 100 + 3*80 + 1*60 = 400.
6. Tie-break: two players with equal totals. The one presiding over the company earlier in turn order ranks first. If neither presides over any company, both show the same rank.
7. Merge: A (price 70): J president (2 shares), K 1 regular, treasury 1, market 1. B (price 80): K president (2 shares), J 1 regular, K 1 regular, treasury 1. Shares: J = 2 + 1 = 3, K = 1 + 2 + 1 = 4. New president = K. M holdings: K regular 2, J regular 3, treasury 2, market 1. President card (2) + 2 + 3 + 2 + 1 = 10. Price: average 75 snaps to 70.
8. Merge tie: two players tied for most shares across A and B, one presiding over the earlier company. That player becomes president. Two tied non-presidents give `needsChoice`.
9. Presidency: K holds 3 shares, president J holds 2: `presidencyCandidate` returns K. After transfer K holds the president card and J has 2 more regular cards. Totals are unchanged.
10. Validation: share sums, 60% limit (minor 3, major 6), 50% market limit (minor 2, major 5), negative cash.
11. Player codes: (Haoran, Ari, John) gives H, A, J. (John, James) gives Jo, Ja. (Jo, John) gives unique codes. (John, John) gives John1, John2.
12. Setup: 3 and 4 players disable Start until Short Game is set. 2 players default on. 5 players default off. Starting cash 450, 300, 275, 220.
13. History: undo after a merge restores both minors, the major as unstarted, and all holdings. Redo reapplies.
14. Save: export then import returns an equal game. Import with an unknown `schemaVersion` is rejected.
15. Phase 2: dividend example in A4 (E = 120) gives J 48, K 24, treasury 24, bank 24. Cases: `E=30, P=80` unchanged and back of queue. `E=80, P=80` up 1. `E=160, P=80` up 2. Withhold drops 1. No train drops 1.

## D4. Assumptions and open items (confirm or correct at review)

Items found in the rulebook that Haoran did not discuss in the interview, with the default this spec uses:

1. Start price phase clamp (A4): the rulebook restricts the start price to the current phase's range. The interview described half the bid snapped to the track. This spec adds the clamp. Confirm.
2. No train: the rulebook says a company with no train earns 0 and its price drops 1. This replaces an earlier assumption that E = 0 changes nothing.
3. Price 0 closes the company (A4).
4. Presidency auto-transfer: the app warns and offers a one-click transfer instead of changing the president silently.
5. End-of-Stock-Round bonus: a company fully owned by players rises 1 (Phase 2).
6. Issue and redeem: issuing a share drops price 1 and gives the treasury the share's value. Redeem details to be checked against rulebook page 17 before Phase 2.
7. Merge conversion rule, the tie-break details and the `needsChoice` fallback in A4 are this spec's reading of the rulebook where the text is silent.
8. The merged major's name: the app uses the first identity from `companies.json` for System and International (System, International). Confirm whether the second identity (Syndicate, Inc.) should be selectable.
9. The players list order is clockwise seating order, used for the presidency tie rule.
10. Resolved 2026-10-06: the start-company dialog deducts the winning bid from the president's cash in Phase 1. Other cash changes stay manual in Phase 1.
11. At the top of the track (500), a token that moves up stays at 500 and goes to the back of the queue.
12. The undo history is saved with the game (capped at 200 steps).
13. Refinement of the approved design: price and queue position are stored once, as the token's place in `track`, instead of as separate company fields.
