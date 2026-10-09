# Phase 2 Implementation List

Date: 2026-10-10
Status: Draft v1 for review
Owner: Haoran
Audience: Claude Code (implementation), UI design agents (design backlog).

## 0. Sources and precedence

Sources: `lost-atlas-tracker-design-spec.md` (the spec), `mobile-ux-feedback.md` (the feedback), the rulebook PDF, and the design canvas (Lost Atlas Tracker).

Precedence, highest first:
1. The feedback overrides the spec where they differ (UI and behavior).
2. The rulebook overrides the spec for game rules.
3. The spec.

Status columns:
- Spec: rules and behavior are written in the spec.
- Design: a board exists on the canvas. Yes, Partial or No.
- Code: assumed No for every Phase 2 item, except items marked "Done in Plan 1" (Phase 2 Foundation, schema version 2). Phase 1 is assumed implemented as listed in spec D1. Confirm both assumptions.

Rulebook page references: Stock Round pp.10 to 11, Operating Round pp.12 to 17, Merger Round p.18, Export a train p.19.

## 1. Phase boundary

### Phase 1 baseline (already built, do not re-implement)

Setup dialog, Track view with queues, Ownership view, Scoreboard (manual cash), Start company dialog, Merge wizard, edit mode, undo and redo, saved games, JSON export and import, player codes, share circles, validation warnings, presidency transfer helper, price 0 closing.

### Phase 2 adds

Live game tracking: rounds, stock round buy and sell, dividends, issue and redeem, start company with cash, treasury cash, end-of-Stock-Round bonus, scoreboard by cycle.

### Rules for Phase 2 work

1. Extend, do not rewrite. Phase 2 reuses the Phase 1 views, dialogs, domain functions and `useGame()`.
2. Phase 1 views gain switches, not replacements:
   - Fourth tab is contextual: Stock in a Stock Round, Dividend in an Operating Round.
   - Ownership gains a "Shares / Treasury cash" switch.
   - Scoreboard gains a "Now / By cycle" switch.
   - The Start company dialog gains a cash step (one dialog, two modes).
   - The Merge wizard gains treasury cash and Merger Round gating.
3. Phase 1 saved games must load. See P2-01.
4. Edit mode stays the escape hatch for anything Phase 2 does not model.
5. Phase 2 domain code follows the Phase 1 pattern: pure functions, return a new `Game` or a plan, one history entry per user action.

## 2. Overrides from the feedback (Phase 1 changes)

These change Phase 1 behavior. They override the spec sections shown. Code status is unknown: mark each done or not done.

| Id | Applies to | Overrides | Change | Design board to update | Code |
|---|---|---|---|---|---|
| F1 | Mobile | Spec C3 | New game player row: Name takes all remaining width (`flex: 1; min-width: 0`), Code fixed to 2 characters (`maxlength=2`), Starting cash fixed to 3 digits (`inputmode="numeric"`, `maxlength=3`), trash button icon-only about 2rem square, `flex-shrink: 0`. At 360px the Name shows at least about 8 characters and the row does not overflow. | Setup (no phone layout exists) | ? |
| F2 | Mobile and desktop | Spec C4 | Every company token on the track shows one overall turn-order number. Highest price first, queue order within a price, consecutive from 1 to N. Replaces the queue number that only appears on shared positions. Updates when a token moves or the queue changes. | Main, TrackPhone | ? |
| F3 | Mobile | Spec C5 | Ownership Key is collapsible, collapsed by default. Toggle: info icon plus caret (down when collapsed, up when expanded). Tap target at least 44px. `aria-expanded` and `aria-controls`. Content unchanged. | Ownership (no phone layout exists) | ? |
| F4 | Mobile (check desktop) | Spec C2 | President marker in the Key matches the main display (crown over letter, same size, spacing, colors). Reuse the same component or class with a size modifier. No duplicate style. | Components | ? |
| F5 | Both (assumed) | New | Quick way to add a share to a player on the Ownership tab. Phase 2. Needs decisions, see section 5, D2. | Ownership | No |

Notes:
- F2 also drives Phase 2: the Operating Round order and the Dividend list use the same numbers.
- F3 open question: remember the state across sessions. Default: no.
- The spec header now points here for precedence.
- F1 to F4 shipped in commit aed455a per its message; not verified in the running app.

## 3. Phase 2 implementation list

### A. Foundation

| Id | Item | Spec | Design | Depends on |
|---|---|---|---|---|
| P2-01 | `schemaVersion` 2 and migration. Add `Company.treasuryCash` (default 0), `Company.operated` (default true for active companies), `Company.ledger` (empty), `Game.round`, `Game.cycleScores` (empty), `Game.soldThisRound` (empty). Phase 1 files import and export without loss. Done in Plan 1. Also adds `Game.operating { acted, issuedOrRedeemed }`. | B3, B7 | n/a | |
| P2-02 | Live mode flag `settings.live`. Phase 2 automation (cash changes, rounds, ledger) runs only when on. Games created in Phase 1, and "final state entry" games, stay manual. See D1. Done in Plan 1 for the flag only (`settings.live`, `setLive`); the Setup toggle comes in a later plan. | New | No | P2-01 |
| P2-03 | Domain modules, pure and tested: `stock.ts` (sell plan, buy plan, validation), `dividend.ts` (payouts, price effect), `rounds.ts` (advance, Merger Round gating, end-of-Stock-Round bonus, snapshot), `treasury.ts` (ledger entries). Extend `validate()` with: negative treasury cash, bank pool above 50% after issue. | A4, B4 | n/a | P2-01 |
| P2-04 | Every Phase 2 action is one history entry (one `Game` assignment). | B5 | n/a | P2-03 |

### B. Rounds and shell

| Id | Item | Spec | Design | Depends on |
|---|---|---|---|---|
| P2-10 | Round state machine: cycle 1 to 4 or 6; SR, OR1, OR2, then MR only when the phase is green or later, then Export a train (reminder), then the next SR. Yellow phase skips the MR. If the phase turns green at Export a train, no MR that cycle. | A4, C10 | Yes (Rounds) | P2-01 |
| P2-11 | Round bar in the shell on every view: cycle, round chips, progress text. | C10 | Partial (shown on StockTurn and Dividend only) | P2-10 |
| P2-12 | Phase control (Yellow, Green, Purple). Drives the start price range and the MR gating. Manual change only. | C10 | Yes (Rounds) | P2-10 |
| P2-13 | Contextual fourth tab and action gating: Start company only in SR; Merge only in MR and phase green or later. | C1, C10 | Partial (tab label for MR undefined, see D4) | P2-10 |
| P2-14 | Cycle snapshot: store every player's total at cycle end. "Save snapshot now" button. Stored in `Game.cycleScores`, so undo rewinds it. | C6, C10 | Yes (ScoreboardHistory) | P2-10 |
| P2-15 | End of game: after the last cycle, show the final ranking with the tie-break note. | A3 | No | P2-10 |

### C. Stock Round

| Id | Item | Spec | Design | Depends on |
|---|---|---|---|---|
| P2-20 | Stock turn: choose the player on turn, sell (any number of shares, once per turn), then buy one share. Confirm applies the turn as one history entry. | A4, C10 | Partial (StockTurn, tablet only) | P2-03 |
| P2-21 | Sale rules: the price drops 1 step per company sold, however many shares. President card cannot be sold. Minor with `operated = false` cannot be sold. Bank pool stays at 50% or less. Cash comes from the bank. | A4 | Yes | P2-20 |
| P2-22 | Presidency change during a sale or purchase: when another player ends with more shares than the president, prompt the exchange (president card and 2 regular shares). Reuse Phase 1 `transferPresidency`. | A4 | No | P2-20 |
| P2-23 | Buy rules: from the treasury (pays the company treasury) or the bank pool (pays the bank). Player holds at most 60%. Cannot buy a company sold in the same SR. Disable when cash is below the price. | A4 | Partial (no insufficient-cash state) | P2-20 |
| P2-24 | `soldThisRound`: record sold companies per player, clear at the start of each SR. | B3 | n/a | P2-20 |
| P2-25 | Start company with cash: same dialog as Phase 1 with a cash step. Bid leaves the president's cash and enters the company treasury. Bid maximum is the president's cash. Start as a turn type inside the Stock Round. Ledger entry. | C7, C10 | Yes (StartCompanyP2); turn integration No | P2-20 |
| P2-26 | End of Stock Round: "End Stock Round" action (the app does not count passes). Companies with no treasury and no bank pool shares rise 1 step and join the back of the new queue. Skip option. | A4, C10 | Partial (dialog exists in Rounds, trigger button not designed) | P2-10 |
| P2-27 | Sale or purchase that drops a price to 0 asks for confirmation, then closes the company. | A4 | No | P2-33 |

### D. Operating Round

| Id | Item | Spec | Design | Depends on |
|---|---|---|---|---|
| P2-30 | OR company sequence in turn order. Each company is Waiting, Now or Done. A company that drops in price does not act again in the same OR. Store acted companies for the round in `Game.operating.acted`. | A4, C10 | Partial (Dividend shows one OR state) | P2-10 |
| P2-31 | Dividend apply: Pay out, Withhold, No train. Pay out: minor shares pay 20% of E, major shares pay 10%, president card pays double, treasury shares pay the company treasury, bank pool shares pay nobody. Credit player cash. Price effect: 0 < E < P unchanged and token to the back; P <= E < 2P up 1; E >= 2P up 2; Withhold and No train down 1. Set `operated = true`. Ledger entries. One history entry. | A4, C10 | Yes (Dividend, DividendStates) | P2-30 |
| P2-32 | Issue or redeem, once per company per OR, before the dividend. Issue: treasury share to bank pool, company receives the price, price down 1. Redeem: company pays the price to the bank, bank pool share to treasury, price unchanged. Warn when the pool would exceed 50% (see D3). | A4, C10 | Yes (IssueRedeem); entry point from the Dividend list No | P2-30 |
| P2-33 | Price 0 closes the company from any cause. Confirm, set `closed`, clear shares, remove the token, treasury cash returns to the bank. | A4 | Yes (card 6 in DividendStates) | P2-31 |
| P2-34 | Earnings input rules: allowed values and rounding of fractional payouts. The rulebook is silent. See D5. | A4 | No | P2-31 |

### E. Treasury cash

| Id | Item | Spec | Design | Depends on |
|---|---|---|---|---|
| P2-40 | Treasury cash per company with a ledger and running balance. Automatic entries: start (bid in), treasury share bought (price in), issue (price in), redeem (price out), withhold (earnings in), treasury share payout (in), merge (combine). | A4, C10 | Yes (Treasury) | P2-01 |
| P2-41 | Manual entries: Spend or Receive, reason (Train, Track tile, Hub token, Other), amount. | C10 | Yes (Treasury) | P2-40 |
| P2-42 | Ledger correction: edit or remove an entry (or use undo). | C10 | No | P2-40 |
| P2-43 | Treasury cash is never scored. Keep it out of `playerTotal`. Done in Plan 1. | A4 | n/a | |

### F. Merge changes (extends the Phase 1 wizard)

| Id | Item | Spec | Design | Depends on |
|---|---|---|---|---|
| P2-50 | Combine treasury cash of A and B into M. Add a ledger entry. Set M `operated = true`. | A4 | No (MergePreview shows no cash line) | P2-40 |
| P2-51 | Gate the Merge button by round and phase (P2-13). Manual (non-live) games keep the Phase 1 behavior. | C1 | No | P2-02 |
| P2-52 | Merger Round step in the round tracker: merge, or finish the round. | C10 | No | P2-10 |

### G. Edit mode additions

| Id | Item | Spec | Design | Depends on |
|---|---|---|---|---|
| P2-60 | Edit mode can change: treasury cash, ledger entries, cycle and round, phase, snapshots, `operated`, `soldThisRound`. Never blocks on validation. | B8 | No | P2-40 |

### H. Layouts

Primary device is a phone. All Phase 2 boards are tablet (1024 by 768) or dialog (560 wide) only.

| Id | Item | Design |
|---|---|---|
| P2-70 | Phone layouts: StockTurn, Rounds, Dividend and DividendStates, ScoreboardHistory, Treasury, IssueRedeem, StartCompanyP2. | No |
| P2-71 | Round bar on Track, Ownership and Scoreboard (tablet and phone). | No |

### I. Quick add share (F5)

| Id | Item | Spec | Design |
|---|---|---|---|
| P2-80 | Quick add share on the Ownership tab. Blocked on decision D2. In live mode it must write a ledger entry or share a code path with the Stock Round buy. | New | No |

### J. Tests (Vitest)

| Id | Item |
|---|---|
| P2-90 | Spec D3 tests 15 to 20 (dividends, stock round, end of SR, issue and redeem, close, rounds). |
| P2-91 | Presidency change during a sale and during a purchase. |
| P2-92 | Migration: v1 file imports as v2 with defaults; v2 exports and re-imports equal; unknown version rejected. Done in Plan 1. |
| P2-93 | Live flag off: no cash, ledger or round changes. |
| P2-94 | Merge in live mode: treasury cash combines, ledger entry added. |
| P2-95 | Turn-order numbers (F2): unique, consecutive, update on move. |

## 4. Design backlog (not done)

Phase 1 board updates (from the feedback and open items):
- Setup: phone layout with the F1 row.
- Main and TrackPhone: turn-order number on every token (F2).
- Ownership: phone layout with the collapsible Key (F3).
- Components: president marker size modifier for the Key (F4).
- Federation: add a name toggle (second name unknown). Consortium, Union and Federation second names are `null` in `company-colors.json`; boards show "Name TBD" for Consortium and Union.

Phase 2 gaps:
- Phone layouts for every Phase 2 board (P2-70).
- Round bar on Track, Ownership and Scoreboard (P2-71).
- Fourth tab and actions during the Merger Round (D4).
- Merger Round step and the treasury cash line in MergePreview (P2-50, P2-52).
- Presidency exchange prompt in the Stock Round turn (P2-22).
- Insufficient-cash state in StockTurn and StartCompanyP2 (P2-23).
- Close-to-0 confirmation after a sale (P2-27).
- "End Stock Round" trigger (P2-26).
- Dividend list to Issue/redeem entry point (P2-32).
- OR company states across a whole round (P2-30).
- End of game screen (P2-15).
- Ledger entry correction (P2-42).
- Edit mode for Phase 2 data (P2-60).
- Quick add share (P2-80), after D2.

## 5. Open decisions

D1. Should Phase 2 automation be optional per game (`settings.live`)?
- A. Yes. Phase 1 style "enter the final state" games stay manual. (Recommended)
- B. No. Phase 2 automation is always on.

D2. Quick add share (F5), entry point and behavior.
- A. Tap a cell (company by player) to add one regular share. Undo through the history. No cash change.
- B. Tap a player header, then pick a company. Same effect.
- C. Open the Stock Round buy flow from the cell, so cash and ledger update.
Also decide: can it add the president card; does it change the president, cash or scores automatically (recommended: no, warn only).

D3. Issuing a share when the bank pool is at its 50% limit (rulebook silent).
- A. Warn only. (Current)
- B. Block.

D4. What does the fourth tab show during the Merger Round?
- A. Hide the tab, show the Merge wizard directly. (Recommended)
- B. Show "Merge" as the tab label and open the wizard.
- C. Keep "Dividend", disabled.

D5. Earnings input and fractional payouts.
- A. Multiples of 10 only. (Recommended)
- B. Any integer, round each payout down.

D6. Migration default for `operated` on existing active companies: true (assumes Phase 1 games were entered after the companies had operated). Confirm.

D7. F3 Key state: remember across sessions? Default no. Confirm.

## 6. Out of scope (unchanged)

Spec A5, plus: priority player marker, Minor Company matrix availability, stock drops per share variant, forced train purchase and bankruptcy, train tracking, route and map logic.
