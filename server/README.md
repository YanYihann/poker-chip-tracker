# poker-chip-tracker server

Backend foundation for Railway + Neon.

## Setup

1. Copy `.env.example` to `.env`.
2. Install deps: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Run migrations: `npm run prisma:migrate:deploy`
5. Start dev server: `npm run dev`

## Health check

- `GET /health`

## Auth endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Profile endpoints

- `GET /api/profile`
- `PATCH /api/profile`
- `GET /api/profile/sessions`

## Room endpoints

- `POST /api/rooms`
- `POST /api/rooms/join`
- `GET /api/rooms/:roomCode`
- `PATCH /api/rooms/:roomCode/ready`
- `POST /api/rooms/:roomCode/start`
- `POST /api/rooms/:roomCode/settle` (server-authoritative settlement)
- `POST /api/rooms/:roomCode/next-hand` (continue or archive session)

## Settlement Mode

- Online mode uses **server-side automatic hand evaluation** at showdown.
- Local synced mode keeps **host-manual winner confirmation on server**.
- Single winner, split pot, and contribution-layer side-pot payout are supported.

## WebSocket events

Server expects authenticated cookie session.

- client -> `room:subscribe` `{ roomCode }`
- client -> `room:unsubscribe` `{ roomCode }`
- client -> `room:set-ready` `{ roomCode, isReady }`
- client -> `room:start` `{ roomCode }`
- server -> `socket:ready`
- server -> `room:state` (shared room snapshot)
- server -> `room:patch` (minimal post-action state patch)
- server -> `room:error` `{ message }`

## Railway

- Build command: `npm install && npm run build`
- Start command: `npm run start` (includes `prisma migrate deploy` before boot)
- Required env vars: `DATABASE_URL`, `DATABASE_URL_DIRECT`, `PORT`, `NODE_ENV`, `CLIENT_ORIGIN`

## Neon Connection Pooling

- Use Neon pooler endpoint in `DATABASE_URL` for runtime traffic.
- Add `connection_limit=10` (or a similarly conservative value) to reduce queue jitter under spikes.
- Keep `DATABASE_URL_DIRECT` on Neon direct endpoint for migrations.

Example runtime URL:

- `postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=10`

Example direct URL:

- `postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

## Performance Metrics

- In-process p50/p95 timing metrics are emitted for:
- `rooms.fetchRoomByCode`
- `rooms.applyPlayerActionByRoomCode`
- `realtime.broadcastRoomState`
- Metrics log every 50 samples and also warn on slow calls (`>=250ms`).
