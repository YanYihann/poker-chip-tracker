import { prisma } from "../../lib/prisma.js";
export async function getProfile(userId) {
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
    const totalAssets = BigInt(10000) + profile.totalProfit - profile.totalLoss;
    return {
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        totalAssets: totalAssets.toString(),
        totals: {
            sessions: profile.totalSessions,
            hands: profile.totalHands,
            profit: profile.totalProfit.toString(),
            loss: profile.totalLoss.toString()
        }
    };
}
export async function updateProfile(userId, input) {
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
export async function getRecentSessions(userId) {
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
    return rows.map((row) => ({
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
export async function getSessionDetail(input) {
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
    const usernameByUserId = new Map(record.playerStats.map((stat) => [
        stat.userId,
        stat.user.profile?.username ?? stat.user.email.split("@")[0]
    ]));
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
