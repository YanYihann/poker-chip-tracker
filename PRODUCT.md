# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Friends playing Texas Hold'em together, either around one physical table or in a shared online room. The user confirmed both experiences matter; sign-in and entering a game are the current priority.

## Product Purpose

Track chips, turns, pots and settlement in a local session, or play an authoritative server-dealt online game. Success means people can understand their options, enter a table and complete a hand without guessing what to do next.

## Operating Context

Single-device offline scoring needs no account. Synced rooms require an account and a four-digit room code. Hosts choose scoring-only or server-dealt play. The web app supports Chinese and English on desktop and mobile.

New visits default to English. Explicit language choices are remembered in the current browser. New rooms and local sessions default to four players.

## Capabilities and Constraints

Existing Next.js/React/Zustand/Framer Motion client, Express/Prisma backend, Vercel and Neon deployment. Keep working rules, offline persistence, user data, auth and routes. The user explicitly authorizes a substantial visual, layout and motion redesign, overriding older visual-preservation instructions.

## Brand Commitments

Existing product name: PokerChip Ledger. No supplied logo or new brand name. Visual identity is open for replacement.

## Evidence on Hand

Working local and online flows, domain poker.yanyihan.top, automated rule tests. No testimonials, commercial claims or audience statistics supplied.

## Product Principles

- Make sign-in and game entry clear before secondary settings.
- Give local and online play equally legible paths.
- Keep poker actions and game state understandable.
- Preserve sessions and provide accessible controls.

## Online random matching

Signed-in players can use Quick match for 2–8 players at Beginner (10,000 chips, 100/200 blinds), Advanced (50,000 chips, 500/1,000 blinds), or Expert (100,000 chips, 1,000/2,000 blinds) stakes. Starting a match immediately reserves a seat and opens the preparation table; further players join the same stakes and table size. Players can move to an empty seat or swap with an unready player, then explicitly choose Ready. The server deals once the table is full and everyone is ready. Leaving preparation vacates the seat; abandoned seats expire after a 30-second lease. After each settled online hand, all seated players with chips must choose the next hand before play continues; any participant can end the session through confirmation, including while waiting for others. Matched sessions use the existing online history, P/L and final report. Private room entry and host-start behavior, plus offline/synced local scoring and operator/host next-hand decisions, remain available.
