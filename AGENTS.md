# AGENTS.md

## Mission
Evolve this app into **dual-mode poker scoring**:
- keep existing **local mode** fully working
- add **online multiplayer mode** as a new capability
- preserve the current mobile poker table UI and visual style
- ship changes incrementally (no rewrite)

## Phase 0 Lock (Must Hold in All Future Phases)
- Do not remove or replace local mode.
- Online mode is additive, not a replacement flow.
- Reuse existing UI components wherever possible.
- Keep current mobile layout, interactions, and theme tokens stable.
- Avoid large structural rewrites when a small adapter/refactor can solve it.

## Product Modes
### Local mode
- Source of truth: local client state + local persistence (current stores/snapshot/storage path).
- Must remain playable offline / single-device.
- Existing local/session behavior is preserved unless explicitly approved.

### Online mode
- Source of truth: backend room/game/session state.
- Client state is a projection/cache of server state.
- Realtime updates via socket events; authoritative mutation via server APIs.

## Architecture Guardrails
- Keep presentation components mode-agnostic:
  - `src/components/table/*`
  - `src/components/player/*`
  - `src/components/pot/*`
  - `src/components/actions/*`
- Introduce mode-specific controllers/adapters instead of branching UI everywhere.
- Keep game-rule logic out of page files.
- Keep transport details (`fetch`, sockets) outside reusable UI.
- Keep server routes thin and service/domain logic centralized.
- Keep persistence responsibilities explicit:
  - local mode -> local repository
  - online mode -> API/socket repository

## Implementation Rules
- Never delete local-mode stores/controllers until replacement local flow is verified working.
- Prefer extraction over rewrite (move logic into modules first, then switch call sites).
- Minimize UI churn: only change props and composition where needed for dual-mode support.
- Preserve style tokens and current visual hierarchy.
- Keep TypeScript types explicit for mode boundaries and DTOs.
- Every phase must leave app runnable.

## Suggested Dual-Mode Module Direction
- `src/features/local/*` for local controller + persistence adapter.
- `src/features/online/*` for room/game API + realtime adapter.
- `src/features/table/*` for shared table view-model contracts/selectors.
- `src/components/*` remains shared presentation-first.
- `server/src/modules/*` remains online authoritative domain.

## Definition of Done Per Phase
- Local mode still works end-to-end.
- Online mode behavior for touched flows still works end-to-end.
- No unnecessary visual redesign/regression.
- Lint and typecheck pass (or blocker is explicitly documented).
- Changed files and residual tasks are summarized.

## Commands
### Frontend
- install: `npm install`
- dev: `npm run dev`
- lint: `npm run lint`
- typecheck: `npm run typecheck`
- build: `npm run build`

### Backend
- install: `cd server && npm install`
- dev: `cd server && npm run dev`
- lint: `cd server && npm run lint`
- typecheck: `cd server && npm run typecheck`
- build: `cd server && npm run build`

## Prompt Discipline for Codex
Before coding:
1. Read `AGENTS.md` and `docs/*`.
2. Confirm local mode preservation constraints.
3. Audit reuse opportunities before adding new files.
4. Implement only requested phase scope.
5. Run lint and typecheck (front + server when relevant).
6. Summarize architecture impact, changed files, and next incremental step.
