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
- Turn order: highest price on the left (top on phone).
- Share circle: 28px, company colour, holder code. President: same circle, crown above the letter (counts as 2 shares). Treasury: dashed ring. Market: solid ring.
- Text ink per company is chosen for 4.5:1 contrast. Consortium uses `#000000` (white 4.4:1 and `#18181b` 4.1:1 both fail).
- Selected token on Track uses a bottom dock (up, down) instead of per-token buttons.
- New game: Short/Long segmented control. Defaults to Long for 3 to 4 players.
- Edit mode: amber banner, 4px frame, filled pencil.
- Merge step 2: six major cards. A toggle switches the name only; abbreviation and colour stay fixed.

## Open items
- Second names unknown: Consortium, Union, Federation (Federation has no toggle on the board yet).
- Enterprise is Experiment's second name.
- Spec D4 item 8 is superseded: second identities are selectable in the merge wizard.
