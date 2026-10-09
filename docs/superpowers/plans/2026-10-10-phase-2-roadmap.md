# Phase 2 Roadmap

Date: 2026-10-10
Status: Draft for review. Only Plan 1 is written in detail.
Source: `docs/design/phase-2-implementation-list.md` (the list). Spec: `docs/design/lost-atlas-tracker-design-spec.md`. Feedback: `docs/design/mobile-ux-feedback.md`.

Phase 2 is six independent subsystems. Each plan below ends in working, tested, deployable software, and `main` deploys on push, so each plan must leave Phase 1 behavior intact for games with `settings.live = false`.

## Findings from the review

1. **The spec contradicts the code on Phase 1 start-company cash.** Spec C7 and D4.10 (rewritten in `f45fa04`) say Phase 1 does not change cash. `startCompany()` in `src/domain/company.ts` deducts the bid from the president, `StartCompanyDialog` shows "pays N from cash", and `company.test.ts` and `StartCompanyDialog.test.ts` assert it. The earlier spec text said "decided 2026-10-06: deduct in Phase 1". The plans keep the code behavior. **Needs your call:** update the spec to match the code (recommended), or remove the deduction.
2. **F1 to F4 look done.** Commit `aed455a` is "mobile feedback 1-4". The list shows Code as `?`. Not verified in the running app.
3. **The v2 schema in P2-01 is missing two fields the list needs.** P2-30 says "store acted companies for the round" and P2-32 says "once per company per OR". Neither has a field. Plan 1 adds `Game.operating = { acted, issuedOrRedeemed }` to v2 now, because v2 has not shipped and a v3 migration later is more work. Remove it if you disagree.
4. **Treasury cash on a merge.** Plan 1 leaves `applyMerge` setting the major's `treasuryCash` to 0. That loses nothing until Plan 5 makes cash non-zero, and Plan 5 (P2-50) owns the combine.
5. **Open decisions D1 to D7, plus D8 from the rulebook check (R5).** These plans assume the recommended answer for each: D1 A (optional per game), D3 A (warn only), D4 A (hide the tab, show the wizard), D5 A (multiples of 10), D6 yes (`operated = true` for active companies), D7 no (do not remember the Key state), D8 turn order. Only D2 (quick add share) blocks work, and only Plan 6.
6. **Stored size.** Every undo step is a full `Game`, and v2 adds ledgers. `write()` already halves history on a full quota. Not a blocker, but watch it once ledgers fill.
7. **PWA update lag can lose data.** A v1 tab that already has the game open ignores the v2 save: its `read()` fails on version 2 and `externalChange` returns silently. It keeps its stale game, and its next commit overwrites the v2 save with a v1 envelope. The v2 tab then migrates that save, losing its own recent edits, resetting `live` to false and, once Phase 2 data exists, losing treasury cash and ledgers. The deployed v1 code cannot be fixed. Mitigation: close other tabs of the app before updating, say so in the release note, and Plan 5 should keep this in mind.

## Rulebook cross-check

Checked against `docs/reference/RailwaysRulebook-CleanFonts.pdf` (printed pages 10 to 19; the PDF page number is the printed number plus 1). The Minor Company sheet was not read.

**Confirmed, no change:**
- Sale: price drops 1 step per company however many shares, cash at the price before the drop, president card cannot be sold, presidency moves on strictly more shares and a tie goes to the next tied player clockwise from the losing president (matches `presidencyCandidate`), minors cannot be sold before their first OR (p.10 to 11).
- Buy: treasury pays the company, bank pool pays the bank, 60% limit, no buying a company you sold this Stock Round (p.11).
- End of Stock Round: only companies with no treasury and no bank pool shares rise 1 (p.11). Passing never removes a player, so "End Stock Round" as a manual action is right.
- Dividends: minor 20% and major 10% per share, treasury shares pay the company, price effects `0 < E < P` stays and goes to the back, `P <= E < 2P` up 1, `E >= 2P` up 2, withhold down 1, no train down 1 (p.14). The 310 example gives 62 per minor share.
- Issue: company gets the price, price drops 1. Redeem: company pays the price, price unchanged (p.12).
- Price 0 for any reason dissolves the company (p.11).
- Round order, Merger Round gating, Export a train and the end of game, including "treasuries are not scored" and the tie-break (pp.18 to 19). Start price ranges 60-90, 60-110, 60-135 match the phases (p.10).
- Operating order is descending price, and a flipped token means the company has acted so it cannot act again after dropping (p.11 to 12). This matches `acted`.

**Corrections to the plans and the list:**

| # | Finding | Rulebook | Change |
|---|---|---|---|
| R1 | Issue and redeem are one action, not two. "Issue or redeem one share." | p.12 | The v2 field is `operating.issuedOrRedeemed` (renamed from `issued`). P2-32 allows one of the two per company per OR. |
| R2 | Earnings of 0 with a train are not covered by the spec. The rulebook lists "failure to generate revenue" as a cause of a price drop. | p.11 | Pay out with `E = 0` drops the price 1, same as No train. Add to P2-31 and P2-34. |
| R3 | Issue needs a share in the treasury. The list only disables Redeem on an empty bank pool. | p.12 | P2-32: disable Issue when `treasuryShares = 0`. |
| R4 | D3 says the rulebook is silent on the 50% limit for issue. The limit is worded "at any time", in the list of sale restrictions. | p.10 | The rule applies to issue too. Keep warn-only (warnings never block, `market-limit` already exists), but the warning cites the rule. D3 text needs correcting. |
| R5 | Several companies can rise into one column at End of Stock Round. The rulebook says tokens stack in the order they enter and does not say the order for this case. | p.11 | New decision D8. Default: process in current turn order, so the company that acted first stacks on top. |
| R6 | `operated` becomes true when the company completes its Operating Round, not when it starts it. | p.11 | P2-31 sets it when the dividend is applied (already so). Also an edge for D6: a v1 minor launched in the latest Stock Round migrates as `operated: true` and shows as sellable. Edit mode fixes it. |
| R7 | The next company to act must be derived from the track and `acted` every time, not from a list fixed at the start of the OR. Prices change during the round. `acted` and `issuedOrRedeemed` are cleared when an OR starts. | p.11 to 12 | Plan 2 (`rounds.ts`) and Plan 5. |
| R8 | The rulebook has a grey phase (p.16). It changes nothing the app tracks, since start prices are the same as purple and the Merger Round only needs green or later. | p.16 | None. `Phase` stays yellow, green, purple. |
| R9 | D5 (multiples of 10). Every value the rulebook shows is a multiple of 10. The map tiles were not checked. | pp.14 to 15 | Keep D5 A. A minor share is `E / 5` and a major share `E / 10`, so multiples of 10 always give whole numbers. |

## Plans

| # | Plan | List items | Deliverable | Depends on |
|---|---|---|---|---|
| 1 | Foundation: schema v2 | P2-01, P2-02 (flag only), P2-43, P2-92 | v1 saves and exports load as v2. New fields exist with defaults. No visible change. | none |
| 2 | Domain rules | P2-03, P2-04, P2-90, P2-91, P2-93, P2-94 | `stock.ts`, `dividend.ts`, `rounds.ts`, `treasury.ts`, extended `validate()`. Pure functions with the spec D3 tests 15 to 20. No UI. | 1 |
| 3 | Rounds shell | P2-10 to P2-15, P2-26, P2-71, setup toggle for `live` | Round bar, phase control, contextual fourth tab, End Stock Round, snapshots and the By cycle scoreboard, end of game. | 2 |
| 4 | Stock Round UI | P2-20 to P2-25, P2-27 | Stock turn view and start-with-cash dialog. | 3 |
| 5 | Operating Round UI and treasury | P2-30 to P2-34, P2-40 to P2-42, P2-50 to P2-52 | Dividend view, issue and redeem, Treasury switch on Ownership, ledger, merge gating and treasury combine. | 3 |
| 6 | Edit mode, phone layouts, quick add share | P2-60, P2-70, P2-80 | Edit mode for Phase 2 data, phone layouts, quick add share (after D2). | 4, 5 |

Plans 4 and 5 are independent once Plan 3 lands and can be built in either order.

Notes from Plan 2:

- `setLive(true)` on a game that already has started companies must set `operated = true` for the active companies, or the Setup toggle must be the only place `live` is chosen.
- The Export a train / phase change must be entered after the Merger Round gate, because `hasMergerRound` reads the phase at the moment OR2 ends.
- The dividend view must check `operating.acted` before calling `dividendPlan` (it throws for a company that already acted), and show `newPrice` against `price`, not `steps`, at 500.

## Not planned here

Design backlog in list section 4 (new boards). Plans 3 to 6 call out the boards each needs, and a plan stops at its first UI task if the board is missing.
