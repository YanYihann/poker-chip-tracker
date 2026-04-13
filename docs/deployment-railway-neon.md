# Deployment Guide (Railway + Neon)

## Architecture

- Frontend: Next.js app (repository root)
- Backend: Node.js + TypeScript service in `server/`
- Database: Neon Postgres

## Neon Setup

1. Create a Neon project and database.
2. Copy two connection strings:
- pooled URL for app runtime (`DATABASE_URL`)
- direct URL for migrations (`DATABASE_URL_DIRECT`)
3. Keep SSL enabled in Neon URLs.

## Railway Backend Service (`/server`)

Create a Railway service from GitHub:

- Root Directory: `server`
- Build Command: `npm install && npm run prisma:generate && npm run build`
- Start Command: `npm run prisma:migrate:deploy && npm run start`
- Healthcheck Path: `/health`

Set backend environment variables:

- `NODE_ENV=production`
- `PORT=3001` (or keep Railway default and map internally if needed)
- `CLIENT_ORIGIN=<your-frontend-origin>`
- `SESSION_COOKIE_NAME=poker_chip_session`
- `SESSION_TTL_DAYS=30`
- `DATABASE_URL=<neon pooled url>`
- `DATABASE_URL_DIRECT=<neon direct url>`

## Railway Frontend Service (`/`)

Create another Railway service from the same GitHub repository:

- Root Directory: `.`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

Set frontend environment variables:

- `NEXT_PUBLIC_API_BASE_URL=<backend-public-url>`

Optional local fallback:

- `NEXT_PUBLIC_API_PORT=3001`

## Health Checks

- Backend health endpoint: `/health`
- Expected healthy payload:

```json
{
  "status": "ok",
  "database": "up"
}
```

## Secrets Hygiene

- Never commit `.env` or `.env.local`.
- Store secrets only in Railway/Neon environment variable settings.
- Rotate credentials immediately if any secret is exposed.
