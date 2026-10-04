import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type {} from "../server/src/types/auth-session";
import { buildChipTransfers, summarizeOnlineSession } from "../src/features/settlement/session-summary";

const databaseUrl = process.env.ROOM_TEST_DATABASE_URL;
test("both server-backed modes archive two hands once and expose settlement to every participant", { skip: !databaseUrl }, async (t) => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.endsWith("_test"));
  assert.equal(process.env.NEON_DATABASE_URL, undefined);
  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL_DIRECT = databaseUrl;
  const { prisma } = await import("../server/src/lib/prisma.js");
  const rooms = await import("../server/src/modules/rooms/room.service.js");
  const { getSessionDetailByRoomCode } = await import("../server/src/modules/profile/profile.service.js");
  const prefix = randomUUID();
  const users = await Promise.all(Array.from({ length: 4 }, (_, i) => prisma.user.create({ data: {
    email: `${prefix}-${i}@example.test`, passwordHash: "integration-test-no-login", profile: { create: { username: `settlement-${i}` } }
  } })));
  const [host, guest, third, outsider] = users;
  const roomIds: string[] = [];
  try {
    for (const mode of ["online", "local"] as const) await t.test(mode, async () => {
      const created = await rooms.createRoom({ hostUserId: host.id, mode, maxPlayers: 3, startingStack: 2000, smallBlind: 100, bigBlind: 200 });
      roomIds.push(created.room.id);
      const roomCode = created.room.code;
      await rooms.joinRoomByCode({ roomCode, userId: guest.id });
      await rooms.joinRoomByCode({ roomCode, userId: third.id });
      await rooms.startRoomByHost({ roomCode, hostUserId: host.id });
      for (let hand = 1; hand <= 2; hand++) {
        let state = (await rooms.getRoomStateByCode(roomCode, host.id))!;
        await assert.rejects(rooms.decideNextHandByRoomCode({ roomCode, userId: host.id, continueSession: false }), /HAND_NOT_SETTLED/);
        while (state.game?.status === "in-progress") {
          assert.ok(state.game.activePlayerUserId);
          await rooms.applyPlayerActionByRoomCode({ roomCode, userId: state.game.activePlayerUserId, actionType: "fold" });
          state = (await rooms.getRoomStateByCode(roomCode, host.id))!;
        }
        if (mode === "local") state = await rooms.settleHandByRoomCode({ roomCode, userId: host.id, winnerUserIds: state.game!.eligibleWinnerUserIds });
        assert.equal(state.game?.status, "settled");
        if (hand === 1) await rooms.decideNextHandByRoomCode({ roomCode, userId: host.id, continueSession: true });
      }
      await assert.rejects(rooms.decideNextHandByRoomCode({ roomCode, userId: guest.id, continueSession: false }), /HOST_ONLY/);
      const ends = await Promise.allSettled([1, 2].map(() => rooms.decideNextHandByRoomCode({ roomCode, userId: host.id, continueSession: false })));
      assert.ok(ends.some((r) => r.status === "fulfilled"));
      assert.equal(await prisma.gameSession.count({ where: { roomId: created.room.id } }), 1);
      const profiles = await prisma.profile.findMany({ where: { userId: { in: [host.id, guest.id, third.id] } } });
      assert.ok(profiles.every((p) => p.totalSessions === (mode === "online" ? 1 : 2)), "concurrent end requests do not count a session twice");
      await assert.rejects(rooms.decideNextHandByRoomCode({ roomCode, userId: host.id, continueSession: true }), /ROOM_NOT_ACTIVE/);
      for (const user of [host, guest, third]) {
        assert.equal((await rooms.getRoomStateByCode(roomCode, user.id))?.room.status, "finished");
        const report = summarizeOnlineSession(await getSessionDetailByRoomCode({ userId: user.id, roomCode }));
        assert.equal(report.hands.length, 2);
        assert.equal(report.players.reduce((s, p) => s + p.handsWon, 0), 2);
        assert.equal(report.players.reduce((s, p) => s + p.endStack, 0), 6000);
        for (const player of report.players) {
          assert.equal(report.hands.reduce((s, h) => s + h.results.find((r) => r.playerId === player.id)!.netChange, 0), player.netChange);
          assert.equal(report.hands[1].results.find((r) => r.playerId === player.id)!.endStack, player.endStack);
          const transfers = buildChipTransfers(report.players);
          assert.equal(transfers.filter((p) => p.toPlayerId === player.id).reduce((s, p) => s + p.amount, 0) - transfers.filter((p) => p.fromPlayerId === player.id).reduce((s, p) => s + p.amount, 0), player.netChange);
        }
        for (const hand of report.hands) {
          assert.equal(hand.results.reduce((s, p) => s + p.netChange, 0), 0);
          assert.equal(hand.results.reduce((s, p) => s + p.amountWon, 0), hand.potTotal);
        }
      }
      await assert.rejects(getSessionDetailByRoomCode({ userId: outsider.id, roomCode }), /SESSION_FORBIDDEN/);
    });
  } finally {
    await prisma.gameRoom.deleteMany({ where: { id: { in: roomIds } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.$disconnect();
  }
});
