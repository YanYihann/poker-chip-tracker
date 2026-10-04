import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import type {} from "../server/src/types/auth-session";

test("finished-room settlement API allows every participant, denies outsiders and requires authentication", async (t) => {
  // All database methods used here are mocked; no database connection or mutation.
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/settlement_test";
  const id = "21f2096b-1fae-4c36-81c8-26eeaf839280";
  const hands = t.mock.fn(async () => [{ handNumber: 1, potTotal: 200n, results: [{ userId: "host", amountWon: 200n, netChange: 100n }, { userId: "guest", amountWon: 0n, netChange: -100n }] }]);
  const fakePrisma = { gameSession: {
    findFirst: async (query: { where: { room: { roomCode: string } } }) => query.where.room.roomCode === "1234" ? { id } : null,
    findUnique: async () => ({ id, roomId: "room", totalHands: 1, startedAt: new Date("2026-10-04"), finishedAt: new Date("2026-10-04"), room: { roomCode: "1234" }, playerStats: ["host", "guest"].map((userId, i) => ({ userId, startStack: 1000n, endStack: i ? 900n : 1100n, profitLoss: i ? -100n : 100n, handsPlayed: 1, user: { email: `${userId}@example.test`, profile: { username: userId } } })) })
  }, hand: { findMany: hands } };
  Object.defineProperty(globalThis, "prisma", { value: fakePrisma, configurable: true, writable: true });
  t.after(() => { Reflect.deleteProperty(globalThis, "prisma"); });
  const { createProfileRouter } = await import("../server/src/modules/profile/profile.routes.js");
  const app = express();
  app.use((req, _res, next) => {
    const userId = req.header("x-test-user");
    req.authSession = userId ? { userId, tokenId: "test", tokenHash: "test" } : null;
    next();
  });
  app.use("/api/profile", createProfileRouter());
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/profile/rooms`;
  try {
    for (const user of ["host", "guest"]) {
      const response = await fetch(`${base}/1234/session`, { headers: { "x-test-user": user } });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.session.me.userId, user);
      assert.equal(body.session.players.length, 2);
      assert.equal(body.session.hands[0].results[0].amountWon, "200");
    }
    const calls = hands.mock.callCount();
    assert.equal((await fetch(`${base}/1234/session`, { headers: { "x-test-user": "outsider" } })).status, 403);
    assert.equal(hands.mock.callCount(), calls, "outsiders never read hand results");
    assert.equal((await fetch(`${base}/1234/session`)).status, 401);
    assert.equal((await fetch(`${base}/9999/session`, { headers: { "x-test-user": "host" } })).status, 404);
    assert.equal((await fetch(`${base}/invalid/session`, { headers: { "x-test-user": "host" } })).status, 400);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
