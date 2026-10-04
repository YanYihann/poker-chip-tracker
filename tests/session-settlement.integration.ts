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
  const { getSessionDetailByRoomCode, getProfile, getRecentSessions, resetProfileHistory } = await import("../server/src/modules/profile/profile.service.js");
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
    await t.test("mode-specific personal totals and history reset keep other players' settlements intact", async () => {
      const before = await getProfile(host.id);
      assert.equal(before.byMode.online.sessions, 1);
      assert.equal(before.byMode.local.sessions, 1);
      assert.equal(before.totals.sessions, 2);
      assert.equal(BigInt(before.totals.net), BigInt(before.byMode.local.net) + BigInt(before.byMode.online.net));
      assert.equal("totalAssets" in before, false);
      const local = await getRecentSessions(host.id, "local");
      const online = await getRecentSessions(host.id, "online");
      assert.deepEqual(local.map((row) => row.mode), ["local"]);
      assert.deepEqual(online.map((row) => row.mode), ["online"]);
      const peerBefore = await getProfile(guest.id);
      const reset = await resetProfileHistory(host.id);
      assert.deepEqual(reset.totals, { sessions: 0, hands: 0, profit: "0", loss: "0", net: "0" });
      assert.equal((await getProfile(host.id)).byMode.local.sessions, 0);
      assert.deepEqual(await getRecentSessions(host.id), []);
      assert.deepEqual(await getProfile(guest.id), peerBefore);
      await assert.rejects(getSessionDetailByRoomCode({ userId: host.id, roomCode: local[0].roomCode }), /SESSION_FORBIDDEN/);
      const peerReport = await getSessionDetailByRoomCode({ userId: guest.id, roomCode: local[0].roomCode });
      assert.equal(peerReport.players.length, 3, "the resetting player remains in other participants' reports");
      assert.ok(peerReport.players.some((player) => player.userId === host.id));
      const created = await rooms.createRoom({ hostUserId: host.id, mode: "local", maxPlayers: 2, startingStack: 2000, smallBlind: 100, bigBlind: 200 });
      roomIds.push(created.room.id);
      const roomCode = created.room.code;
      await rooms.joinRoomByCode({ roomCode, userId: guest.id });
      await rooms.startRoomByHost({ roomCode, hostUserId: host.id });
      const active = (await rooms.getRoomStateByCode(roomCode, guest.id))!;
      assert.equal(active.room.mode, "local");
      await rooms.applyPlayerActionByRoomCode({ roomCode, userId: active.game!.activePlayerUserId!, actionType: "fold" });
      const showdown = (await rooms.getRoomStateByCode(roomCode, host.id))!;
      await rooms.settleHandByRoomCode({ roomCode, userId: host.id, winnerUserIds: showdown.game!.eligibleWinnerUserIds });
      await rooms.decideNextHandByRoomCode({ roomCode, userId: host.id, continueSession: false });
      assert.equal((await getProfile(host.id)).totals.sessions, 1, "sessions finished after reset count normally");
      assert.equal((await getRecentSessions(host.id, "local")).length, 1);
      assert.equal((await getRecentSessions(host.id, "online")).length, 0);
    });
  } finally {
    await prisma.gameRoom.deleteMany({ where: { id: { in: roomIds } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.$disconnect();
  }
});
