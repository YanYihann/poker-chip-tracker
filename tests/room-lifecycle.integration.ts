import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

// Explicit opt-in; never point these mutation tests at a shared or production database.
const databaseUrl = process.env.ROOM_TEST_DATABASE_URL;
test("uniform chips, automatic readiness, seat races and host-only start", { skip: !databaseUrl }, async (t) => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.endsWith("_test"));
  assert.equal(process.env.NEON_DATABASE_URL, undefined, "Do not run with production database overrides");
  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL_DIRECT = databaseUrl;
  const { prisma } = await import("../server/src/lib/prisma.js");
  const rooms = await import("../server/src/modules/rooms/room.service.js");
  const prefix = randomUUID();
  const users = await Promise.all(Array.from({ length: 4 }, (_, i) => prisma.user.create({ data: {
    email: `${prefix}-${i}@example.test`, passwordHash: "integration-test-no-login",
    profile: { create: { username: `test-${prefix}-${i}` } }
  }})));
  const [host, guest, third, outsider] = users;
  const roomIds: string[] = [];
  try {
    const defaultRoom = await rooms.createRoom({ hostUserId: host.id });
    roomIds.push(defaultRoom.room.id);
    assert.equal(defaultRoom.room.maxPlayers, 4);
    for (const mode of ["online", "local"] as const) await t.test(mode, async () => {
      const created = await rooms.createRoom({ hostUserId: host.id, mode, maxPlayers: 4, startingStack: 5000, smallBlind: 25, bigBlind: 50 });
      roomIds.push(created.room.id);
      const roomCode = created.room.code;
      assert.match(roomCode, /^\d{4}$/);
      assert.equal(created.me?.isReady, true);
      assert.equal(created.canStart, false);
      await assert.rejects(rooms.startRoomByHost({ roomCode, hostUserId: host.id }), /ROOM_NOT_READY/);
      const joined = await rooms.joinRoomByCode({ roomCode, userId: guest.id });
      assert.ok(joined.players.every((p) => p.isReady && p.stack === 5000 && p.seatIndex !== null));
      await rooms.joinRoomByCode({ roomCode, userId: third.id });
      const races = await Promise.allSettled([host, guest].map((user) => rooms.setPlayerSeatByRoomCode({ roomCode, userId: user.id, seatIndex: 3 })));
      assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
      assert.ok(races.some((r) => r.status === "rejected" && /SEAT_TAKEN/.test(String(r.reason))));
      await assert.rejects(rooms.setPlayerSeatByRoomCode({ roomCode, userId: guest.id, seatIndex: null }), /INVALID_SEAT/);
      await assert.rejects(rooms.setPlayerSeatByRoomCode({ roomCode, userId: guest.id, seatIndex: 4 }), /INVALID_SEAT/);
      await assert.rejects(rooms.setPlayerBuyInByRoomCode({ roomCode, userId: guest.id, buyIn: 8000 }), /UNIFORM_BUY_IN/);
      await assert.rejects(rooms.updateRoomBlindsByCode({ roomCode, userId: guest.id, smallBlind: 25, bigBlind: 50 }), /HOST_ONLY/);
      await assert.rejects(rooms.updateRoomBlindsByCode({ roomCode, userId: host.id, smallBlind: 25, bigBlind: 6000 }), /INVALID_BLINDS/);
      const ready = await rooms.setPlayerReadyByRoomCode({ roomCode, userId: guest.id, isReady: false });
      assert.equal(ready.me?.isReady, true);
      await assert.rejects(rooms.startRoomByHost({ roomCode, hostUserId: guest.id }), /HOST_ONLY/);
      const before = (await rooms.getRoomStateByCode(roomCode, host.id))!;
      assert.equal(before.canStart, true);
      // Legacy waiting rooms may contain individual buy-ins; start normalizes them.
      await prisma.roomPlayer.updateMany({ where: { roomId: created.room.id, userId: guest.id }, data: { stack: 8000n, totalBuyIn: 8000n, isReady: false } });
      const starts = await Promise.allSettled([1, 2].map(() => rooms.startRoomByHost({ roomCode, hostUserId: host.id })));
      assert.equal(starts.filter((r) => r.status === "fulfilled").length, 1);
      const active = (await rooms.getRoomStateByCode(roomCode, guest.id))!;
      assert.equal(active.room.status, "active");
      assert.equal(active.room.currentHandNumber, 1);
      assert.equal(active.game?.potTotal, 75);
      assert.ok(active.players.every((p) => p.stack + p.currentBet === 5000));
      for (const player of active.players) assert.equal(player.seatIndex, before.players.find((p) => p.userId === player.userId)?.seatIndex);
      const stored = await prisma.roomPlayer.findMany({ where: { roomId: created.room.id } });
      assert.ok(stored.every((p) => p.totalBuyIn === 5000n && p.isReady));
      await assert.rejects(rooms.setPlayerSeatByRoomCode({ roomCode, userId: guest.id, seatIndex: 0 }), /ROOM_NOT_WAITING/);
      await assert.rejects(rooms.joinRoomByCode({ roomCode, userId: outsider.id }), /ROOM_NOT_JOINABLE/);
      const reconnected = await rooms.joinRoomByCode({ roomCode, userId: guest.id });
      assert.deepEqual(reconnected.players.map((p) => p.stack), active.players.map((p) => p.stack));
    });
    await t.test("concurrent joins cannot overfill the last seat", async () => {
      const created = await rooms.createRoom({ hostUserId: host.id, maxPlayers: 2 });
      roomIds.push(created.room.id);
      const attempts = await Promise.allSettled([guest, third].map((user) => rooms.joinRoomByCode({ roomCode: created.room.code, userId: user.id })));
      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
      assert.ok(attempts.some((r) => r.status === "rejected" && /ROOM_FULL/.test(String(r.reason))));
      assert.equal((await rooms.getRoomStateByCode(created.room.code, host.id))?.players.length, 2);
    });
  } finally {
    await prisma.gameRoom.deleteMany({ where: { id: { in: roomIds } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.$disconnect();
  }
});
