# UX/UI Feedback

App: Railways of the Lost Atlas tracker. Each item states where it applies.

## 1. New game modal: player row layout

**Applies to:** mobile only

**Problem**
- Name field collapses to an unusable width.
- It shares a row with Code and Starting cash.
- The trash icon button has excess padding.

**Requirements**
- Name: takes all remaining width (`flex: 1; min-width: 0`). It must never collapse.
- Code: fixed width for 2 characters, reduced padding, `maxlength=2`.
- Starting cash: fixed width for 3 digits (value is always 3 digits), reduced padding, `inputmode="numeric"`, `maxlength=3`.
- Trash button: remove excess horizontal padding. Icon-only, about 2rem square tap target, `flex-shrink: 0`.

**Acceptance**
- At 360px viewport width, the Name field shows at least roughly 8 characters.
- Row does not overflow horizontally.

**Alternative (if the above is rejected)**
- Equal-width columns for Name, Code and Cash.

---

## 2. Track: overall turn order indicator

**Applies to:** mobile and regular (desktop) view

**Current behavior**
- A queue number (1, 2) appears only on companies sharing the same price space.

**Requested behavior**
1. Show a turn-order number on every company on the track, including companies alone on a space.
2. The number is the overall turn order across the whole track, not the order within one space.

**Ordering rule**
- Highest price first.
- Within the same price, keep the existing queue order.
- Numbers run consecutively from 1 across all companies.

**Example**

Current:
```
70: RE
60: EX(1), NP(2)
```

Requested:
```
70: RE(1)
60: EX(2), NP(3)
```

**Acceptance**
- Every company on the track shows exactly one number.
- Numbers are unique and consecutive (1..N).
- Numbers update when a company moves or queue order changes.

---

## 3. Ownership tab: collapsible Key

**Applies to:** mobile only

**Current behavior**
- The Key (legend explaining the symbols) is always visible and uses screen space.

**Requested behavior**
- Keep the Key, but make it collapsible.
- Collapsed by default.
- Toggle control: info icon (ℹ️) plus a caret. Caret points down when collapsed and up when expanded.

**Acceptance**
- Toggle has a tap target of at least 44px.
- Toggle is keyboard and screen-reader accessible (`aria-expanded`, `aria-controls`).
- Key content is unchanged when expanded.

**Open question**
- Remember the expanded/collapsed state across sessions? Default assumption: no.

---

## 4. Ownership tab: president icon in Key does not match the main display

**Applies to:** mobile (check regular view too)

**Current behavior**
- The president marker in the main ownership display (crown over a letter) looks good.
- The president marker in the Key renders differently.

**Requested behavior**
- Fix the Key's CSS so the president marker matches the main display: same crown-over-letter layout, size, spacing and colors.

**Implementation note**
- Preferred: reuse the same component or CSS class in both places, with a size modifier if the Key needs a smaller version. Avoid a duplicate style.

**Acceptance**
- Side-by-side at 360px, the Key marker and the main marker look the same, apart from any deliberate scale.

---

## 5. Ownership tab: quick way to add a share to a player

**Applies to:** mobile and regular view (assumed)
**Phase:** likely Phase 2

**Problem**
- There is no easy way to give a player a share of a company from the Ownership tab.

**Requested behavior**
- Add a fast, low-tap control on the Ownership tab to add a share to a player.

**Open questions (decide before implementation)**
- Entry point: per cell (company x player), per player, or per company?
- Interaction: single tap adds one share, or tap opens a picker (company, share type)?
- Share types: normal share only, or president's share too?
- Undo and removal: how does the user fix a mistaken add?
- Side effects: does adding a share change president, cash, or scores automatically?

---

## Log

Add further feedback below as numbered sections.
