# Game Rules

## 1. Scope

This document defines chip accounting and table-state rules for PokerChip Ledger.  
It focuses on state machine behavior, actions, rotation, settlement, undo, and persistence.

## 2. Core Models

### Player model

```ts
type Player = {
  id: string
  name: string
  avatar?: string
  seatIndex: number
  stack: number
  currentBet: number
  totalInvestedThisHand: number
  status: "waiting" | "acting" | "folded" | "all-in" | "winner"
  position?: "BTN" | "SB" | "BB" | "UTG" | "MP" | "HJ" | "CO"
}
```

### Hand stage model

```ts
type Street = "preflop" | "flop" | "turn" | "river" | "showdown"
```

### Hand status model

```ts
type HandStatus =
  | "in-progress"
  | "pre-settlement"
  | "settlement-confirmed"
```

### Action model (minimum)

```ts
type TableActionType =
  | "fold"
  | "check"
  | "bet"
  | "call"
  | "raise"
  | "all-in"
  | "quick-win"
  | "quick-split"
  | "settle-pot"
  | "undo-last-action"
  | "edit-hand"
  | "reopen-settlement"
```

## 3. Hand State Machine

### Street transitions

- `preflop -> flop -> turn -> river -> showdown`
- Enter `pre-settlement` when:
  - only one active player remains, or
  - street reaches `showdown` and winner(s) are ready to settle.
- `pre-settlement -> settlement-confirmed` after settlement confirmation.
- `settlement-confirmed` is terminal for the hand unless `reopen-settlement` is triggered.

### Guards

- Cannot move to next street while unresolved action order exists.
- Players with `status: "all-in"` do not receive normal action turns.
- Players with `status: "folded"` cannot re-enter current hand.

## 4. Action Display Rules

For current acting player:

1. If `status === "all-in"`: show no regular action buttons.
2. If `toCall === 0`: show `Fold / Check / Bet / All-in`.
3. If `toCall > 0`: show `Fold / Call / Raise / All-in`.
4. In `pre-settlement`: show `Settle Pot / Quick Win / Quick Split`.
5. In `settlement-confirmed`: hide betting actions; allow `Reopen Settlement` via admin/organizer flow.

## 5. Position Rotation Rules

- Dealer rotates clockwise by `+1` seat after each completed hand.
- `SB = next active player after Dealer`.
- `BB = next active player after SB`.
- Remaining active players get positions in clockwise order (`UTG -> MP -> HJ -> CO` as applicable).

### Heads-up special case (2 players)

- Dealer is also `SB`.
- The other player is `BB`.
- Position and action order follow heads-up poker rules.

## 6. Settlement Rules

### 6.1 Pot outcomes

- Single winner: winner collects the full eligible pot.
- Multiple winners: split the eligible pot equally.
- Side pots: each side pot is settled independently by eligibility.

### 6.2 Quick settlement shortcuts

- `Quick Win`: assign the selected pot(s) to one winner directly.
- `Quick Split`: equal split among selected winners only; no custom weighting.

### 6.3 Remainder (odd chip) rule

When pot amount is not evenly divisible:

- Compute `baseShare = floor(pot / winnerCount)`.
- Distribute remainder chips one by one clockwise, starting from the first eligible winner after Dealer.
- Rule must be deterministic and reproducible in tests.

### 6.4 Session net formula

- `net = totalCashOut - totalBuyIn`
- `net > 0`: player receives funds.
- `net < 0`: player pays funds.

## 7. Undo and Correction Rules

### 7.1 Undo Last Action

- Reverts the most recent reversible action:
  - `bet`, `call`, `raise`, `fold`, `all-in`, `quick-win`, `quick-split`, `settle-pot`.
- Must restore:
  - player stacks,
  - current bets,
  - pot totals,
  - acting order,
  - hand status/street if impacted.

### 7.2 Edit Hand

- Allows organizer to patch current hand state (players, bets, pots, street).
- Must write an audit entry describing before/after values.

### 7.3 Reopen Settlement

- Transition from `settlement-confirmed` back to `pre-settlement`.
- Existing settlement records remain in history as superseded revisions.
- Not allowed after session archive lock (unless explicit admin override is implemented).

## 8. Session Persistence Rules

- Auto-save after every state-changing action.
- Default persistence: localStorage (`autosave`).
- Optional long history/archive storage: IndexedDB.
- On app load:
  - attempt restore from active autosave snapshot,
  - if restore succeeds, resume the session,
  - if snapshot is invalid/corrupt, start clean and keep error note in diagnostics log.
- On session end:
  - mark session as completed,
  - move summary to archive history,
  - clear active live session snapshot.

## 9. Testability Requirements

The following transitions must be unit-testable:

- Street transitions and guard checks
- Position rotation for 2 players and 3+ players
- Action button availability by `toCall` and `status`
- Main pot and side pot settlement
- Odd-chip distribution determinism
- Undo/edit/reopen flows
- Autosave/restore/archive lifecycle
