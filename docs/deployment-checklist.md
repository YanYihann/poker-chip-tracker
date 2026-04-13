# Deployment Checklist

## Pre-deploy

- [ ] `npm run typecheck` passes in repo root
- [ ] `cd server && npm run typecheck` passes
- [ ] `cd server && npm run lint` passes
- [ ] Prisma client generated (`cd server && npm run prisma:generate`)
- [ ] migrations committed under `server/prisma/migrations`
- [ ] `.env` files are not committed

## Environment Variables

- [ ] Frontend `NEXT_PUBLIC_API_BASE_URL`
- [ ] Backend `DATABASE_URL`
- [ ] Backend `DATABASE_URL_DIRECT`
- [ ] Backend `CLIENT_ORIGIN`
- [ ] Backend `SESSION_COOKIE_NAME`
- [ ] Backend `SESSION_TTL_DAYS`
- [ ] Backend `NODE_ENV`
- [ ] Backend `PORT`

## Railway / Neon

- [ ] Neon database reachable from Railway
- [ ] Railway service root set correctly (`/` for frontend, `/server` for backend)
- [ ] Railway build/start commands configured
- [ ] Backend start command runs `prisma migrate deploy`
- [ ] Railway health check path set to `/health`

## Post-deploy Smoke Tests

- [ ] `GET /health` returns `200` and `database: up`
- [ ] Register + login + logout works
- [ ] Create room + join room works
- [ ] Host start game works
- [ ] In-turn action bar visibility works
- [ ] Session appears in profile history after game finish
- [ ] Session detail page shows per-user stats
