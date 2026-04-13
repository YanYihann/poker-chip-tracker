# Local Development Setup

## 1. Install Dependencies

From repo root:

```bash
npm install
cd server && npm install
```

## 2. Configure Environment Variables

Create `server/.env` from `server/.env.example`:

```bash
cp server/.env.example server/.env
```

Required backend variables:

- `DATABASE_URL` (Neon pooled connection string, or local Postgres URL)
- `DATABASE_URL_DIRECT` (direct Postgres URL used by Prisma migrations)
- `PORT` (default `4001`)
- `NODE_ENV` (`development`)
- `CLIENT_ORIGIN` (comma-separated origins; default `http://localhost:3000,http://127.0.0.1:3000`)
- `SESSION_COOKIE_NAME` (default `poker_chip_session`)
- `SESSION_TTL_DAYS` (default `30`)

Create root `.env.local` if needed:

```bash
cp .env.example .env.local
```

Frontend variable:

- `NEXT_PUBLIC_API_BASE_URL` (optional; if unset, frontend uses current host + `NEXT_PUBLIC_API_PORT`)
- `NEXT_PUBLIC_API_PORT` (default `4001`)

## 3. Run Migrations

```bash
cd server
npm run prisma:generate
npm run prisma:migrate:dev
```

## 4. Start Backend + Frontend

Backend:

```bash
cd server
npm run dev
```

Frontend (new terminal):

```bash
npm run dev
```

## 5. Verify Health Endpoint

With backend running:

```bash
curl http://localhost:4001/health
```

Expected response:

- `200` with `{ "status": "ok", "database": "up" }`
