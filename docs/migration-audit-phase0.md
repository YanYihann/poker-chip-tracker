# Incremental Migration Audit (Phase 0)

Date: 2026-04-13
Scope: Audit existing local-only app and prepare client-server migration without rewriting UI.

## 1) Architecture Summary

Current architecture is a **single Next.js client app** with local-first state and storage:

- UI layer: `src/app/*` + `src/components/*`
- State layer: multiple zustand stores in `src/store/*`
- Domain/controller layer: mostly centralized in `src/features/table/useTableController.ts`
- Pure helper rules: `src/features/table/rules.ts`
- Snapshot/persistence: `src/features/table/snapshot.ts` + `src/features/persistence/storage.ts` (localStorage only)

Observation:
- UI components are mostly presentational and reusable.
- Business logic is currently mixed inside `useTableController` (state machine + chip accounting + settlement + autosave + archive).
- Source of truth is local browser state (stores + localStorage), not server.

## 2) Local-only State Inventory (Required Domains)

### Players
- Primary state: `useSessionStore.players`
- Fields include stack/currentBet/totalInvested/status/position.
- Local-only mutation points:
  - `src/store/useSessionStore.ts`
  - `src/features/table/useTableController.ts` (`applyPlayerChipChange`, `runAction`, settlement handlers)

### Turn order
- Primary state: `useHandStore.actionOrder`, `useHandStore.actingPlayerId`, `useHandStore.actionIndex`
- Local-only calculation:
  - `src/features/table/rules.ts` (`buildActionOrder`, `getNextActingPlayerId`)
  - `src/features/table/useTableController.ts` (`settleRoundIfNeeded`, `runSetPlayerCount`)

### Bets
- Table-level: `useBettingStore.currentBet`, `minBet`, `minRaiseDelta`, `lastAggressiveAmount`
- Player-level bet contribution: `player.currentBet`, `player.totalInvestedThisHand`
- Local-only mutation:
  - `src/store/useBettingStore.ts`
  - `src/features/table/useTableController.ts` (`runAction`)

### Pot
- Primary state: `useBettingStore.pot`
- Local-only mutation:
  - `src/store/useBettingStore.ts`
  - `src/features/table/useTableController.ts` (`runAction`, `runQuickWin`, `runQuickSplit`)

### Hand stage
- Primary state: `useHandStore.street`, `useHandStore.status`
- Local-only transitions:
  - `src/store/useHandStore.ts`
  - `src/features/table/useTableController.ts` (`settleRoundIfNeeded`, `runEditHand`, `runEndHand`, `runReopenSettlement`)

### Session history
- Archive list: `useArchiveStore.entries`
- Undo stack and audit trail: `useHandStore.historyStack`, `useHandStore.auditTrail`
- Storage backend: localStorage keys in `src/features/persistence/storage.ts`
  - `poker-chip-ledger/live-session`
  - `poker-chip-ledger/archive-sessions`

## 3) UI vs Business Logic Separation Plan

### Keep in UI/ViewModel (client-only)
- Rendering and style composition:
  - `src/components/*`
  - `src/app/page.tsx`, `src/app/history/page.tsx`
- Visual-only interaction state (dialogs open state can stay local if derived from server status).
- Motion effects (`useMotionStore`) as presentation concern.

### Move to domain/application layer (then server-authoritative)
- Action legality checks (Fold/Check/Call/Bet/Raise/All-in availability).
- Turn progression and street transitions.
- Pot/bet/stack accounting and settlement math.
- Undo/edit/reopen semantics.
- Session archive generation semantics.

### Introduce boundary interfaces first (no multiplayer yet)
- `GameEngine` (pure deterministic domain functions)
- `TableRepository` (load/save snapshot abstraction)
- `GameGateway` (future server API/socket abstraction)

This allows replacing local impl with server impl later while preserving existing UI components.

## 4) Reusable UI Components to Preserve

These should remain mostly unchanged during migration:

- `src/components/layout/app-top-bar.tsx`
- `src/components/table/poker-table.tsx`
- `src/components/player/player-seat.tsx`
- `src/components/pot/central-pot.tsx`
- `src/components/actions/bottom-action-panel.tsx`
- `src/components/settlement/settlement-modal-placeholder.tsx`
- `src/components/history/history-page-placeholder.tsx`
- `src/components/ui/badge.tsx`
- Theme/tokens:
  - `src/styles/tokens.css`
  - `src/styles/stitch-theme.css`
  - `src/app/globals.css`

## 5) File-by-File Migration Plan

### App entry and pages
- `src/app/page.tsx`
  - Keep UI composition.
  - Move formatting helpers (currency/status labels) into selectors/view-model utilities.
  - Continue consuming a single controller hook API to avoid UI churn.
- `src/app/history/page.tsx`
  - Keep as is; switch data source from local archive store to server-backed history query later.

### Controller and feature logic
- `src/features/table/useTableController.ts`
  - Split into:
    - `src/features/table/useTableViewModel.ts` (UI-facing hook only)
    - `src/domain/game/engine.ts` (pure rule transitions)
    - `src/application/table/table-service.ts` (orchestrates actions + repository/gateway)
  - Remove direct localStorage usage from this file.
- `src/features/table/rules.ts`
  - Keep and migrate pure functions into `src/domain/game/rules/*`.
  - Add tests before changing behavior.
- `src/features/table/snapshot.ts`
  - Replace direct multi-store coupling with mapper utilities:
    - `domain state <-> client DTO <-> server DTO`

### Persistence
- `src/features/persistence/storage.ts`
  - Keep temporarily as fallback/local recovery.
  - Hide behind `TableRepository` interface and add `LocalTableRepository` implementation.
  - Add `RemoteTableRepository` stub for future server migration.

### Stores
- `src/store/useSessionStore.ts`
  - Keep for client cache/UI state.
  - Stop embedding mock bootstrap in final server mode; initialize from repository/gateway snapshot.
- `src/store/useHandStore.ts`
  - Keep temporary undo UI support.
  - Move authoritative hand progression out of store methods into domain/application service.
- `src/store/useBettingStore.ts`
  - Keep as denormalized read model cache; avoid direct business mutations in components/controller.
- `src/store/useSettlementStore.ts`
  - Keep for modal/view state.
  - Settlement decisions should call application service rather than mutate core game values directly.
- `src/store/useArchiveStore.ts`
  - Replace localStorage read/write with repository query methods.
- `src/store/useMotionStore.ts`
  - Keep unchanged (purely visual).
- `src/store/useAppStore.ts`
  - Keep or merge into table view model as lightweight UI state.

### Types and libs
- `src/types/domain.ts`
  - Split into:
    - `src/domain/game/types.ts` (authoritative game types)
    - `src/application/contracts/*.ts` (DTO/API contracts)
    - `src/features/table/view-model-types.ts` (UI-only display models)
- `src/lib/table-layout.ts`, `src/lib/cn.ts`
  - Keep unchanged (UI utilities).

### Components
- `src/components/*`
  - Preserve signatures where possible.
  - If needed, only narrow props to view models, not raw domain entities.

### Config/docs
- `AGENTS.md`
  - Already present and aligned with incremental migration constraints.
  - No mandatory change required in this phase.

## 6) Risk List

1. Fat controller risk
- `useTableController` currently mixes many responsibilities; direct split may break action ordering/settlement edge cases.

2. Divergent state risk
- Same concepts exist across multiple stores (`currentBet` and per-player `currentBet`, status flags), easy to desync during refactor.

3. Undo semantics risk
- Undo currently depends on whole-snapshot stack; partial migration to server can break deterministic rollback.

4. Autosave/resume conflict risk
- Local autosave may conflict with future server snapshots if not versioned and namespaced.

5. UI coupling risk
- Some UI labels/formatting are embedded in page/controller; moving too aggressively can cause accidental visual regression.

6. Test coverage gap risk
- No explicit automated tests around betting/settlement transitions yet; migration without baseline tests is high risk.

7. Placeholder folders drift risk
- `src/features/betting|hand|session|settlement` exist but empty, can cause confusion and architectural drift without clear ownership.

## 7) Recommended New Folders/Modules

Client (incremental, no multiplayer yet):

- `src/domain/game/`
  - `types.ts`
  - `engine.ts`
  - `rules/turn-order.ts`
  - `rules/betting.ts`
  - `rules/settlement.ts`
- `src/application/table/`
  - `table-service.ts`
  - `table-selectors.ts`
  - `ports.ts` (repository/gateway interfaces)
- `src/infrastructure/repository/`
  - `local-table-repository.ts`
  - `remote-table-repository.ts` (stub initially)
- `src/infrastructure/gateway/`
  - `http-game-gateway.ts` (stub)
  - `ws-game-gateway.ts` (stub)
- `src/features/table/`
  - `useTableViewModel.ts`

Future server:

- `server/src/modules/auth/*`
- `server/src/modules/rooms/*`
- `server/src/modules/game/*`
- `server/src/modules/sessions/*`
- `server/src/realtime/*`
- `server/src/db/*`

## 8) Suggested Incremental Migration Phases (No Multiplayer Yet)

Phase 0 (this audit):
- Document current state and boundaries.

Phase 1:
- Extract pure game engine from `useTableController` with zero UI change.
- Add unit tests for action legality, turn rotation, settlement, undo.

Phase 2:
- Introduce repository interfaces and keep localStorage implementation as default.
- Controller becomes view-model hook that calls application service only.

Phase 3:
- Scaffold `/server` and define API/socket contracts.
- Add remote repository/gateway behind feature flag; keep local fallback.

Phase 4:
- Switch source of truth to server for room/game/session state.
- Retain current UI component tree and visual style.
