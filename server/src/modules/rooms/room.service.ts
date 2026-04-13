import { prisma } from "../../lib/prisma.js";

import type { Prisma } from "@prisma/client";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

type StreetCode = "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";
type PublicStreet = "preflop" | "flop" | "turn" | "river" | "showdown";
type HandStatusCode = "ACTIVE" | "SHOWDOWN" | "SETTLED" | "CANCELLED";
type PositionCode = "BTN" | "SB" | "BB" | "UTG" | "MP" | "HJ" | "CO";

type RoomPlayerRecord = {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  seatIndex: number | null;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  stack: bigint | number;
  currentBet: bigint | number;
  totalBuyIn: bigint | number;
  hasFolded: boolean;
  isAllIn: boolean;
  isEliminated: boolean;
  positionLabel: PositionCode | null;
  joinedAt: Date;
  leftAt: Date | null;
};

type HandResultRecord = {
  id: string;
  userId: string;
  resultType: "WIN" | "SPLIT";
  amountWon: bigint | number;
  netChange: bigint | number;
};

type HandRecord = {
  id: string;
  handNumber: number;
  street: StreetCode;
  status: HandStatusCode;
  dealerSeat: number;
  sbSeat: number;
  bbSeat: number;
  activeSeat: number | null;
  potTotal: bigint | number;
  settledAt: Date | null;
  results: HandResultRecord[];
};

type RoomRecord = {
  id: string;
  roomCode: string;
  hostUserId: string;
  status: string;
  maxPlayers: number;
  allowJoinAfterStart: boolean;
  createdAt: Date;
  startedAt: Date | null;
  currentHandNumber: number;
  currentStreet: string | null;
  dealerSeat: number | null;
  activeSeat: number | null;
  potTotal: bigint | number;
  smallBlind: bigint | number;
  bigBlind: bigint | number;
  startingStack: bigint | number;
  roomPlayers: RoomPlayerRecord[];
  hands: HandRecord[];
};

export type PlayerActionType = "fold" | "check" | "call" | "bet" | "raise" | "all-in";

export type RoomState = {
  room: {
    id: string;
    code: string;
    status: "waiting" | "active" | "finished" | "cancelled";
    hostUserId: string;
    maxPlayers: number;
    createdAtIso: string;
    startedAtIso: string | null;
    smallBlind: number;
    bigBlind: number;
    startingStack: number;
    currentHandNumber: number;
    dealerSeat: number | null;
  };
  players: Array<{
    id: string;
    userId: string;
    displayName: string;
    seatIndex: number | null;
    isHost: boolean;
    isReady: boolean;
    isConnected: boolean;
    stack: number;
    currentBet: number;
    status: "waiting" | "acting" | "folded" | "all-in";
    positionLabel: PositionCode | null;
    joinedAtIso: string;
  }>;
  me: {
    userId: string;
    seatIndex: number | null;
    isHost: boolean;
    isReady: boolean;
  } | null;
  canStart: boolean;
  game: {
    handId: string | null;
    handNumber: number;
    street: PublicStreet;
    status: "in-progress" | "showdown" | "settled";
    potTotal: number;
    currentBet: number;
    activeSeat: number | null;
    activePlayerUserId: string | null;
    dealerSeat: number | null;
    sbSeat: number | null;
    bbSeat: number | null;
    isMyTurn: boolean;
    legalActions: PlayerActionType[];
    toCall: number;
    minBet: number;
    minRaiseDelta: number;
    canSettle: boolean;
    canDecideNextHand: boolean;
    eligibleWinnerUserIds: string[];
    lastSettlement: {
      entries: Array<{
        userId: string;
        displayName: string;
        amountWon: number;
        netChange: number;
      }>;
    } | null;
  } | null;
};

function toNumber(value: bigint | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  return value;
}

function normalizeStreet(value: string | null | undefined): StreetCode {
  if (!value) {
    return "PREFLOP";
  }

  const upper = value.toUpperCase();

  if (upper === "PREFLOP") {
    return "PREFLOP";
  }
  if (upper === "FLOP") {
    return "FLOP";
  }
  if (upper === "TURN") {
    return "TURN";
  }
  if (upper === "RIVER") {
    return "RIVER";
  }
  return "SHOWDOWN";
}

function normalizeHandStatus(value: string | null | undefined): HandStatusCode {
  if (!value) {
    return "ACTIVE";
  }

  const upper = value.toUpperCase();

  if (upper === "SHOWDOWN") {
    return "SHOWDOWN";
  }
  if (upper === "SETTLED") {
    return "SETTLED";
  }
  if (upper === "CANCELLED") {
    return "CANCELLED";
  }
  return "ACTIVE";
}

function toPublicStreet(street: StreetCode): PublicStreet {
  switch (street) {
    case "PREFLOP":
      return "preflop";
    case "FLOP":
      return "flop";
    case "TURN":
      return "turn";
    case "RIVER":
      return "river";
    case "SHOWDOWN":
      return "showdown";
    default:
      return "preflop";
  }
}

function toPublicRoomStatus(status: string): RoomState["room"]["status"] {
  const normalized = status.toUpperCase();

  if (normalized === "ACTIVE") {
    return "active";
  }
  if (normalized === "FINISHED") {
    return "finished";
  }
  if (normalized === "CANCELLED") {
    return "cancelled";
  }
  return "waiting";
}

function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase();
}

function getSeatedActivePlayers(players: RoomPlayerRecord[]): RoomPlayerRecord[] {
  return players
    .filter((player) => !player.leftAt && player.seatIndex !== null)
    .sort((a, b) => (a.seatIndex ?? 999) - (b.seatIndex ?? 999));
}

function getHandEligiblePlayers(players: RoomPlayerRecord[]): RoomPlayerRecord[] {
  return getSeatedActivePlayers(players).filter((player) => toNumber(player.stack) > 0);
}

function getNextSeat(
  orderedPlayers: RoomPlayerRecord[],
  fromSeat: number,
  predicate: (player: RoomPlayerRecord) => boolean
): number | null {
  if (orderedPlayers.length === 0) {
    return null;
  }

  const startIndex = orderedPlayers.findIndex((player) => player.seatIndex === fromSeat);
  const safeIndex = startIndex >= 0 ? startIndex : 0;

  for (let step = 1; step <= orderedPlayers.length; step += 1) {
    const cursor = (safeIndex + step) % orderedPlayers.length;
    const candidate = orderedPlayers[cursor];

    if (predicate(candidate)) {
      return candidate.seatIndex;
    }
  }

  return null;
}

function getActionablePlayers(players: RoomPlayerRecord[]): RoomPlayerRecord[] {
  return players.filter((player) => !player.hasFolded && !player.isAllIn && toNumber(player.stack) > 0);
}

function getContendingPlayers(players: RoomPlayerRecord[]): RoomPlayerRecord[] {
  return players.filter((player) => !player.hasFolded);
}

function getCurrentBet(players: RoomPlayerRecord[]): number {
  const contenders = getContendingPlayers(players);
  if (contenders.length === 0) {
    return 0;
  }

  return Math.max(...contenders.map((player) => toNumber(player.currentBet)));
}

function computeLegalActions(
  player: RoomPlayerRecord | null,
  currentBet: number,
  isTurn: boolean
): PlayerActionType[] {
  if (!player || !isTurn || player.hasFolded || player.isAllIn || toNumber(player.stack) <= 0) {
    return [];
  }

  const toCall = Math.max(0, currentBet - toNumber(player.currentBet));

  if (toCall === 0) {
    return ["fold", "check", "bet", "all-in"];
  }

  return ["fold", "call", "raise", "all-in"];
}

function computeNextStreet(street: StreetCode): StreetCode {
  if (street === "PREFLOP") {
    return "FLOP";
  }
  if (street === "FLOP") {
    return "TURN";
  }
  if (street === "TURN") {
    return "RIVER";
  }
  return "SHOWDOWN";
}

function computePositionLabelBySeat(
  orderedPlayers: RoomPlayerRecord[],
  dealerSeat: number,
  sbSeat: number | null,
  bbSeat: number | null
): Map<number, PositionCode> {
  const labels = new Map<number, PositionCode>();
  if (orderedPlayers.length === 0) {
    return labels;
  }

  labels.set(dealerSeat, "BTN");

  if (sbSeat !== null && sbSeat !== dealerSeat) {
    labels.set(sbSeat, "SB");
  }

  if (bbSeat !== null && bbSeat !== dealerSeat && bbSeat !== sbSeat) {
    labels.set(bbSeat, "BB");
  }

  const dealerIndex = orderedPlayers.findIndex((player) => player.seatIndex === dealerSeat);
  const safeDealerIndex = dealerIndex >= 0 ? dealerIndex : 0;
  const postBlindLabels: PositionCode[] = ["UTG", "MP", "HJ", "CO"];

  let postBlindIndex = 0;

  for (let step = 1; step <= orderedPlayers.length; step += 1) {
    const cursor = (safeDealerIndex + step) % orderedPlayers.length;
    const seat = orderedPlayers[cursor].seatIndex;
    if (seat === null || labels.has(seat)) {
      continue;
    }

    const label = postBlindLabels[Math.min(postBlindIndex, postBlindLabels.length - 1)];
    labels.set(seat, label);
    postBlindIndex += 1;
  }

  return labels;
}

async function fetchRoomByCode(roomCode: string): Promise<RoomRecord | null> {
  return (await prisma.gameRoom.findUnique({
    where: { roomCode: normalizeRoomCode(roomCode) },
    include: {
      roomPlayers: true,
      hands: {
        orderBy: {
          handNumber: "desc"
        },
        take: 1,
        select: {
          id: true,
          handNumber: true,
          street: true,
          status: true,
          dealerSeat: true,
          sbSeat: true,
          bbSeat: true,
          activeSeat: true,
          potTotal: true,
          settledAt: true,
          results: {
            select: {
              id: true,
              userId: true,
              resultType: true,
              amountWon: true,
              netChange: true
            }
          }
        }
      }
    }
  })) as RoomRecord | null;
}

function buildRoomState(room: RoomRecord, currentUserId: string | null): RoomState {
  const activeSeat = room.activeSeat;
  const roomStatus = toPublicRoomStatus(room.status);
  const latestHand = room.hands[0] ?? null;
  const handStatus = normalizeHandStatus(latestHand?.status);
  const streetCode = normalizeStreet(room.currentStreet ?? latestHand?.street);
  const gameStatus: "in-progress" | "showdown" | "settled" =
    handStatus === "SETTLED" ? "settled" : streetCode === "SHOWDOWN" ? "showdown" : "in-progress";
  const sortedPlayers = room.roomPlayers
    .filter((player) => !player.leftAt)
    .sort((a, b) => {
      const aSeat = a.seatIndex ?? 999;
      const bSeat = b.seatIndex ?? 999;
      if (aSeat !== bSeat) {
        return aSeat - bSeat;
      }
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

  const players = sortedPlayers.map((player) => {
    const stack = toNumber(player.stack);
    const currentBet = toNumber(player.currentBet);
    const status: RoomState["players"][number]["status"] = player.hasFolded
      ? "folded"
      : player.isAllIn || stack <= 0
        ? "all-in"
        : player.seatIndex !== null &&
            activeSeat !== null &&
            gameStatus === "in-progress" &&
            player.seatIndex === activeSeat
          ? "acting"
          : "waiting";

    return {
      id: player.id,
      userId: player.userId,
      displayName: player.displayName,
      seatIndex: player.seatIndex,
      isHost: player.isHost,
      isReady: player.isReady,
      isConnected: player.isConnected,
      stack,
      currentBet,
      status,
      positionLabel: player.positionLabel,
      joinedAtIso: player.joinedAt.toISOString()
    };
  });

  const mePlayer = sortedPlayers.find((player) => player.userId === currentUserId) ?? null;
  const allReady = players.length > 0 && players.every((player) => player.isReady);

  const currentBet = getCurrentBet(sortedPlayers);
  const activePlayer = sortedPlayers.find((player) => player.seatIndex === activeSeat) ?? null;
  const isMyTurn =
    roomStatus === "active" &&
    gameStatus === "in-progress" &&
    !!mePlayer &&
    mePlayer.seatIndex !== null &&
    activeSeat !== null &&
    mePlayer.seatIndex === activeSeat;

  const toCall = mePlayer ? Math.max(0, currentBet - toNumber(mePlayer.currentBet)) : 0;
  const contenders = sortedPlayers.filter((player) => !player.hasFolded && player.seatIndex !== null);
  const playerNameMap = new Map(players.map((player) => [player.userId, player.displayName]));
  const settlementEntries = (latestHand?.results ?? [])
    .map((result) => ({
      userId: result.userId,
      displayName: playerNameMap.get(result.userId) ?? result.userId,
      amountWon: toNumber(result.amountWon),
      netChange: toNumber(result.netChange)
    }))
    .sort((a, b) => b.netChange - a.netChange);

  return {
    room: {
      id: room.id,
      code: room.roomCode,
      status: roomStatus,
      hostUserId: room.hostUserId,
      maxPlayers: room.maxPlayers,
      createdAtIso: room.createdAt.toISOString(),
      startedAtIso: room.startedAt?.toISOString() ?? null,
      smallBlind: toNumber(room.smallBlind),
      bigBlind: toNumber(room.bigBlind),
      startingStack: toNumber(room.startingStack),
      currentHandNumber: room.currentHandNumber,
      dealerSeat: room.dealerSeat
    },
    players,
    me: mePlayer
      ? {
          userId: mePlayer.userId,
          seatIndex: mePlayer.seatIndex,
          isHost: mePlayer.isHost,
          isReady: mePlayer.isReady
        }
      : null,
    canStart:
      !!mePlayer?.isHost && roomStatus === "waiting" && players.length >= 2 && allReady,
    game:
      roomStatus !== "active"
        ? null
        : {
            handId: latestHand?.id ?? null,
            handNumber: room.currentHandNumber,
            street: toPublicStreet(streetCode),
            status: gameStatus,
            potTotal: gameStatus === "settled" ? 0 : toNumber(latestHand?.potTotal ?? room.potTotal),
            currentBet,
            activeSeat,
            activePlayerUserId: activePlayer?.userId ?? null,
            dealerSeat: latestHand?.dealerSeat ?? room.dealerSeat ?? null,
            sbSeat: latestHand?.sbSeat ?? null,
            bbSeat: latestHand?.bbSeat ?? null,
            isMyTurn,
            legalActions: computeLegalActions(mePlayer, currentBet, isMyTurn && gameStatus === "in-progress"),
            toCall,
            minBet: Math.max(1, toNumber(room.bigBlind)),
            minRaiseDelta: Math.max(1, toNumber(room.bigBlind)),
            canSettle: !!mePlayer?.isHost && gameStatus === "showdown",
            canDecideNextHand: !!mePlayer?.isHost && gameStatus === "settled",
            eligibleWinnerUserIds: contenders.map((player) => player.userId),
            lastSettlement: gameStatus === "settled" ? { entries: settlementEntries } : null
          }
  };
}

function generateRoomCodeCandidate(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[index];
  }
  return code;
}

async function generateUniqueRoomCode(): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const candidate = generateRoomCodeCandidate();
    const exists = await prisma.gameRoom.findUnique({
      where: { roomCode: candidate },
      select: { id: true }
    });

    if (!exists) {
      return candidate;
    }
  }

  throw new Error("ROOM_CODE_GENERATION_FAILED");
}

async function resolveDisplayName(userId: string, preferredName?: string): Promise<string> {
  if (preferredName?.trim()) {
    return preferredName.trim();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      profile: {
        select: {
          username: true
        }
      }
    }
  });

  if (user?.profile?.username) {
    return user.profile.username;
  }

  if (user?.email) {
    return user.email.split("@")[0];
  }

  return "Player";
}

function mapActionTypeToDb(actionType: PlayerActionType): "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN" {
  if (actionType === "all-in") {
    return "ALL_IN";
  }
  return actionType.toUpperCase() as "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE";
}

async function moveHandToShowdown(input: {
  tx: Prisma.TransactionClient;
  roomId: string;
  handId: string;
  finalPotTotal: number;
}): Promise<void> {
  const { tx, roomId, handId, finalPotTotal } = input;

  await tx.roomPlayer.updateMany({
    where: {
      roomId,
      leftAt: null
    },
    data: {
      currentBet: BigInt(0)
    }
  });

  await tx.hand.update({
    where: { id: handId },
    data: {
      status: "SHOWDOWN",
      street: "SHOWDOWN",
      activeSeat: null,
      potTotal: BigInt(finalPotTotal)
    }
  });

  await tx.gameRoom.update({
    where: { id: roomId },
    data: {
      currentStreet: "SHOWDOWN",
      activeSeat: null,
      potTotal: BigInt(finalPotTotal),
      sidePotTotal: BigInt(0)
    }
  });
}

async function settleCurrentHand(input: {
  tx: Prisma.TransactionClient;
  room: RoomRecord;
  winnerUserIds: string[];
}): Promise<void> {
  const { tx, room } = input;
  const hand = room.hands[0];

  if (!hand) {
    throw new Error("HAND_NOT_FOUND");
  }

  if (normalizeHandStatus(hand.status) === "SETTLED") {
    throw new Error("HAND_ALREADY_SETTLED");
  }

  if (normalizeHandStatus(hand.status) !== "SHOWDOWN") {
    throw new Error("HAND_NOT_SHOWDOWN");
  }

  const seatedPlayers = getSeatedActivePlayers(room.roomPlayers);
  const contenders = seatedPlayers.filter((player) => !player.hasFolded);
  const winnerUserIds = [...new Set(input.winnerUserIds)];

  if (winnerUserIds.length === 0) {
    throw new Error("WINNERS_REQUIRED");
  }

  const winnerSet = new Set(winnerUserIds);
  const winners = contenders.filter((player) => winnerSet.has(player.userId));

  if (winners.length !== winnerUserIds.length) {
    throw new Error("INVALID_WINNERS");
  }

  const potTotal = Math.max(0, toNumber(hand.potTotal));
  const sortedWinners = [...winners].sort((a, b) => (a.seatIndex ?? 999) - (b.seatIndex ?? 999));
  const payoutByUserId = new Map<string, number>();

  if (sortedWinners.length > 0) {
    const eachShare = Math.floor(potTotal / sortedWinners.length);
    const remainder = potTotal % sortedWinners.length;

    sortedWinners.forEach((winner, index) => {
      payoutByUserId.set(winner.userId, eachShare + (index === 0 ? remainder : 0));
    });
  }

  const actions = await tx.handAction.findMany({
    where: {
      handId: hand.id
    },
    select: {
      userId: true,
      amount: true
    }
  });

  const contributedByUserId = new Map<string, number>();
  for (const action of actions) {
    const previous = contributedByUserId.get(action.userId) ?? 0;
    contributedByUserId.set(action.userId, previous + toNumber(action.amount));
  }

  for (const winner of sortedWinners) {
    const amountWon = payoutByUserId.get(winner.userId) ?? 0;
    if (amountWon <= 0) {
      continue;
    }

    await tx.roomPlayer.update({
      where: { id: winner.id },
      data: {
        stack: {
          increment: BigInt(amountWon)
        }
      }
    });
  }

  await tx.handResult.deleteMany({
    where: {
      handId: hand.id
    }
  });

  const resultType: "WIN" | "SPLIT" = sortedWinners.length === 1 ? "WIN" : "SPLIT";
  for (const player of seatedPlayers) {
    const amountWon = payoutByUserId.get(player.userId) ?? 0;
    const contribution = contributedByUserId.get(player.userId) ?? 0;
    const netChange = amountWon - contribution;

    await tx.handResult.create({
      data: {
        handId: hand.id,
        roomId: room.id,
        userId: player.userId,
        resultType,
        amountWon: BigInt(amountWon),
        netChange: BigInt(netChange)
      }
    });
  }

  await tx.hand.update({
    where: { id: hand.id },
    data: {
      status: "SETTLED",
      street: "SHOWDOWN",
      activeSeat: null,
      settledAt: new Date(),
      potTotal: BigInt(potTotal)
    }
  });

  await tx.roomPlayer.updateMany({
    where: {
      roomId: room.id,
      leftAt: null
    },
    data: {
      currentBet: BigInt(0)
    }
  });

  const refreshedPlayers = (await tx.roomPlayer.findMany({
    where: {
      roomId: room.id,
      leftAt: null
    }
  })) as RoomPlayerRecord[];

  await Promise.all(
    refreshedPlayers.map((player) =>
      tx.roomPlayer.update({
        where: { id: player.id },
        data: {
          isAllIn: toNumber(player.stack) <= 0,
          isEliminated: toNumber(player.stack) <= 0
        }
      })
    )
  );

  await tx.gameRoom.update({
    where: { id: room.id },
    data: {
      currentStreet: "SHOWDOWN",
      activeSeat: null,
      potTotal: BigInt(0),
      sidePotTotal: BigInt(0)
    }
  });
}

async function startNextHand(input: {
  tx: Prisma.TransactionClient;
  roomId: string;
  dealerSeatCandidate: number;
}): Promise<void> {
  const { tx, roomId, dealerSeatCandidate } = input;
  const room = (await tx.gameRoom.findUnique({
    where: {
      id: roomId
    },
    include: {
      roomPlayers: true
    }
  })) as RoomRecord | null;

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const seatedPlayers = getSeatedActivePlayers(room.roomPlayers);
  const eligiblePlayers = seatedPlayers.filter((player) => toNumber(player.stack) > 0);

  if (eligiblePlayers.length < 2) {
    throw new Error("NOT_ENOUGH_ACTIVE_PLAYERS");
  }

  const dealerSeat = eligiblePlayers.some((player) => player.seatIndex === dealerSeatCandidate)
    ? dealerSeatCandidate
    : (eligiblePlayers[0].seatIndex ?? 0);
  const sbSeat = getNextSeat(eligiblePlayers, dealerSeat, () => true);
  const bbSeat = getNextSeat(eligiblePlayers, sbSeat ?? dealerSeat, () => true);
  const labelBySeat = computePositionLabelBySeat(eligiblePlayers, dealerSeat, sbSeat, bbSeat);

  await Promise.all(
    seatedPlayers.map((player) =>
      tx.roomPlayer.update({
        where: { id: player.id },
        data: {
          currentBet: BigInt(0),
          hasFolded: false,
          isAllIn: toNumber(player.stack) <= 0,
          isEliminated: toNumber(player.stack) <= 0,
          positionLabel: player.seatIndex !== null ? (labelBySeat.get(player.seatIndex) ?? null) : null
        }
      })
    )
  );

  const afterReset = (await tx.roomPlayer.findMany({
    where: {
      roomId: room.id,
      leftAt: null
    }
  })) as RoomPlayerRecord[];

  let potTotal = 0;
  let actionOrder = 1;
  const blindActions: Array<{
    userId: string;
    seatIndex: number;
    actionType: "POST_SB" | "POST_BB";
    amount: number;
  }> = [];

  async function postBlind(seatIndex: number | null, amount: number, actionType: "POST_SB" | "POST_BB") {
    if (seatIndex === null || amount <= 0) {
      return;
    }

    const player = afterReset.find((item) => item.seatIndex === seatIndex);
    if (!player) {
      return;
    }

    const stack = toNumber(player.stack);
    const contribution = Math.min(stack, amount);

    if (contribution <= 0) {
      return;
    }

    const stackAfter = stack - contribution;

    await tx.roomPlayer.update({
      where: { id: player.id },
      data: {
        stack: BigInt(stackAfter),
        currentBet: BigInt(contribution),
        isAllIn: stackAfter <= 0,
        isEliminated: stackAfter <= 0
      }
    });

    player.stack = BigInt(stackAfter);
    player.currentBet = BigInt(contribution);
    player.isAllIn = stackAfter <= 0;
    player.isEliminated = stackAfter <= 0;

    potTotal += contribution;
    blindActions.push({
      userId: player.userId,
      seatIndex,
      actionType,
      amount: contribution
    });
  }

  await postBlind(sbSeat, toNumber(room.smallBlind), "POST_SB");
  await postBlind(bbSeat, toNumber(room.bigBlind), "POST_BB");

  const withBlinds = (await tx.roomPlayer.findMany({
    where: {
      roomId: room.id,
      leftAt: null
    }
  })) as RoomPlayerRecord[];

  const seatedWithBlinds = getSeatedActivePlayers(withBlinds).filter(
    (player) => toNumber(player.stack) > 0 || toNumber(player.currentBet) > 0
  );
  const actionable = getActionablePlayers(seatedWithBlinds);
  const firstActiveSeat =
    bbSeat === null
      ? actionable[0]?.seatIndex ?? null
      : getNextSeat(seatedWithBlinds, bbSeat, (player) =>
          actionable.some((item) => item.id === player.id)
        );

  const handNumber = room.currentHandNumber + 1;
  const immediateShowdown = firstActiveSeat === null;

  const hand = await tx.hand.create({
    data: {
      roomId: room.id,
      handNumber,
      status: immediateShowdown ? "SHOWDOWN" : "ACTIVE",
      street: immediateShowdown ? "SHOWDOWN" : "PREFLOP",
      dealerSeat,
      sbSeat: sbSeat ?? dealerSeat,
      bbSeat: bbSeat ?? sbSeat ?? dealerSeat,
      activeSeat: firstActiveSeat,
      potTotal: BigInt(potTotal),
      sidePotTotal: BigInt(0)
    }
  });

  for (const action of blindActions) {
    await tx.handAction.create({
      data: {
        handId: hand.id,
        roomId: room.id,
        userId: action.userId,
        seatIndex: action.seatIndex,
        street: "PREFLOP",
        actionType: action.actionType,
        amount: BigInt(action.amount),
        actionOrder,
        createdAt: new Date()
      }
    });
    actionOrder += 1;
  }

  await tx.gameRoom.update({
    where: { id: room.id },
    data: {
      status: "ACTIVE",
      startedAt: room.startedAt ?? new Date(),
      finishedAt: null,
      currentHandNumber: handNumber,
      currentStreet: immediateShowdown ? "SHOWDOWN" : "PREFLOP",
      dealerSeat,
      activeSeat: firstActiveSeat,
      potTotal: BigInt(potTotal),
      sidePotTotal: BigInt(0)
    }
  });
}

async function finalizeRoomAndArchive(input: {
  tx: Prisma.TransactionClient;
  room: RoomRecord;
}): Promise<void> {
  const { tx, room } = input;
  const finishedAt = new Date();

  const roomUpdate = await tx.gameRoom.updateMany({
    where: {
      id: room.id,
      status: "ACTIVE"
    },
    data: {
      status: "FINISHED",
      currentStreet: "SHOWDOWN",
      activeSeat: null,
      potTotal: BigInt(0),
      sidePotTotal: BigInt(0),
      finishedAt
    }
  });

  if (roomUpdate.count === 0) {
    return;
  }

  const totalHands = await tx.hand.count({
    where: {
      roomId: room.id,
      status: "SETTLED"
    }
  });

  const session = await tx.gameSession.upsert({
    where: {
      roomId: room.id
    },
    create: {
      roomId: room.id,
      hostUserId: room.hostUserId,
      totalHands,
      startedAt: room.startedAt ?? finishedAt,
      finishedAt
    },
    update: {
      totalHands,
      finishedAt
    }
  });

  const participants = (await tx.roomPlayer.findMany({
    where: {
      roomId: room.id
    }
  })) as RoomPlayerRecord[];

  for (const participant of participants) {
    const startStack = Math.max(0, toNumber(participant.totalBuyIn) || toNumber(room.startingStack));
    const endStack = toNumber(participant.stack);
    const profitLoss = endStack - startStack;
    const distinctHands = await tx.handAction.findMany({
      where: {
        roomId: room.id,
        userId: participant.userId,
        hand: {
          status: "SETTLED"
        }
      },
      select: {
        handId: true
      },
      distinct: ["handId"]
    });

    const handsPlayed = distinctHands.length;

    await tx.playerSessionStat.upsert({
      where: {
        gameSessionId_userId: {
          gameSessionId: session.id,
          userId: participant.userId
        }
      },
      create: {
        gameSessionId: session.id,
        roomId: room.id,
        userId: participant.userId,
        startStack: BigInt(startStack),
        endStack: BigInt(endStack),
        profitLoss: BigInt(profitLoss),
        handsPlayed
      },
      update: {
        startStack: BigInt(startStack),
        endStack: BigInt(endStack),
        profitLoss: BigInt(profitLoss),
        handsPlayed
      }
    });

    await tx.profile.updateMany({
      where: { userId: participant.userId },
      data: {
        totalSessions: {
          increment: 1
        },
        totalHands: {
          increment: handsPlayed
        },
        totalProfit: {
          increment: profitLoss > 0 ? BigInt(profitLoss) : BigInt(0)
        },
        totalLoss: {
          increment: profitLoss < 0 ? BigInt(Math.abs(profitLoss)) : BigInt(0)
        }
      }
    });
  }
}

export async function createRoom(input: {
  hostUserId: string;
  maxPlayers?: number;
  startingStack?: number;
  smallBlind?: number;
  bigBlind?: number;
}): Promise<RoomState> {
  const roomCode = await generateUniqueRoomCode();
  const maxPlayers = input.maxPlayers ?? 6;
  const startingStack = BigInt(input.startingStack ?? 10000);
  const smallBlind = BigInt(input.smallBlind ?? 100);
  const bigBlind = BigInt(input.bigBlind ?? 200);
  const displayName = await resolveDisplayName(input.hostUserId);

  await prisma.gameRoom.create({
    data: {
      roomCode,
      hostUserId: input.hostUserId,
      status: "WAITING",
      maxPlayers,
      startingStack,
      smallBlind,
      bigBlind,
      roomPlayers: {
        create: {
          userId: input.hostUserId,
          displayName,
          seatIndex: 0,
          stack: startingStack,
          totalBuyIn: startingStack,
          isHost: true,
          isReady: true,
          isConnected: true
        }
      }
    }
  });

  const room = await fetchRoomByCode(roomCode);
  if (!room) {
    throw new Error("ROOM_CREATE_FAILED");
  }
  return buildRoomState(room, input.hostUserId);
}

export async function joinRoomByCode(input: {
  roomCode: string;
  userId: string;
  displayName?: string;
}): Promise<RoomState> {
  const roomCode = normalizeRoomCode(input.roomCode);
  const room = await fetchRoomByCode(roomCode);

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const activePlayers = room.roomPlayers.filter((player) => !player.leftAt);
  const member = activePlayers.find((player) => player.userId === input.userId);

  if (!member) {
    if (room.status !== "WAITING" && !room.allowJoinAfterStart) {
      throw new Error("ROOM_NOT_JOINABLE");
    }

    if (activePlayers.length >= room.maxPlayers) {
      throw new Error("ROOM_FULL");
    }

    const usedSeats = new Set(activePlayers.map((player) => player.seatIndex).filter((seat) => seat !== null));
    let nextSeat: number | null = null;

    for (let i = 0; i < room.maxPlayers; i += 1) {
      if (!usedSeats.has(i)) {
        nextSeat = i;
        break;
      }
    }

    if (nextSeat === null) {
      throw new Error("ROOM_FULL");
    }

    const displayName = await resolveDisplayName(input.userId, input.displayName);

    await prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        userId: input.userId,
        displayName,
        seatIndex: nextSeat,
        stack: room.startingStack,
        totalBuyIn: room.startingStack,
        isHost: false,
        isReady: false,
        isConnected: true
      }
    });
  } else {
    await prisma.roomPlayer.update({
      where: { id: member.id },
      data: {
        isConnected: true,
        leftAt: null,
        seatIndex: member.seatIndex ?? 0
      }
    });
  }

  const next = await fetchRoomByCode(roomCode);
  if (!next) {
    throw new Error("ROOM_NOT_FOUND");
  }
  return buildRoomState(next, input.userId);
}

export async function getRoomStateByCode(
  roomCode: string,
  currentUserId: string | null
): Promise<RoomState | null> {
  const room = await fetchRoomByCode(roomCode);

  if (!room) {
    return null;
  }

  return buildRoomState(room, currentUserId);
}

export async function setPlayerReadyByRoomCode(input: {
  roomCode: string;
  userId: string;
  isReady: boolean;
}): Promise<RoomState> {
  const room = await fetchRoomByCode(input.roomCode);

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const member = room.roomPlayers.find((player) => player.userId === input.userId && !player.leftAt);

  if (!member) {
    throw new Error("NOT_A_MEMBER");
  }

  if (room.status !== "WAITING") {
    throw new Error("ROOM_NOT_WAITING");
  }

  await prisma.roomPlayer.update({
    where: { id: member.id },
    data: { isReady: input.isReady }
  });

  const next = await fetchRoomByCode(input.roomCode);
  if (!next) {
    throw new Error("ROOM_NOT_FOUND");
  }
  return buildRoomState(next, input.userId);
}

export async function setPlayerBuyInByRoomCode(input: {
  roomCode: string;
  userId: string;
  buyIn: number;
}): Promise<RoomState> {
  const room = await fetchRoomByCode(input.roomCode);

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const member = room.roomPlayers.find((player) => player.userId === input.userId && !player.leftAt);

  if (!member) {
    throw new Error("NOT_A_MEMBER");
  }

  if (room.status !== "WAITING") {
    throw new Error("ROOM_NOT_WAITING");
  }

  if (!Number.isInteger(input.buyIn) || input.buyIn <= 0) {
    throw new Error("ILLEGAL_ACTION");
  }

  await prisma.roomPlayer.update({
    where: { id: member.id },
    data: {
      stack: BigInt(input.buyIn),
      totalBuyIn: BigInt(input.buyIn),
      isReady: false
    }
  });

  const next = await fetchRoomByCode(input.roomCode);
  if (!next) {
    throw new Error("ROOM_NOT_FOUND");
  }
  return buildRoomState(next, input.userId);
}

export async function updateRoomBlindsByCode(input: {
  roomCode: string;
  userId: string;
  smallBlind: number;
  bigBlind: number;
}): Promise<RoomState> {
  const roomCode = normalizeRoomCode(input.roomCode);
  const room = await fetchRoomByCode(roomCode);

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  if (room.hostUserId !== input.userId) {
    throw new Error("HOST_ONLY");
  }

  if (room.status !== "WAITING") {
    throw new Error("ROOM_NOT_WAITING");
  }

  if (input.smallBlind <= 0 || input.bigBlind <= 0 || input.bigBlind < input.smallBlind) {
    throw new Error("INVALID_BLINDS");
  }

  await prisma.gameRoom.update({
    where: {
      id: room.id
    },
    data: {
      smallBlind: BigInt(input.smallBlind),
      bigBlind: BigInt(input.bigBlind)
    }
  });

  const next = await fetchRoomByCode(roomCode);
  if (!next) {
    throw new Error("ROOM_NOT_FOUND");
  }
  return buildRoomState(next, input.userId);
}

async function startFirstHand(roomCode: string, hostUserId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const room = (await tx.gameRoom.findUnique({
      where: { roomCode },
      include: {
        roomPlayers: true
      }
    })) as RoomRecord | null;

    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }

    if (room.hostUserId !== hostUserId) {
      throw new Error("HOST_ONLY");
    }

    if (room.status !== "WAITING") {
      throw new Error("ROOM_ALREADY_STARTED");
    }

    const activePlayers = getSeatedActivePlayers(room.roomPlayers);
    const readyPlayers = activePlayers.filter((player) => player.isReady);

    if (readyPlayers.length < 2 || readyPlayers.length !== activePlayers.length) {
      throw new Error("ROOM_NOT_READY");
    }

    const hostPlayer = activePlayers.find((player) => player.userId === hostUserId);
    if (!hostPlayer || hostPlayer.seatIndex === null) {
      throw new Error("NOT_A_MEMBER");
    }

    await startNextHand({
      tx,
      roomId: room.id,
      dealerSeatCandidate: hostPlayer.seatIndex
    });
  });
}

export async function startRoomByHost(input: {
  roomCode: string;
  hostUserId: string;
}): Promise<RoomState> {
  const roomCode = normalizeRoomCode(input.roomCode);
  await startFirstHand(roomCode, input.hostUserId);

  const next = await fetchRoomByCode(roomCode);
  if (!next) {
    throw new Error("ROOM_NOT_FOUND");
  }

  return buildRoomState(next, input.hostUserId);
}

export async function applyPlayerActionByRoomCode(input: {
  roomCode: string;
  userId: string;
  actionType: PlayerActionType;
  amount?: number;
}): Promise<RoomState> {
  const roomCode = normalizeRoomCode(input.roomCode);

  await prisma.$transaction(async (tx) => {
    const room = (await tx.gameRoom.findUnique({
      where: { roomCode },
      include: {
        roomPlayers: true,
        hands: {
          orderBy: {
            handNumber: "desc"
          },
          take: 1,
          select: {
            id: true,
            handNumber: true,
            street: true,
            status: true
          }
        }
      }
    })) as RoomRecord | null;

    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }

    if (room.status !== "ACTIVE") {
      throw new Error("ROOM_NOT_ACTIVE");
    }

    const hand = room.hands[0];
    if (!hand) {
      throw new Error("HAND_NOT_FOUND");
    }

    if (normalizeHandStatus(hand.status) !== "ACTIVE") {
      throw new Error("HAND_LOCKED");
    }

    const street = normalizeStreet(room.currentStreet);

    const players = getSeatedActivePlayers(room.roomPlayers);
    const actor = players.find((player) => player.userId === input.userId);

    if (!actor) {
      throw new Error("NOT_A_MEMBER");
    }

    if (actor.seatIndex === null || room.activeSeat === null || actor.seatIndex !== room.activeSeat) {
      throw new Error("NOT_YOUR_TURN");
    }

    const currentBet = getCurrentBet(players);
    const legalActions = computeLegalActions(actor, currentBet, true);

    if (!legalActions.includes(input.actionType)) {
      throw new Error("ILLEGAL_ACTION");
    }

    const actorStack = toNumber(actor.stack);
    const actorCurrentBet = toNumber(actor.currentBet);
    const toCall = Math.max(0, currentBet - actorCurrentBet);
    const bigBlind = Math.max(1, toNumber(room.bigBlind));

    let contribution = 0;
    let nextStack = actorStack;
    let nextCurrentBet = actorCurrentBet;
    let hasFolded = actor.hasFolded;

    switch (input.actionType) {
      case "fold": {
        hasFolded = true;
        break;
      }
      case "check": {
        if (toCall !== 0) {
          throw new Error("ILLEGAL_ACTION");
        }
        break;
      }
      case "call": {
        if (toCall <= 0) {
          throw new Error("ILLEGAL_ACTION");
        }
        contribution = Math.min(actorStack, toCall);
        nextStack = actorStack - contribution;
        nextCurrentBet = actorCurrentBet + contribution;
        break;
      }
      case "bet": {
        if (toCall !== 0) {
          throw new Error("ILLEGAL_ACTION");
        }

        const requested = input.amount ?? bigBlind;
        if (requested < bigBlind) {
          throw new Error("ILLEGAL_ACTION");
        }

        contribution = Math.min(actorStack, requested);
        if (contribution <= 0) {
          throw new Error("ILLEGAL_ACTION");
        }

        nextStack = actorStack - contribution;
        nextCurrentBet = actorCurrentBet + contribution;
        break;
      }
      case "raise": {
        if (toCall <= 0) {
          throw new Error("ILLEGAL_ACTION");
        }

        const minRaiseTo = currentBet + bigBlind;
        const requestedRaiseTo = input.amount ?? minRaiseTo;
        if (requestedRaiseTo < minRaiseTo || requestedRaiseTo <= currentBet) {
          throw new Error("ILLEGAL_ACTION");
        }

        const requiredContribution = requestedRaiseTo - actorCurrentBet;
        if (requiredContribution <= toCall || requiredContribution > actorStack) {
          throw new Error("ILLEGAL_ACTION");
        }

        contribution = requiredContribution;
        nextStack = actorStack - contribution;
        nextCurrentBet = actorCurrentBet + contribution;
        break;
      }
      case "all-in": {
        contribution = actorStack;
        nextStack = 0;
        nextCurrentBet = actorCurrentBet + contribution;
        break;
      }
      default:
        throw new Error("ILLEGAL_ACTION");
    }

    const finalPotTotal = toNumber(room.potTotal) + contribution;

    await tx.roomPlayer.update({
      where: { id: actor.id },
      data: {
        stack: BigInt(nextStack),
        currentBet: BigInt(nextCurrentBet),
        hasFolded,
        isAllIn: nextStack <= 0,
        isEliminated: nextStack <= 0
      }
    });

    if (contribution > 0) {
      await tx.gameRoom.update({
        where: { id: room.id },
        data: {
          potTotal: BigInt(finalPotTotal)
        }
      });
    }

    const actionCount = await tx.handAction.count({
      where: {
        handId: hand.id
      }
    });

    await tx.handAction.create({
      data: {
        handId: hand.id,
        roomId: room.id,
        userId: actor.userId,
        seatIndex: actor.seatIndex,
        street,
        actionType: mapActionTypeToDb(input.actionType),
        amount: BigInt(contribution),
        actionOrder: actionCount + 1
      }
    });

    const nextPlayers = (await tx.roomPlayer.findMany({
      where: {
        roomId: room.id,
        leftAt: null
      }
    })) as RoomPlayerRecord[];

    const seatedNextPlayers = getSeatedActivePlayers(nextPlayers);
    const contenders = getContendingPlayers(seatedNextPlayers);
    const actionable = getActionablePlayers(seatedNextPlayers);

    if (contenders.length <= 1 || actionable.length === 0) {
      await moveHandToShowdown({
        tx,
        roomId: room.id,
        handId: hand.id,
        finalPotTotal
      });
      return;
    }

    const nextCurrentBetMax = getCurrentBet(seatedNextPlayers);
    let roundComplete = false;
    let nextActiveSeat: number | null = null;

    if (nextCurrentBetMax === 0) {
      const streetActions = await tx.handAction.findMany({
        where: {
          handId: hand.id,
          street
        },
        select: {
          seatIndex: true
        }
      });

      const actedSeats = new Set(streetActions.map((action) => action.seatIndex));
      roundComplete = actionable.every((player) =>
        player.seatIndex !== null ? actedSeats.has(player.seatIndex) : false
      );

      if (!roundComplete) {
        nextActiveSeat = getNextSeat(seatedNextPlayers, actor.seatIndex, (player) =>
          actionable.some((candidate) => candidate.id === player.id)
        );
      }
    } else {
      const needResponse = actionable.filter(
        (player) => toNumber(player.currentBet) < nextCurrentBetMax
      );
      roundComplete = needResponse.length === 0;

      if (!roundComplete) {
        nextActiveSeat = getNextSeat(seatedNextPlayers, actor.seatIndex, (player) =>
          needResponse.some((candidate) => candidate.id === player.id)
        );
      }
    }

    if (!roundComplete && nextActiveSeat !== null) {
      await tx.gameRoom.update({
        where: { id: room.id },
        data: {
          activeSeat: nextActiveSeat,
          currentStreet: street
        }
      });

      await tx.hand.update({
        where: { id: hand.id },
        data: {
          activeSeat: nextActiveSeat,
          street,
          potTotal: BigInt(finalPotTotal)
        }
      });

      return;
    }

    const nextStreet = computeNextStreet(street);

    if (nextStreet === "SHOWDOWN") {
      await moveHandToShowdown({
        tx,
        roomId: room.id,
        handId: hand.id,
        finalPotTotal
      });
      return;
    }

    await tx.roomPlayer.updateMany({
      where: {
        roomId: room.id,
        leftAt: null
      },
      data: {
        currentBet: BigInt(0)
      }
    });

    const afterStreetReset = (await tx.roomPlayer.findMany({
      where: {
        roomId: room.id,
        leftAt: null
      }
    })) as RoomPlayerRecord[];

    const seatedResetPlayers = getSeatedActivePlayers(afterStreetReset);
    const actionableAfterReset = getActionablePlayers(seatedResetPlayers);

    const dealerSeat = hand.dealerSeat ?? room.dealerSeat ?? seatedResetPlayers[0]?.seatIndex ?? null;

    const streetFirstSeat =
      dealerSeat === null
        ? actionableAfterReset[0]?.seatIndex ?? null
        : getNextSeat(seatedResetPlayers, dealerSeat, (player) =>
            actionableAfterReset.some((candidate) => candidate.id === player.id)
          );

    if (streetFirstSeat === null) {
      await moveHandToShowdown({
        tx,
        roomId: room.id,
        handId: hand.id,
        finalPotTotal
      });
      return;
    }

    await tx.gameRoom.update({
      where: { id: room.id },
      data: {
        currentStreet: nextStreet,
        activeSeat: streetFirstSeat
      }
    });

    await tx.hand.update({
      where: { id: hand.id },
      data: {
        street: nextStreet,
        activeSeat: streetFirstSeat,
        potTotal: BigInt(finalPotTotal)
      }
    });
  });

  const next = await fetchRoomByCode(roomCode);

  if (!next) {
    throw new Error("ROOM_NOT_FOUND");
  }

  return buildRoomState(next, input.userId);
}

export async function settleHandByRoomCode(input: {
  roomCode: string;
  userId: string;
  winnerUserIds: string[];
}): Promise<RoomState> {
  const roomCode = normalizeRoomCode(input.roomCode);

  await prisma.$transaction(async (tx) => {
    const room = (await tx.gameRoom.findUnique({
      where: { roomCode },
      include: {
        roomPlayers: true,
        hands: {
          orderBy: {
            handNumber: "desc"
          },
          take: 1,
          select: {
            id: true,
            handNumber: true,
            street: true,
            status: true,
            dealerSeat: true,
            sbSeat: true,
            bbSeat: true,
            activeSeat: true,
            potTotal: true,
            settledAt: true,
            results: {
              select: {
                id: true,
                userId: true,
                resultType: true,
                amountWon: true,
                netChange: true
              }
            }
          }
        }
      }
    })) as RoomRecord | null;

    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }

    if (room.status !== "ACTIVE") {
      throw new Error("ROOM_NOT_ACTIVE");
    }

    if (room.hostUserId !== input.userId) {
      throw new Error("HOST_ONLY");
    }

    await settleCurrentHand({
      tx,
      room,
      winnerUserIds: input.winnerUserIds
    });
  });

  const next = await fetchRoomByCode(roomCode);
  if (!next) {
    throw new Error("ROOM_NOT_FOUND");
  }

  return buildRoomState(next, input.userId);
}

export async function decideNextHandByRoomCode(input: {
  roomCode: string;
  userId: string;
  continueSession: boolean;
}): Promise<RoomState> {
  const roomCode = normalizeRoomCode(input.roomCode);

  await prisma.$transaction(async (tx) => {
    const room = (await tx.gameRoom.findUnique({
      where: { roomCode },
      include: {
        roomPlayers: true,
        hands: {
          orderBy: {
            handNumber: "desc"
          },
          take: 1,
          select: {
            id: true,
            handNumber: true,
            street: true,
            status: true,
            dealerSeat: true,
            sbSeat: true,
            bbSeat: true,
            activeSeat: true,
            potTotal: true,
            settledAt: true,
            results: {
              select: {
                id: true,
                userId: true,
                resultType: true,
                amountWon: true,
                netChange: true
              }
            }
          }
        }
      }
    })) as RoomRecord | null;

    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }

    if (room.status !== "ACTIVE") {
      throw new Error("ROOM_NOT_ACTIVE");
    }

    if (room.hostUserId !== input.userId) {
      throw new Error("HOST_ONLY");
    }

    const hand = room.hands[0];
    if (!hand) {
      throw new Error("HAND_NOT_FOUND");
    }

    if (normalizeHandStatus(hand.status) !== "SETTLED") {
      throw new Error("HAND_NOT_SETTLED");
    }

    if (!input.continueSession) {
      await finalizeRoomAndArchive({
        tx,
        room
      });
      return;
    }

    const eligiblePlayers = getHandEligiblePlayers(room.roomPlayers);
    if (eligiblePlayers.length < 2) {
      throw new Error("NOT_ENOUGH_ACTIVE_PLAYERS");
    }

    const currentDealerSeat = hand.dealerSeat ?? room.dealerSeat ?? eligiblePlayers[0].seatIndex ?? 0;
    const nextDealerSeat =
      getNextSeat(eligiblePlayers, currentDealerSeat, () => true) ??
      eligiblePlayers[0].seatIndex ??
      currentDealerSeat;

    await startNextHand({
      tx,
      roomId: room.id,
      dealerSeatCandidate: nextDealerSeat
    });
  });

  const next = await fetchRoomByCode(roomCode);
  if (!next) {
    throw new Error("ROOM_NOT_FOUND");
  }

  return buildRoomState(next, input.userId);
}

export async function setPlayerConnectionByRoomCode(input: {
  roomCode: string;
  userId: string;
  isConnected: boolean;
}): Promise<void> {
  const room = await fetchRoomByCode(input.roomCode);

  if (!room) {
    return;
  }

  const member = room.roomPlayers.find((player) => player.userId === input.userId && !player.leftAt);

  if (!member) {
    return;
  }

  await prisma.roomPlayer.update({
    where: { id: member.id },
    data: {
      isConnected: input.isConnected
    }
  });
}
