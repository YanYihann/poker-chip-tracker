# AGENTS.md

## Goal
Refactor the existing local-only mobile poker scoring web app into a multiplayer client-server app.

## Non-negotiables
- Do NOT rewrite the project from scratch.
- Preserve the current mobile-first table UI and overall interaction style as much as possible.
- Refactor incrementally.
- Keep existing working UI components whenever possible.
- Move business logic out of local-only state into a backend service.
- The server must become the source of truth for room state, turn state, betting state, hand state, and session history.

## Target architecture
- Existing frontend stays as the main client.
- Add a backend service in `/server` deployable to Render.
- Use Neon Postgres for persistence.
- Use environment variables for all secrets and runtime config.
- Prefer WebSocket-based realtime updates for room/game state.
- Use a proper ORM with migrations.

## Feature goals
1. Register / login / logout
2. Profile page
3. Create room
4. Join room by room code
5. Waiting room / lobby
6. Host starts game
7. Multiplayer shared game state
8. Show action bar only for current player
9. Save finished sessions into each user profile
10. Preserve current visual design

## Suggested stack
### Frontend
- Keep the existing frontend framework and file structure if practical
- TypeScript where possible
- Reuse current mobile UI
- Use a client-side store only for UI state, not as the source of truth

### Backend
- Node.js + TypeScript
- Express or Fastify
- Socket.IO or ws for realtime room updates
- Prisma or Drizzle ORM
- JWT or secure cookie session auth

## Coding rules
- Do not remove existing working features unless replacing them with server-backed versions.
- Keep UI components separate from business logic.
- Keep database access inside server-only modules.
- Keep API routes/controllers thin.
- Put game rules into dedicated service modules.
- Add types for all room, player, hand, action, and session objects.
- Every phase must keep the app runnable.

## Commands
Adjust these if the repo already uses different scripts.

### Frontend
- install: npm install
- dev: npm run dev
- lint: npm run lint
- typecheck: npm run typecheck
- build: npm run build

### Backend
If added in `/server`:
- install: cd server && npm install
- dev: cd server && npm run dev
- lint: cd server && npm run lint
- typecheck: cd server && npm run typecheck
- build: cd server && npm run build

## Definition of done for each phase
- No unnecessary UI redesign
- Existing screens still work unless explicitly replaced
- No TypeScript errors
- No lint errors
- New code is documented briefly
- Changed files are summarized
- Remaining tasks are listed clearly

## Important gameplay rules
- The server decides whose turn it is.
- The client must never decide authoritatively whether an action is legal.
- If it is NOT the current user's turn, the client must hide the action bar.
- If it IS the current user's turn, the client shows only legal actions for that state.
- Completed game/session results must be persisted and linked to each participating user.

## Prompt discipline for Codex
Before coding:
1. Read the repo
2. Identify current local-only state
3. Explain the migration plan
4. Implement only the requested phase
5. Run lint and typecheck
6. Summarize changes