# Deployment Guide (Render + Neon)

## Architecture

- Frontend: Next.js app (this repository root)
- Backend: Node.js + TypeScript service in `server/`
- Database: Neon Postgres

## Neon Setup

1. Create a Neon project and database.
2. Copy two connection strings:
- pooled URL for app runtime (`DATABASE_URL`)
- direct URL for migrations (`DATABASE_URL_DIRECT`)
3. Confirm SSL mode is enabled in Neon URLs.

## Render Backend Service (`/server`)

Create a new Render **Web Service**:

- Root Directory: `server`
- Build Command: `npm install && npm run prisma:generate && npm run build`
- Start Command: `npm run prisma:migrate:deploy && npm run start`
- Runtime: Node 20+

Set environment variables:

- `NODE_ENV=production`
- `PORT=10000` (or Render provided port)
- `CLIENT_ORIGIN=<your-frontend-origin>`
- `SESSION_COOKIE_NAME=poker_chip_session`
- `SESSION_TTL_DAYS=30`
- `DATABASE_URL=<neon pooled url>`
- `DATABASE_URL_DIRECT=<neon direct url>`

## Frontend Deployment

Deploy frontend separately (for example Render Static Site or Vercel) and set:

- `NEXT_PUBLIC_API_BASE_URL=<backend-public-url>`

## Health Checks

- Backend health endpoint: `/health`
- Render health check path: `/health`

Expected healthy payload:

```json
{
  "status": "ok",
  "database": "up"
}
```

## Secrets Hygiene

- Never commit `.env` or `.env.local`.
- Keep secrets only in Render/Neon environment variable managers.
- Rotate credentials if a secret is exposed.
