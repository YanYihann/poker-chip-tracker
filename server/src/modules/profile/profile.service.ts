import { prisma } from "../../lib/prisma.js";

export async function getProfile(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      username: true,
      avatarUrl: true,
      historyResetAt: true
    }
  });

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const rows = await prisma.playerSessionStat.findMany({
    where: { userId, gameSession: profile.historyResetAt ? { finishedAt: { gt: profile.historyResetAt } } : undefined },
    select: { handsPlayed: true, profitLoss: true, room: { select: { gameMode: true } } }
  });
  const summarize = (items: typeof rows) => {
    const profit = items.reduce((sum, row) => sum + (row.profitLoss > 0n ? row.profitLoss : 0n), 0n);
    const loss = items.reduce((sum, row) => sum + (row.profitLoss < 0n ? -row.profitLoss : 0n), 0n);
    return { sessions: items.length, hands: items.reduce((sum, row) => sum + row.handsPlayed, 0),
      profit: profit.toString(), loss: loss.toString(), net: (profit - loss).toString() };
  };

  return {
    username: profile.username,
    avatarUrl: profile.avatarUrl,
    historyResetAtIso: profile.historyResetAt?.toISOString() ?? null,
    totals: summarize(rows),
    byMode: { online: summarize(rows.filter((row) => row.room.gameMode === "online")), local: summarize(rows.filter((row) => row.room.gameMode === "local")) }
  };
}

export async function resetProfileHistory(userId: string) {
  // Keep shared settlement records intact for the other participants.
  await prisma.profile.update({ where: { userId }, data: {
    historyResetAt: new Date(), totalSessions: 0, totalHands: 0, totalProfit: 0n, totalLoss: 0n
  } });
  return getProfile(userId);
}

export async function updateProfile(
  userId: string,
  input: {
    username?: string;
    avatarUrl?: string | null;
  }
): Promise<{
  username: string;
  avatarUrl: string | null;
}> {
  if (input.username) {
    const existing = await prisma.profile.findUnique({
      where: { username: input.username },
      select: { userId: true }
    });

    if (existing && existing.userId !== userId) {
      throw new Error("USERNAME_EXISTS");
    }
  }

  const profile = await prisma.profile.update({
    where: { userId },
    data: {
      username: input.username?.trim(),
      avatarUrl: input.avatarUrl
    },
    select: {
      username: true,
      avatarUrl: true
    }
  });

  return {
    username: profile.username,
    avatarUrl: profile.avatarUrl
  };
}

export async function getRecentSessions(userId: string, mode?: "local" | "online"): Promise<
  Array<{
    sessionId: string;
    roomCode: string;
    mode: "local" | "online";
    startedAtIso: string;
    endedAtIso: string;
    totalHands: number;
    handsPlayed: number;
    startStack: string;
    endStack: string;
    profitLoss: string;
  }>
> {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { historyResetAt: true } });
  const rows = await prisma.playerSessionStat.findMany({
    where: { userId, room: mode ? { gameMode: mode } : undefined,
      gameSession: profile?.historyResetAt ? { finishedAt: { gt: profile.historyResetAt } } : undefined },
    select: {
      handsPlayed: true,
      profitLoss: true,
      startStack: true,
      endStack: true,
      gameSession: {
        select: {
          id: true,
          totalHands: true,
          startedAt: true,
          finishedAt: true,
          room: {
            select: {
              roomCode: true,
              gameMode: true
            }
          }
        }
      }
    },
    orderBy: {
      gameSession: {
        finishedAt: "desc"
      }
    },
    take: 20
  });

  return rows.map((row: (typeof rows)[number]) => ({
    sessionId: row.gameSession.id,
    roomCode: row.gameSession.room.roomCode,
    mode: row.gameSession.room.gameMode === "local" ? "local" : "online",
    startedAtIso: row.gameSession.startedAt.toISOString(),
    endedAtIso: row.gameSession.finishedAt.toISOString(),
    totalHands: row.gameSession.totalHands,
    handsPlayed: row.handsPlayed,
    startStack: row.startStack.toString(),
    endStack: row.endStack.toString(),
    profitLoss: row.profitLoss.toString()
  }));
}

export async function getSessionDetailByRoomCode(input: { userId: string; roomCode: string }) {
  const record = await prisma.gameSession.findFirst({ where: { room: { roomCode: input.roomCode } }, select: { id: true } });
  if (!record) throw new Error("SESSION_NOT_FOUND");
  return getSessionDetail({ userId: input.userId, sessionId: record.id });
}

export async function getSessionDetail(input: {
  userId: string;
  sessionId: string;
}): Promise<{
  session: {
    id: string;
    roomCode: string;
    mode: "local" | "online";
    startedAtIso: string;
    endedAtIso: string;
    totalHands: number;
  };
  me: {
    userId: string;
    startStack: string;
    endStack: string;
    profitLoss: string;
    handsPlayed: number;
  };
  players: Array<{
    userId: string;
    username: string;
    startStack: string;
    endStack: string;
    profitLoss: string;
    handsPlayed: number;
  }>;
  hands: Array<{
    handNumber: number;
    potTotal: string;
    results: Array<{
      userId: string;
      username: string;
      amountWon: string;
      netChange: string;
    }>;
  }>;
}> {
  const record = await prisma.gameSession.findUnique({
    where: {
      id: input.sessionId
    },
    select: {
      id: true,
      roomId: true,
      totalHands: true,
      startedAt: true,
      finishedAt: true,
      room: {
        select: {
          roomCode: true,
          gameMode: true
        }
      },
      playerStats: {
        select: {
          userId: true,
          startStack: true,
          endStack: true,
          profitLoss: true,
          handsPlayed: true,
          user: {
            select: {
              email: true,
              profile: {
                select: {
                  username: true,
                  historyResetAt: true
                }
              }
            }
          }
        },
        orderBy: {
          profitLoss: "desc"
        }
      }
    }
  });

  if (!record) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const me = record.playerStats.find((stat) => stat.userId === input.userId);

  if (!me || (me.user.profile?.historyResetAt && record.finishedAt <= me.user.profile.historyResetAt)) {
    throw new Error("SESSION_FORBIDDEN");
  }

  const usernameByUserId = new Map(
    record.playerStats.map((stat) => [
      stat.userId,
      stat.user.profile?.username ?? stat.user.email.split("@")[0]
    ])
  );

  const hands = await prisma.hand.findMany({
    where: {
      roomId: record.roomId,
      status: "SETTLED"
    },
    select: {
      handNumber: true,
      potTotal: true,
      results: {
        select: {
          userId: true,
          amountWon: true,
          netChange: true
        },
        orderBy: {
          netChange: "desc"
        }
      }
    },
    orderBy: {
      handNumber: "asc"
    }
  });

  return {
    session: {
      id: record.id,
      roomCode: record.room.roomCode,
      mode: record.room.gameMode === "local" ? "local" : "online",
      startedAtIso: record.startedAt.toISOString(),
      endedAtIso: record.finishedAt.toISOString(),
      totalHands: record.totalHands
    },
    me: {
      userId: me.userId,
      startStack: me.startStack.toString(),
      endStack: me.endStack.toString(),
      profitLoss: me.profitLoss.toString(),
      handsPlayed: me.handsPlayed
    },
    players: record.playerStats.map((stat) => ({
      userId: stat.userId,
      username: stat.user.profile?.username ?? stat.user.email.split("@")[0],
      startStack: stat.startStack.toString(),
      endStack: stat.endStack.toString(),
      profitLoss: stat.profitLoss.toString(),
      handsPlayed: stat.handsPlayed
    })),
    hands: hands.map((hand) => ({
      handNumber: hand.handNumber,
      potTotal: hand.potTotal.toString(),
      results: hand.results.map((result) => ({
        userId: result.userId,
        username: usernameByUserId.get(result.userId) ?? result.userId,
        amountWon: result.amountWon.toString(),
        netChange: result.netChange.toString()
      }))
    }))
  };
}
