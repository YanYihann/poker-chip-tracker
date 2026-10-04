import { randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { createMatchedRoom } from "../rooms/room.service.js";

export const MATCH_SETTINGS = { maxPlayers: 2, startingStack: 10000, smallBlind: 100, bigBlind: 200 } as const;
export const MATCH_LEASE_MS = 30_000;
// Transaction-scoped, database-wide serialization also works across Vercel instances.
const QUEUE_LOCK = 714_202_602;
const includeRoom = { room: { select: { roomCode: true, status: true } } } as const;
type Ticket = Prisma.MatchmakingTicketGetPayload<{ include: typeof includeRoom }>;

export type MatchState =
  | { status: "idle" }
  | { status: "waiting"; ticketId: string; joinedAt: string }
  | { status: "matched"; ticketId: string; roomCode: string };

function toState(ticket: Ticket | null, now: Date): MatchState {
  if (!ticket) return { status: "idle" };
  if (ticket.room?.status === "ACTIVE") return { status: "matched", ticketId: ticket.id, roomCode: ticket.room.roomCode };
  if (ticket.matchedAt || ticket.roomId || ticket.expiresAt <= now) return { status: "idle" };
  return { status: "waiting", ticketId: ticket.id, joinedAt: ticket.joinedAt.toISOString() };
}

export async function getMatchState(userId: string): Promise<MatchState> {
  const ticket = await prisma.matchmakingTicket.findUnique({ where: { userId }, include: includeRoom });
  return toState(ticket, new Date());
}

export async function joinMatchQueue(userId: string): Promise<MatchState> {
  // A concurrent private-room creation can collide with a generated room code.
  // Retry the entire transaction, so an aborted deal leaves no claimed ticket.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${QUEUE_LOCK}::bigint)`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + MATCH_LEASE_MS);
        const previous = await tx.matchmakingTicket.findUnique({ where: { userId }, include: includeRoom });
        const state = toState(previous, now);
        if (state.status === "matched") return state;

        await tx.matchmakingTicket.deleteMany({ where: { roomId: null, matchedAt: null, expiresAt: { lte: now } } });
        const ticket = state.status === "waiting"
          ? await tx.matchmakingTicket.update({ where: { userId }, data: { expiresAt } })
          : await tx.matchmakingTicket.upsert({ where: { userId },
              create: { userId, expiresAt },
              update: { id: randomUUID(), roomId: null, matchedAt: null, joinedAt: now, expiresAt } });

        const candidates = await tx.matchmakingTicket.findMany({
          where: { userId: { not: userId }, roomId: null, matchedAt: null, expiresAt: { gt: now } },
          select: { userId: true }
        });
        if (!candidates.length) return { status: "waiting", ticketId: ticket.id, joinedAt: ticket.joinedAt.toISOString() };
        const opponent = candidates[randomInt(candidates.length)];
        const pair: [string, string] = randomInt(2) === 0 ? [userId, opponent.userId] : [opponent.userId, userId];
        const room = await createMatchedRoom(tx, pair, MATCH_SETTINGS);
        await tx.matchmakingTicket.updateMany({ where: { userId: { in: pair } }, data: { roomId: room.id, matchedAt: now } });
        return { status: "matched", ticketId: ticket.id, roomCode: room.roomCode };
      });
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
}

export async function updateMatchQueue(userId: string, ticketId: string, cancel: boolean): Promise<MatchState> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${QUEUE_LOCK}::bigint)`;
    const now = new Date();
    const ticket = await tx.matchmakingTicket.findUnique({ where: { userId }, include: includeRoom });
    // A stale tab cannot cancel or extend a newer search for the same account.
    if (!ticket || ticket.id !== ticketId) return { status: "idle" };
    const state = toState(ticket, now);
    if (state.status !== "waiting") return state;
    if (cancel) {
      await tx.matchmakingTicket.delete({ where: { userId } });
      return { status: "idle" };
    }
    await tx.matchmakingTicket.update({ where: { userId }, data: { expiresAt: new Date(now.getTime() + MATCH_LEASE_MS) } });
    return state;
  });
}
