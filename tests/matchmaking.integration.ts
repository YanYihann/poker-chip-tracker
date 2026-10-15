import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { io, type Socket } from "socket.io-client";
import type { RoomState } from "../server/src/modules/rooms/room.service";

const databaseUrl = process.env.ROOM_TEST_DATABASE_URL;
test("matching preparation, readiness, shared next-hand consent and races", { skip: !databaseUrl }, async (t) => {
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
  const users = await Promise.all(Array.from({ length: 10 }, (_, i) => prisma.user.create({ data: {
    email: `${prefix}-${i}@example.test`, passwordHash: "test-no-login", profile: { create: { username: `match-${prefix}-${i}` } }
  }})));
  const ids = users.map((u) => u.id);
  const server = createApp().listen(0, "127.0.0.1");
  const { setupSocketServer } = await import("../server/src/realtime/socket.js");
  const realtime = setupSocketServer(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/matchmaking`;
  const join = async (id: string, maxPlayers = 2, tier: "beginner" | "advanced" | "expert" = "beginner") => {
    const state = await queue.joinMatchQueue(id, { maxPlayers, tier });
    assert.equal(state.status, "matched");
    if (state.status !== "matched") throw Error("expected preparation table");
    return state;
  };
  const cancel = async (id: string) => {
    const ticket = await prisma.matchmakingTicket.findUnique({ where: { userId: id } });
    if (ticket) await queue.updateMatchQueue(id, ticket.id, true);
  };
  const settle = async (roomCode: string) => {
    let state = (await rooms.getRoomStateByCode(roomCode, ids[0]))!;
    while (state.game?.status === "in-progress") {
      await rooms.applyPlayerActionByRoomCode({ roomCode, userId: state.game.activePlayerUserId!, actionType: "fold" });
      state = (await rooms.getRoomStateByCode(roomCode, ids[0]))!;
    }
    assert.equal(state.game?.status, "settled");
    return state.game!.handId!;
  };
  try {
    await t.test("authenticated API publishes stakes and validates settings and ticket ownership", async () => {
      for (const path of ["", "/join", "/heartbeat", "/cancel"]) assert.equal((await fetch(base + path, { method: path ? "POST" : "GET" })).status, 401);
      const { token } = await createSession(ids[0]);
      const headers = { Cookie: `${env.SESSION_COOKIE_NAME}=${token}`, "Content-Type": "application/json" };
      const response = await fetch(base, { headers });
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()).tiers, queue.MATCH_TIERS);
      assert.equal((await fetch(base + "/join", { method: "POST", headers, body: JSON.stringify({ maxPlayers: 9, tier: "expert" }) })).status, 400);
      const first = await join(ids[0]);
      assert.deepEqual(await queue.updateMatchQueue(ids[1], first.ticketId, true), { status: "idle" });
      assert.equal((await queue.getMatchState(ids[0])).status, "matched");
      await cancel(ids[0]);
    });
    await t.test("repeated joins reserve one seat; stale cancellations cannot cancel a later search", async () => {
      const matches = await Promise.all(Array.from({ length: 6 }, () => join(ids[0])));
      assert.equal(new Set(matches.map((s) => s.roomCode)).size, 1);
      assert.equal(new Set(matches.map((s) => s.ticketId)).size, 1);
      assert.equal((await rooms.getRoomStateByCode(matches[0].roomCode, ids[0]))?.players.length, 1);
      await cancel(ids[0]);
      const next = await join(ids[0]);
      assert.notEqual(next.ticketId, matches[0].ticketId);
      await queue.updateMatchQueue(ids[0], matches[0].ticketId, true);
      assert.deepEqual(await queue.getMatchState(ids[0]), next);
      await cancel(ids[0]);
    });
    await t.test("leases renew and abandoned seats and hosts are reclaimed", async () => {
      const first = await join(ids[0]);
      const second = await join(ids[1]);
      assert.equal(first.roomCode, second.roomCode);
      await prisma.matchmakingTicket.update({ where: { userId: ids[1] }, data: { expiresAt: new Date(Date.now() + 1000) } });
      await queue.updateMatchQueue(ids[1], second.ticketId, false);
      assert.ok((await prisma.matchmakingTicket.findUniqueOrThrow({ where: { userId: ids[1] } })).expiresAt.getTime() > Date.now() + 25000);
      await prisma.matchmakingTicket.update({ where: { userId: ids[0] }, data: { expiresAt: new Date(0) } });
      const replacement = await join(ids[2]);
      assert.equal(replacement.roomCode, first.roomCode);
      const state = (await rooms.getRoomStateByCode(first.roomCode, ids[1]))!;
      assert.equal(state.me?.isHost, true);
      assert.deepEqual(await queue.getMatchState(ids[0]), { status: "idle" });
      assert.deepEqual(await queue.updateMatchQueue(ids[0], first.ticketId, false), { status: "idle" });
      await Promise.all([cancel(ids[1]), cancel(ids[2])]);
    });
    await t.test("different stakes and sizes never mix; cancellation vacates the preparation seat", async () => {
      const matches = await Promise.all([join(ids[0], 2, "beginner"), join(ids[1], 2, "advanced"), join(ids[2], 2, "expert"), join(ids[3], 3, "beginner")]);
      assert.equal(new Set(matches.map((s) => s.roomCode)).size, 4);
      for (let i = 0; i < 3; i++) {
        const room = (await rooms.getRoomStateByCode(matches[i].roomCode, ids[i]))!;
        assert.equal(room.room.startingStack, [10000, 50000, 100000][i]);
        assert.equal(room.room.smallBlind, [100, 500, 1000][i]);
        assert.equal(room.room.bigBlind, [200, 1000, 2000][i]);
        assert.equal(room.game, null);
      }
      await Promise.all(ids.slice(0, 4).map(cancel));
    });
    await t.test("full table supports swaps; readiness is explicit and the last ready click deals exactly once", async () => {
      const matches = await Promise.all(ids.slice(0, 4).map((id) => join(id, 4, "advanced")));
      const roomCode = matches[0].roomCode;
      assert.equal(new Set(matches.map((s) => s.roomCode)).size, 1);
      let state = (await rooms.getRoomStateByCode(roomCode, ids[0]))!;
      assert.ok(state.players.every((p) => !p.isReady));
      assert.equal(state.game, null);
      await assert.rejects(rooms.startRoomByHost({ roomCode, hostUserId: state.room.hostUserId }), /ROOM_NOT_READY/);
      await assert.rejects(rooms.joinRoomByCode({ roomCode, userId: ids[4] }), /MATCHMAKING_ONLY/);
      const target = state.players.find((p) => p.userId === ids[1])!.seatIndex!;
      state = await rooms.setPlayerSeatByRoomCode({ roomCode, userId: ids[0], seatIndex: target });
      assert.equal(state.me?.seatIndex, target);
      assert.equal(new Set(state.players.map((p) => p.seatIndex)).size, 4);
      await rooms.setPlayerReadyByRoomCode({ roomCode, userId: ids[0], isReady: true });
      await assert.rejects(rooms.setPlayerSeatByRoomCode({ roomCode, userId: ids[1], seatIndex: target }), /SEAT_TAKEN/);
      state = await rooms.setPlayerReadyByRoomCode({ roomCode, userId: ids[0], isReady: false });
      assert.equal(state.me?.isReady, false);
      await Promise.all(ids.slice(0, 3).map((userId) => rooms.setPlayerReadyByRoomCode({ roomCode, userId, isReady: true })));
      assert.equal((await rooms.getRoomStateByCode(roomCode, ids[0]))?.room.status, "waiting");
      const readyRace = await Promise.allSettled([1, 2].map(() => rooms.setPlayerReadyByRoomCode({ roomCode, userId: ids[3], isReady: true })));
      assert.ok(readyRace.some((r) => r.status === "fulfilled"));
      const room = await prisma.gameRoom.findUniqueOrThrow({ where: { roomCode }, include: { hands: true, roomPlayers: true } });
      assert.equal(room.hands.length, 1);
      assert.equal(room.status, "ACTIVE");
      assert.ok(room.roomPlayers.every((p) => p.stack + p.currentBet === 50000n));
      for (const id of ids.slice(0, 4)) assert.equal((await rooms.getRoomStateByCode(roomCode, id))?.game?.myHoleCards.length, 2);
      assert.equal((await queue.updateMatchQueue(ids[0], matches[0].ticketId, true)).status, "matched");
      const handId = await settle(roomCode);
      for (const userId of ids.slice(0, 3)) {
        state = await rooms.decideNextHandByRoomCode({ roomCode, userId, continueSession: true, handId });
        assert.equal(state.game?.status, "settled");
        assert.equal(state.game?.canDecideNextHand, true);
      }
      await assert.rejects(rooms.decideNextHandByRoomCode({ roomCode, userId: ids[4], continueSession: false, handId }), /NOT_A_MEMBER/);
      await Promise.all(ids.slice(0, 4).map((userId) => rooms.decideNextHandByRoomCode({ roomCode, userId, continueSession: true, handId })));
      assert.equal((await rooms.getRoomStateByCode(roomCode, ids[0]))?.room.currentHandNumber, 2);
      assert.equal(await prisma.hand.count({ where: { roomId: room.id } }), 2);
      const nextId = await settle(roomCode);
      assert.deepEqual((await rooms.getRoomStateByCode(roomCode, ids[0]))?.game?.nextHandReadyUserIds, []);
      await rooms.decideNextHandByRoomCode({ roomCode, userId: ids[0], continueSession: true, handId: nextId });
      state = await rooms.decideNextHandByRoomCode({ roomCode, userId: ids[1], continueSession: false, handId: nextId });
      assert.equal(state.room.status, "finished");
      assert.equal(state.players.reduce((sum, p) => sum + p.stack, 0), 200000);
    });
    await t.test("end choice wins against final consent and archives once with refunded blinds", async () => {
      const a = await join(ids[4]);
      await join(ids[5]);
      for (const userId of ids.slice(4, 6)) await rooms.setPlayerReadyByRoomCode({ roomCode: a.roomCode, userId, isReady: true });
      const handId = await settle(a.roomCode);
      await rooms.decideNextHandByRoomCode({ roomCode: a.roomCode, userId: ids[4], continueSession: true, handId });
      await Promise.all([
        rooms.decideNextHandByRoomCode({ roomCode: a.roomCode, userId: ids[5], continueSession: true, handId }),
        rooms.decideNextHandByRoomCode({ roomCode: a.roomCode, userId: ids[4], continueSession: false, handId })
      ]);
      const state = (await rooms.getRoomStateByCode(a.roomCode, ids[4]))!;
      assert.equal(state.room.status, "finished");
      assert.equal(state.players.reduce((s, p) => s + p.stack, 0), 20000);
      assert.equal(await prisma.gameSession.count({ where: { roomId: state.room.id } }), 1);
      assert.equal(await prisma.hand.count({ where: { roomId: state.room.id } }), 1);
    });
    await t.test("HTTP actions push personalized next-turn legality and private cards directly to both sockets", async () => {
      const a = await join(ids[6]);
      await join(ids[7]);
      for (const userId of ids.slice(6, 8)) await rooms.setPlayerReadyByRoomCode({ roomCode: a.roomCode, userId, isReady: true });
      const states = await Promise.all(ids.slice(6, 8).map((id) => rooms.getRoomStateByCode(a.roomCode, id)));
      const sessions = await Promise.all(ids.slice(6, 8).map(createSession));
      const sockets: Socket[] = [];
      const nextState = (socket: Socket, predicate: (state: RoomState) => boolean) => new Promise<RoomState>((resolve, reject) => {
        const timeout = setTimeout(() => { socket.off("room:state", listener); reject(Error("Personalized state not pushed")); }, 4000);
        const listener = (state: RoomState) => { if (predicate(state)) { clearTimeout(timeout); socket.off("room:state", listener); resolve(state); } };
        socket.on("room:state", listener);
      });
      try {
        for (const session of sessions) {
          const socket = io(base.replace("/api/matchmaking", ""), { transports: ["websocket"], extraHeaders: { Cookie: `${env.SESSION_COOKIE_NAME}=${session.token}` } });
          sockets.push(socket);
          const initial = nextState(socket, (state) => state.room.code === a.roomCode);
          socket.emit("room:subscribe", { roomCode: a.roomCode });
          await initial;
        }
        const actingId = states[0]!.game!.activePlayerUserId!;
        const actorIndex = ids.slice(6, 8).indexOf(actingId);
        const delivered = sockets.map((socket) => nextState(socket, (state) => state.game?.lastAction?.actionType === "call"));
        const response = await fetch(base.replace("/api/matchmaking", `/api/rooms/${a.roomCode}/action`), {
          method: "POST", headers: { Cookie: `${env.SESSION_COOKIE_NAME}=${sessions[actorIndex].token}`, "Content-Type": "application/json" }, body: JSON.stringify({ actionType: "call" })
        });
        assert.equal(response.status, 200);
        const received = await Promise.all(delivered);
        for (let i = 0; i < received.length; i++) {
          assert.equal(received[i].me?.userId, ids[i + 6]);
          assert.deepEqual(received[i].game?.myHoleCards, states[i]?.game?.myHoleCards);
          assert.equal(received[i].game?.isMyTurn, i !== actorIndex);
          if (i !== actorIndex) assert.ok(received[i].game?.legalActions.includes("check"));
        }
        const handId = await settle(a.roomCode);
        await rooms.decideNextHandByRoomCode({ roomCode: a.roomCode, userId: ids[6], continueSession: false, handId });
      } finally { sockets.forEach((socket) => socket.disconnect()); }
    });
    await t.test("six concurrent players reserve three rooms, without early dealing", async () => {
      const matches = await Promise.all(ids.slice(0, 6).map((id) => join(id)));
      const codes = new Set(matches.map((s) => s.roomCode));
      assert.equal(codes.size, 3);
      for (const roomCode of codes) {
        const state = (await rooms.getRoomStateByCode(roomCode, ids[0]))!;
        assert.equal(state.players.length, 2);
        assert.equal(state.game, null);
      }
      await Promise.all(ids.slice(0, 6).map(cancel));
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => realtime.close(() => resolve()));
    // Host transfer can change the original host, so scope cleanup to all test ids.
    await prisma.gameRoom.deleteMany({ where: { hostUserId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
