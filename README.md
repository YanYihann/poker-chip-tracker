# PokerChip Ledger

Texas Hold'em chip scoring app migrating from local-only to server-authoritative multiplayer.

## Current Status

- Frontend: Next.js + TypeScript + Tailwind
- Backend: Express + TypeScript + Prisma
- Database: Neon Postgres
- Realtime: Socket.IO
- Auth/Profile: implemented
- Rooms/Lobby: implemented
- Server-authoritative table actions: implemented
- Session archival + profile history: implemented

## Local Run

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run dev
```

Detailed setup: [docs/local-dev.md](docs/local-dev.md)

## Environment Variables

Frontend:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_API_PORT`

Backend:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `PORT`
- `NODE_ENV`
- `CLIENT_ORIGIN`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_DAYS`

Examples:

- root: `.env.example`
- backend: `server/.env.example`

## Deployment

- Railway + Neon guide: [docs/deployment-railway-neon.md](docs/deployment-railway-neon.md)
- Deployment checklist: [docs/deployment-checklist.md](docs/deployment-checklist.md)

## Health Check

Backend health endpoint:

- `GET /health`
