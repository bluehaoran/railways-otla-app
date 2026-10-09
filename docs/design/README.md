# Lost Atlas Tracker: design files

Design source for the web app. Read this folder before building any screen.

## Files
- `boards/*.dc.html`: one HTML reference per canvas board. Open in a browser for layout, spacing and sample data. Each file loads `./support.js`, which is not included, so a bare file may not render. Use it as a markup and style reference.
- `canvas.json`: board positions on the canvas and the notes.
- `company-colors.json`: colour and name source of truth. Copy to `src/data/companies.json`.
- `lost-atlas-tracker-design-spec.md`: product, logic and UI spec.

## Boards
| File | Screen |
|---|---|
| Main | Track (tablet) |
| TrackPhone | Track (phone) |
| Ownership | Ownership board |
| OwnershipEdit | Ownership board, edit mode |
| Scoreboard | Scoreboard (tablet) |
| ScoreboardPhone | Scoreboard (phone, 5 players) |
| Setup | New game dialog |
| StartCompany | Start company dialog |
| MergeSelect | Merge step 1: minors |
| MergeMajor | Merge step 2: major and name toggle |
| MergePreview | Merge step 3: preview, tie-break |
| MergeChoice | Merge step 3: president choice needed |
| Dividend | Phase 2 dividend view |
| Components | Share notation, colours, zones, edit signal |

## Decisions
- Tokens: zinc neutrals, emerald-700 `#047857` primary, amber `#b45309` for edit mode only. IBM Plex Sans, IBM Plex Mono for numbers. Touch targets 44px or larger.
- Track direction (changed 2026-10-06): lowest price on the left, highest on the right, so turn order reads right to left. On a phone the highest price is on top.
- Share circle: 28px, company colour, holder code. President: same circle, crown above the letter (counts as 2 shares). Treasury: dashed ring. Market: solid ring.
- Text ink per company is chosen for 4.5:1 contrast. Consortium uses `#000000` (white 4.4:1 and `#18181b` 4.1:1 both fail).
- Selected token on Track uses a bottom dock (up, down) instead of per-token buttons.
- New game: Short/Long segmented control. Defaults to Long for 3 to 4 players.
- Edit mode: amber banner, 4px frame, filled pencil.
- Merge step 2: six major cards. A toggle switches the name only; abbreviation and colour stay fixed.
- Mobile feedback, built 2026-10-10. These supersede the boards; keep them when Phase 2 changes the screens:
  - New game, phone: Name takes the remaining row width (`flex: 1; min-width: 0`). Code is 2 characters wide (`maxlength` 2 on phone, 6 on wide). Starting cash is 3 digits wide, numeric, `maxlength` 3, header reads "Cash". Trash button is 2rem square.
  - Track, wide and phone: every token shows its overall turn number, 1..N across the whole track (highest price first, then queue order), including a token alone on a price.
  - Ownership, phone: the Key is collapsible, collapsed by default, toggle is an info icon, "Key" and a caret (down collapsed, up expanded), 44px tap target, `aria-expanded` and `aria-controls`. Wide screens always show it. The state is not remembered across sessions.
  - Ownership: the president marker in the Key is the same `ShareCircle` as in the table (crown above the letter, same size and gap). Do not restyle the circles from the Key's own CSS.

## Open items
- Second names unknown: Consortium, Union, Federation (Federation has no toggle on the board yet).
- Enterprise is Experiment's second name.
- Spec D4 item 8 is superseded: second identities are selectable in the merge wizard.
- Phase 2, Ownership: a quick, low-tap way to add a share to a player (requested 2026-10-10, not built). Decide first: entry point (cell, player or company); one tap adds a share, or a picker; normal share only, or president card too; how a mistaken add is fixed (undo, or a remove control); whether it changes president, cash or scores automatically. Likely this is the Phase 2 buy transaction, so design it with that.
