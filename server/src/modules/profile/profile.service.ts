import { prisma } from "../../lib/prisma.js";

export async function getProfile(userId: string): Promise<{
  username: string;
  avatarUrl: string | null;
  totals: {
    sessions: number;
    hands: number;
    profit: string;
    loss: string;
  };
}> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      username: true,
      avatarUrl: true,
      totalSessions: true,
      totalHands: true,
      totalProfit: true,
      totalLoss: true
    }
  });

  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  return {
    username: profile.username,
    avatarUrl: profile.avatarUrl,
    totals: {
      sessions: profile.totalSessions,
      hands: profile.totalHands,
      profit: profile.totalProfit.toString(),
      loss: profile.totalLoss.toString()
    }
  };
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

export async function getRecentSessions(userId: string): Promise<
  Array<{
    sessionId: string;
    roomCode: string;
    startedAtIso: string;
    endedAtIso: string;
    totalHands: number;
    handsPlayed: number;
    startStack: string;
    endStack: string;
    profitLoss: string;
  }>
> {
  const rows = await prisma.playerSessionStat.findMany({
    where: { userId },
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
              roomCode: true
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
    startedAtIso: row.gameSession.startedAt.toISOString(),
    endedAtIso: row.gameSession.finishedAt.toISOString(),
    totalHands: row.gameSession.totalHands,
    handsPlayed: row.handsPlayed,
    startStack: row.startStack.toString(),
    endStack: row.endStack.toString(),
    profitLoss: row.profitLoss.toString()
  }));
}

export async function getSessionDetail(input: {
  userId: string;
  sessionId: string;
}): Promise<{
  session: {
    id: string;
    roomCode: string;
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
}> {
  const record = await prisma.gameSession.findUnique({
    where: {
      id: input.sessionId
    },
    select: {
      id: true,
      totalHands: true,
      startedAt: true,
      finishedAt: true,
      room: {
        select: {
          roomCode: true
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
                  username: true
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

  if (!me) {
    throw new Error("SESSION_FORBIDDEN");
  }

  return {
    session: {
      id: record.id,
      roomCode: record.room.roomCode,
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
    }))
  };
}
