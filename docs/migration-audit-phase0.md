# Incremental Migration Audit (Phase 0, Dual-Mode Lock)

Date: 2026-04-14  
Scope: lock the principle "preserve local mode + add online mode as additive flow", audit current repo, and define an incremental architecture plan.

## 0) Locked Constraints

- Do not replace or remove existing local poker mode.
- Add online multiplayer mode as a separate capability.
- Preserve current mobile table UI and visual style.
- Prefer incremental refactors over rewrites.
- Reuse existing components first.

## 1) Current Repo Architecture Summary

### Frontend

- Next.js app in `src/app/*`.
- Shared poker table UI is already componentized (`src/components/*`).
- Two game logic tracks currently coexist:
  - Local in-memory/localStorage game engine path (`src/features/table/*` + `src/store/*`).
  - Server-authoritative online room/game path (`src/features/rooms/*` + online pages).

### Backend

- Express + Prisma server in `server/`.
- Auth/profile/rooms modules are present.
- Server contains authoritative room + hand progression logic (`server/src/modules/rooms/room.service.ts`).
- Session/history archival is persisted in DB and exposed via profile endpoints.

### Important observation

- Local mode logic still exists, but current top-level table route (`src/app/page.tsx`) is online-room-driven.
- This means local capabilities are currently code-present but flow-fragmented.
- Dual-mode support should focus on restoring a clean local entry path while retaining current online flow.

## 2) Reusable Component Inventory (Preserve As-Is Where Possible)

### High-value reusable UI

- `src/components/table/poker-table.tsx`
- `src/components/player/player-seat.tsx`
- `src/components/pot/central-pot.tsx`
- `src/components/pot/community-board.tsx`
- `src/components/actions/bottom-action-panel.tsx`
- `src/components/layout/app-top-bar.tsx`
- `src/components/ui/badge.tsx`

### Shared UX/theming assets

- `src/styles/tokens.css`
- `src/styles/stitch-theme.css`
- `src/app/globals.css`
- `src/lib/table-layout.ts`

### Reusable online pages

- `src/app/rooms/create/page.tsx`
- `src/app/rooms/join/page.tsx`
- `src/app/rooms/[roomCode]/page.tsx`
- `src/app/auth/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/history/*`

## 3) Local-Only Game Logic Inventory

These are local-mode authoritative today:

- `src/features/table/useTableController.ts`
  - action legality + transitions
  - pot/stack mutations
  - quick settlement / undo / edit / reopen
  - autosave/resume
- `src/features/table/rules.ts`
  - position assignment, action order, turn helpers
- `src/features/table/snapshot.ts`
  - store snapshot create/apply
- `src/features/persistence/storage.ts`
  - localStorage live snapshot + archive
- `src/store/useSessionStore.ts`
- `src/store/useHandStore.ts`
- `src/store/useBettingStore.ts`
- `src/store/useSettlementStore.ts`
- `src/store/useArchiveStore.ts`
- `src/store/useMotionStore.ts` (visual events; reusable in both modes)

## 4) State Management Audit

### Local state stack

- Zustand multi-store design with snapshot-based undo/resume.
- Good for local mode continuation.
- Not currently wired as the main entry flow.

### Online state stack

- `RoomState` is fetched via REST and refreshed via socket broadcasts.
- State mostly held in page-level React state (`useState`) on online pages.
- Server is already authoritative for turn/action legality/settlement outcomes.

### Gap to solve

- No explicit mode boundary contract yet.
- Shared UI is present, but shared view-model contract is not formalized.
- Need controller adapters rather than mode-specific UI duplication.

## 5) Session / History Logic Audit

### Local path

- Archive lives in localStorage (`poker-chip-ledger/archive-sessions`).
- UI placeholder exists (`history-page-placeholder`) but current route uses server history.

### Online path

- Session archive is generated server-side when host ends session (`finalizeRoomAndArchive`).
- Profile/history pages consume:
  - `GET /api/profile/sessions`
  - `GET /api/profile/sessions/:sessionId`

### Recommendation

- Keep both history systems temporarily:
  - local history for local mode continuity
  - server history for online mode
- Unify at UI level later via explicit "Local / Online" filter or tabs.

## 6) Clean Dual-Mode Architecture Proposal

### Design principle

One shared table UI, two mode-specific controllers.

### Layering

1. **Presentation layer (shared)**
   - existing `src/components/*`
   - accepts unified table view-model props only

2. **Mode controller layer**
   - local controller adapter (wrap existing local stores/rules)
   - online controller adapter (wrap REST + socket room state)

3. **Mode data/application layer**
   - local repositories (localStorage snapshot/archive)
   - online gateway/repository (API + realtime transport)

4. **Domain logic**
   - local engine remains deterministic and testable
   - online authoritative domain remains in server room service

### Source-of-truth rules

- Local mode: client local state is authoritative.
- Online mode: server state is authoritative.
- Shared UI must not embed mode-specific mutation logic.

## 7) Proposed Folder / Module Structure (Incremental Target)

```text
src/
  app/
    page.tsx                      # route resolver / mode entry shell
    local/page.tsx                # local mode entry (new)
    online/page.tsx               # online table entry (can wrap current room flow)
    rooms/*                       # existing online lobby/join/create pages
  components/
    ...                           # keep current shared UI components
  features/
    local/
      controller.ts               # adapter over current useTableController
      repository.ts               # local snapshot/archive adapter
    online/
      controller.ts               # adapter over RoomState + actions
      gateway.ts                  # REST + socket wiring
    table/
      view-model.ts               # shared table VM contracts/selectors
      contracts.ts                # mode-agnostic action/result contracts
  store/
    ...                           # keep existing local-mode stores
```

Server remains:

```text
server/src/modules/auth/*
server/src/modules/profile/*
server/src/modules/rooms/*        # authoritative online game logic
server/src/realtime/*
```

## 8) Migration Plan (No Gameplay Rewrite in This Phase)

### Phase 0 (this phase)

- Audit and lock constraints.
- Update project rules (`AGENTS.md`).
- Do not change gameplay behavior.

### Phase 1

- Introduce explicit mode routing (`local` vs `online`) without removing existing online pages.
- Reconnect local mode entry to current local controller/stores.
- Keep shared table components unchanged.

### Phase 2

- Add shared table view-model contracts.
- Build local and online controller adapters returning same VM shape.
- Remove mode branching from shared UI components.

### Phase 3

- Split history UI by source (local vs online) while preserving both datasets.
- Keep server profile/session endpoints unchanged.

### Phase 4

- Incremental test hardening:
  - local engine transition tests
  - online room service contract tests
  - UI smoke checks for both modes

## 9) Main Risks and Controls

1. **Accidental local-mode regression**  
   Control: no deletion of local stores/controller before local route passes smoke tests.

2. **Shared UI drift due mode-specific branching**  
   Control: enforce shared VM contract at adapter boundary.

3. **History confusion (local vs online data source)**  
   Control: explicitly label source in history UX and keep repositories separate.

4. **Large rewrites hidden as "cleanup"**  
   Control: phase-by-phase PR scope with migration checklist tied to AGENTS rules.
