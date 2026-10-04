import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

const databaseUrl = process.env.ROOM_TEST_DATABASE_URL;
test("durable heads-up matchmaking, cancellation, leases and concurrent claims", { skip: !databaseUrl }, async (t) => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.endsWith("_test"));
  assert.equal(process.env.NEON_DATABASE_URL, undefined);
  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL_DIRECT = databaseUrl;
  const { prisma } = await import("../server/src/lib/prisma.js");
  const queue = await import("../server/src/modules/matchmaking/matchmaking.service.js");
  const rooms = await import("../server/src/modules/rooms/room.service.js");
  const { createApp } = await import("../server/src/app.js");
  const { createSession } = await import("../server/src/modules/auth/session.service.js");
  const { env } = await import("../server/src/config/env.js");
  const prefix = randomUUID();
  const users = await Promise.all(Array.from({ length: 8 }, (_, i) => prisma.user.create({ data: {
    email: `${prefix}-${i}@example.test`, passwordHash: "test-no-login", profile: { create: { username: `match-${prefix}-${i}` } }
  }})));
  const ids = users.map((u) => u.id);
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/matchmaking`;
  try {
    await t.test("authenticated API, settings and ticket ownership", async () => {
      for (const path of ["", "/join", "/heartbeat", "/cancel"]) {
        assert.equal((await fetch(base + path, { method: path ? "POST" : "GET" })).status, 401);
      }
      const { token } = await createSession(ids[0]);
      const headers = { Cookie: `${env.SESSION_COOKIE_NAME}=${token}`, "Content-Type": "application/json" };
      const status = await fetch(base, { headers });
      assert.equal(status.headers.get("cache-control"), "no-store");
      const payload = await status.json();
      assert.deepEqual(payload.match, { status: "idle" });
      assert.deepEqual(payload.settings, queue.MATCH_SETTINGS);
      assert.equal((await fetch(base + "/cancel", { method: "POST", headers, body: JSON.stringify({ ticketId: "invalid" }) })).status, 400);
      const joined = await (await fetch(base + "/join", { method: "POST", headers, body: "{}" })).json();
      assert.equal(joined.match.status, "waiting");
      assert.deepEqual(await queue.updateMatchQueue(ids[1], joined.match.ticketId, true), { status: "idle" });
      assert.equal((await queue.getMatchState(ids[0])).status, "waiting");
      assert.equal((await fetch(base + "/cancel", { method: "POST", headers, body: JSON.stringify({ ticketId: joined.match.ticketId }) })).status, 200);
      assert.equal((await queue.getMatchState(ids[0])).status, "idle");
    });

    await t.test("one account cannot match itself or enqueue twice; stale cancellation cannot remove a new search", async () => {
      const results = await Promise.all(Array.from({ length: 6 }, () => queue.joinMatchQueue(ids[0])));
      assert.ok(results.every((r) => r.status === "waiting"));
      const first = results[0];
      assert.equal(first.status, "waiting");
      if (first.status !== "waiting") throw Error("expected waiting");
      assert.equal(new Set(results.map((r) => r.status === "waiting" ? r.ticketId : "")).size, 1);
      assert.equal(await prisma.gameRoom.count({ where: { hostUserId: { in: ids } } }), 0);
      await queue.updateMatchQueue(ids[0], first.ticketId, true);
      const next = await queue.joinMatchQueue(ids[0]);
      assert.equal(next.status, "waiting");
      if (next.status !== "waiting") throw Error("expected waiting");
      assert.notEqual(next.ticketId, first.ticketId);
      await queue.updateMatchQueue(ids[0], first.ticketId, true);
      assert.deepEqual(await queue.getMatchState(ids[0]), next);
      await queue.updateMatchQueue(ids[0], next.ticketId, true);
    });

    await t.test("heartbeats renew live tickets; expired players cannot be matched or revived by stale heartbeats", async () => {
      const first = await queue.joinMatchQueue(ids[0]);
      if (first.status !== "waiting") throw Error("expected waiting");
      await prisma.matchmakingTicket.update({ where: { userId: ids[0] }, data: { expiresAt: new Date(Date.now() + 1000) } });
      await queue.updateMatchQueue(ids[0], first.ticketId, false);
      const renewed = await prisma.matchmakingTicket.findUniqueOrThrow({ where: { userId: ids[0] } });
      assert.ok(renewed.expiresAt.getTime() > Date.now() + 25000);
      await prisma.matchmakingTicket.update({ where: { userId: ids[0] }, data: { expiresAt: new Date(0) } });
      const second = await queue.joinMatchQueue(ids[1]);
      assert.equal(second.status, "waiting");
      assert.deepEqual(await queue.updateMatchQueue(ids[0], first.ticketId, false), { status: "idle" });
      if (second.status === "waiting") await queue.updateMatchQueue(ids[1], second.ticketId, true);
    });

    await t.test("six concurrent players become three distinct automatically dealt rooms", async () => {
      await Promise.all(ids.slice(0, 6).map((id) => queue.joinMatchQueue(id)));
      const states = await Promise.all(ids.slice(0, 6).map((id) => queue.getMatchState(id)));
      assert.ok(states.every((s) => s.status === "matched"));
      const codes = states.map((s) => s.status === "matched" ? s.roomCode : "");
      assert.equal(new Set(codes).size, 3);
      for (const code of new Set(codes)) {
        const room = await prisma.gameRoom.findUniqueOrThrow({ where: { roomCode: code }, include: { roomPlayers: true, hands: true } });
        assert.equal(room.status, "ACTIVE");
        assert.equal(room.gameMode, "online");
        assert.equal(room.maxPlayers, 2);
        assert.equal(room.roomPlayers.length, 2);
        assert.notEqual(room.roomPlayers[0].userId, room.roomPlayers[1].userId);
        assert.equal(room.hands.length, 1);
        assert.equal(room.potTotal, 300n);
        assert.ok(room.roomPlayers.every((p) => p.isReady && p.stack + p.currentBet === 10000n));
        assert.deepEqual(room.roomPlayers.map((p) => p.seatIndex).sort(), [0, 1]);
        for (const player of room.roomPlayers) assert.equal((await rooms.getRoomStateByCode(code, player.userId))?.game?.myHoleCards.length, 2);
      }
      await Promise.all(ids.slice(0, 6).flatMap((id) => [queue.joinMatchQueue(id), queue.joinMatchQueue(id)]));
      assert.equal(await prisma.gameRoom.count({ where: { hostUserId: { in: ids } } }), 3);
      for (const id of ids.slice(0, 6)) {
        const ticket = await prisma.matchmakingTicket.findUniqueOrThrow({ where: { userId: id } });
        assert.equal((await queue.updateMatchQueue(id, ticket.id, true)).status, "matched", "cancelling after a completed claim must preserve the room");
      }
    });

    await t.test("cancel and match races commit either cancellation or one complete room", async () => {
      const waiting = await queue.joinMatchQueue(ids[6]);
      if (waiting.status !== "waiting") throw Error("expected waiting");
      await Promise.all([queue.updateMatchQueue(ids[6], waiting.ticketId, true), queue.joinMatchQueue(ids[7])]);
      const [a, b] = await Promise.all([queue.getMatchState(ids[6]), queue.getMatchState(ids[7])]);
      if (a.status === "matched") {
        assert.equal(b.status, "matched");
        if (b.status !== "matched") throw Error("expected matched");
        assert.equal(a.roomCode, b.roomCode);
        assert.equal((await rooms.getRoomStateByCode(a.roomCode, ids[6]))?.players.length, 2);
      } else {
        assert.equal(a.status, "idle"); assert.equal(b.status, "waiting");
        if (b.status === "waiting") await queue.updateMatchQueue(ids[7], b.ticketId, true);
      }
    });

    await t.test("ended or deleted rooms never silently requeue a matched player", async () => {
      const ticket = await prisma.matchmakingTicket.findUniqueOrThrow({ where: { userId: ids[0] } });
      assert.ok(ticket.roomId);
      await prisma.gameRoom.update({ where: { id: ticket.roomId! }, data: { status: "FINISHED" } });
      assert.deepEqual(await queue.getMatchState(ids[0]), { status: "idle" });
      await prisma.gameRoom.delete({ where: { id: ticket.roomId! } });
      assert.deepEqual(await queue.getMatchState(ids[0]), { status: "idle" });
      const next = await queue.joinMatchQueue(ids[0]);
      assert.equal(next.status, "waiting");
      if (next.status === "waiting") await queue.updateMatchQueue(ids[0], next.ticketId, true);
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.gameRoom.deleteMany({ where: { hostUserId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
