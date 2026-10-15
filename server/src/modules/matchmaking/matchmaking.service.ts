import { randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { addMatchedPlayer, createMatchedRoom, leaveMatchedRoom } from "../rooms/room.service.js";
import { MATCH_TIERS, matchOptionsSchema, type MatchOptions } from "./matchmaking.settings.js";
import { scheduleBroadcastRoomState } from "../../realtime/room-broadcast.js";

export { MATCH_TIERS } from "./matchmaking.settings.js";
export const MATCH_SETTINGS = { maxPlayers: 2, ...MATCH_TIERS.beginner } as const;
export const MATCH_LEASE_MS = 30_000;
const QUEUE_LOCK = 714_202_602;
const includeRoom = { room: { select: { roomCode: true, status: true } } } as const;
type Ticket = Prisma.MatchmakingTicketGetPayload<{ include: typeof includeRoom }>;

export type MatchState =
  | { status: "idle" }
  | { status: "waiting"; ticketId: string; joinedAt: string }
  | { status: "matched"; ticketId: string; roomCode: string };

function toState(ticket: Ticket | null, now: Date): MatchState {
  if (!ticket) return { status: "idle" };
  if (ticket.room?.status === "ACTIVE" || (ticket.room?.status === "WAITING" && ticket.expiresAt > now)) {
    return { status: "matched", ticketId: ticket.id, roomCode: ticket.room.roomCode };
  }
  return { status: "idle" };
}

export async function getMatchState(userId: string): Promise<MatchState> {
  const ticket = await prisma.matchmakingTicket.findUnique({ where: { userId }, include: includeRoom });
  return toState(ticket, new Date());
}

async function removeTicket(tx: Prisma.TransactionClient, ticket: Ticket) {
  if (ticket.room && !await leaveMatchedRoom(tx, ticket.room.roomCode, ticket.userId)) return false;
  await tx.matchmakingTicket.deleteMany({ where: { userId: ticket.userId, id: ticket.id } });
  return true;
}

export async function joinMatchQueue(userId: string, input: MatchOptions = { maxPlayers: 2, tier: "beginner" }): Promise<MatchState> {
  const options = matchOptionsSchema.parse(input);
  for (let attempt = 0; ; attempt++) {
    try {
      const changedRooms = new Set<string>();
      const result = await prisma.$transaction<MatchState>(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${QUEUE_LOCK}::bigint)`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + MATCH_LEASE_MS);
        const previous = await tx.matchmakingTicket.findUnique({ where: { userId }, include: includeRoom });
        const state = toState(previous, now);
        if (state.status === "matched") {
          await tx.matchmakingTicket.update({ where: { userId }, data: { expiresAt } });
          return state;
        }
        // Reclaim abandoned preparation seats, including across serverless instances.
        const expired = await tx.matchmakingTicket.findMany({
          where: { expiresAt: { lte: now }, OR: [{ roomId: null }, { room: { status: "WAITING" } }] }, include: includeRoom
        });
        for (const ticket of expired) {
          if (await removeTicket(tx, ticket) && ticket.room) changedRooms.add(ticket.room.roomCode);
        }
        // A last-ready click may have committed while expiry cleanup waited.
        const refreshed = await tx.matchmakingTicket.findUnique({ where: { userId }, include: includeRoom });
        if (refreshed?.room?.status === "ACTIVE") return toState(refreshed, now);
        const candidates = await tx.gameRoom.findMany({
          where: { status: "WAITING", matchmakingTier: options.tier, maxPlayers: options.maxPlayers },
          include: { _count: { select: { roomPlayers: { where: { leftAt: null } } } } }
        });
        const available = candidates.filter((room) => room._count.roomPlayers < room.maxPlayers);
        const candidate = available.length ? available[randomInt(available.length)] : null;
        const room = candidate
          ? await addMatchedPlayer(tx, candidate.roomCode, userId)
          : await createMatchedRoom(tx, userId, { maxPlayers: options.maxPlayers, matchmakingTier: options.tier, ...MATCH_TIERS[options.tier] });
        const ticket = await tx.matchmakingTicket.upsert({ where: { userId },
          create: { userId, roomId: room.id, expiresAt },
          update: { id: randomUUID(), roomId: room.id, matchedAt: null, joinedAt: now, expiresAt }
        });
        return { status: "matched", ticketId: ticket.id, roomCode: room.roomCode };
      }, { timeout: 15000 });
      for (const roomCode of changedRooms) scheduleBroadcastRoomState(roomCode);
      return result;
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
    if (!ticket || ticket.id !== ticketId) return { status: "idle" };
    if (ticket.room?.status === "ACTIVE") return toState(ticket, now);
    if (cancel || ticket.expiresAt <= now) {
      if (await removeTicket(tx, ticket)) return { status: "idle" };
      // The final ready click won the race with cancellation/expiry.
      const current = await tx.matchmakingTicket.findUnique({ where: { userId }, include: includeRoom });
      return toState(current, now);
    }
    const state = toState(ticket, now);
    if (state.status === "matched") await tx.matchmakingTicket.update({ where: { userId }, data: { expiresAt: new Date(now.getTime() + MATCH_LEASE_MS) } });
    return state;
  });
}
