# Vercel deployment

The Next.js frontend and Express API share one Vercel project. `/api/*` is routed through the Pages API function; the existing standalone server remains available for Socket.IO deployments.

## Production configuration

- Install from the repository root with `npm ci` (npm workspaces install the server dependencies).
- Build with `npm run build`; this generates Prisma, compiles the API and builds Next.js.
- Connect the Neon integration with Custom Prefix `NEON`. The application reads `NEON_DATABASE_URL` and `NEON_DATABASE_URL_UNPOOLED` directly; existing `DATABASE_URL` placeholders do not override them. For a standalone PostgreSQL deployment, use `DATABASE_URL` and `DATABASE_URL_DIRECT`. Never use localhost in production.
- Set `CLIENT_ORIGIN` to the deployed origin(s), comma separated.
- Set `NEXT_PUBLIC_API_TRANSPORT=polling`. Vercel functions do not run a persistent Socket.IO server; rooms refresh every 1.5 seconds while visible, with immediate API responses to user actions.
- Set `SESSION_COOKIE_NAME=poker_chip_session` and `SESSION_TTL_DAYS=30`.
- Vercel production builds apply existing Prisma migrations using the direct connection before building Next.js. Local builds do not connect to a database. For standalone deployments, run `npm run prisma:migrate:deploy --workspace server` before enabling online play.
- Deploy using `vercel --prod` and verify `/api/health` returns 200, then test authentication, two-player room joining and a complete hand.
- Configure only `poker.yanyihan.top` in DNS using the record recommended by Vercel. Leave the parent domain and other services intact.

The home route opens the game lobby. Local mode at `/local` needs no account, and its gameplay does not require the API after the page has loaded. Online play requires a reachable PostgreSQL database.

API functions use `iad1`, matching the current Neon database's AWS `us-east-1` region. Keep these regions aligned if the database moves: poker actions and settlement use transactions with several database queries. The Prisma transaction timeout is 15 seconds, with a 10 second connection wait budget.

Generated `server/dist` files are ignored and rebuilt during deployment. Production connection strings stay in environment variables.

## Room lifecycle integration checks

Use a disposable local PostgreSQL database whose name ends in `_test`. Apply `server/prisma` migrations with `DATABASE_URL` and `DATABASE_URL_DIRECT` pointing to it. Set `ROOM_TEST_DATABASE_URL` to the same connection string and run `node --import tsx --test tests/room-lifecycle.integration.ts` from the repository root. The suite refuses remote hosts and production Neon overrides; it creates and removes only its own test users and rooms. It checks uniform stacks, auto-ready, both game modes, seat/capacity races, host-only and duplicate start, and reconnect preservation. Without the opt-in variable it skips.

## Rules validation

`npm test` checks heads-up blinds and action order, the big blind's option, renewed action after raises, short all-in reopening rules, chip conservation, side-pot layers, refunds, odd chips, undo and repeated settlement protection. Rules follow [Poker TDA rules](https://www.pokertda.com/view-poker-tda-rules/), including rules 23, 36, 45 and 49. Local mode records a physical game and asks the operator to choose winners for each eligible pot; online mode evaluates dealt cards on the server.

## Final settlement validation

`npm test` also checks session net transfers, per-hand gross/net distinctions, split winners, local side-pot accumulation, snapshot restoration, undo/reopen, final archive idempotence, and the room-code report endpoint's authentication/participant guards. With the disposable local database configured as above, run `node --import tsx --test tests/session-settlement.integration.ts` to play and archive two hands in both server-backed modes. It verifies each participant's report, final balances, per-hand totals, concurrent finalization without double counting, host-only ending, locked finished rooms, and outsider rejection.
