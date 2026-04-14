import { prisma } from "../../lib/prisma.js";

import { performance } from "node:perf_hooks";

import { Prisma } from "@prisma/client";

import { recordPerfSample } from "../../lib/perf-metrics.js";
import type { RoomActionPatch, RoomActionTraceMeta } from "../../realtime/room-patch.js";
import { compareHoldemHandStrength, evaluateBestHoldemHand } from "./hand-evaluator.js";
import {
  createStandardDeck,
  dealCards,
  isCardCode,
  revealedBoardCardsByStreet,
  shuffleDeck,
  type CardCode,
  type StreetCode
} from "./deck.js";

const ROOM_CODE_ALPHABET = "0123456789";
const ROOM_CODE_LENGTH = 4;

type PublicStreet = "preflop" | "flop" | "turn" | "river" | "showdown";
type RoomMode = "local" | "online";
type HandStatusCode = "ACTIVE" | "SHOWDOWN" | "SETTLED" | "CANCELLED";
type StoredPositionCode = "BTN" | "SB" | "BB" | "UTG" | "MP" | "HJ" | "CO";
type PositionCode = StoredPositionCode | "BTN/SB" | "UTG+1" | "LJ";
type HandRankCode =
  | "high-card"
  | "one-pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush";

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
  positionLabel: StoredPositionCode | null;
  joinedAt: Date;
  leftAt: Date | null;
  user?: {
    profile?: {
      avatarUrl: string | null;
    } | null;
  } | null;
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
  deckShuffled: string[];
  boardCards: string[];
  holeCardsByUser: Prisma.JsonValue | null;
  settledAt: Date | null;
  results: HandResultRecord[];
};

type RoomRecord = {
  id: string;
  roomCode: string;
  hostUserId: string;
  gameMode: string;
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

type ActionTraceInput = {
  traceId: string;
  clientActionAtMs: number | null;
  requestReceivedAtMs: number;
} | null;

type RoomPatchSnapshotPlayerRecord = {
  userId: string;
  seatIndex: number | null;
  stack: bigint | number;
  currentBet: bigint | number;
  isReady: boolean;
  isConnected: boolean;
  hasFolded: boolean;
  isAllIn: boolean;
  leftAt: Date | null;
};

type RoomPatchSnapshotHandRecord = {
  id: string;
  handNumber: number;
  street: StreetCode;
  status: HandStatusCode;
  dealerSeat: number;
  sbSeat: number;
  bbSeat: number;
  activeSeat: number | null;
  potTotal: bigint | number;
  boardCards: string[];
};

type RoomPatchSnapshot = {
  roomCode: string;
  status: string;
  gameMode: string;
  currentHandNumber: number;
  currentStreet: string | null;
  activeSeat: number | null;
  bigBlind: bigint | number;
  roomPlayers: RoomPatchSnapshotPlayerRecord[];
  hands: RoomPatchSnapshotHandRecord[];
};

export type ApplyPlayerActionResult = {
  roomState: RoomState | null;
  traceMeta: RoomActionTraceMeta | null;
};

export type RoomState = {
  room: {
    id: string;
    code: string;
    mode: RoomMode;
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
    avatarUrl: string | null;
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
    myHoleCards: string[];
    boardCards: string[];
    eligibleWinnerUserIds: string[];
    lastSettlement: {
      entries: Array<{
        userId: string;
        displayName: string;
        amountWon: number;
        netChange: number;
        handRankCode: HandRankCode | null;
        bestFiveCards: string[];
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

function normalizeCardList(value: unknown): CardCode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .filter((card): card is CardCode => isCardCode(card));
}

function normalizeHoleCardsByUser(
  value: Prisma.JsonValue | null | undefined
): Record<string, CardCode[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, CardCode[]> = {};

  for (const [key, cards] of Object.entries(value as Record<string, unknown>)) {
    if (key.trim().length === 0) {
      continue;
    }

    result[key] = normalizeCardList(cards);
  }

  return result;
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

function handRankCodeFromCategory(category: number): HandRankCode {
  if (category === 8) {
    return "straight-flush";
  }
  if (category === 7) {
    return "four-of-a-kind";
  }
  if (category === 6) {
    return "full-house";
  }
  if (category === 5) {
    return "flush";
  }
  if (category === 4) {
    return "straight";
  }
  if (category === 3) {
    return "three-of-a-kind";
  }
  if (category === 2) {
    return "two-pair";
  }
  if (category === 1) {
    return "one-pair";
  }
  return "high-card";
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

function toPublicRoomMode(mode: string | null | undefined): RoomMode {
  if (mode?.toUpperCase() === "LOCAL") {
    return "local";
  }

  return "online";
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

function getClockwisePlayersFromSeat(
  orderedPlayers: RoomPlayerRecord[],
  startSeat: number
): RoomPlayerRecord[] {
  if (orderedPlayers.length === 0) {
    return [];
  }

  const startIndex = orderedPlayers.findIndex((player) => player.seatIndex === startSeat);
  const safeStartIndex = startIndex >= 0 ? startIndex : 0;

  return orderedPlayers.map((_, offset) => {
    const cursor = (safeStartIndex + offset) % orderedPlayers.length;
    return orderedPlayers[cursor];
  });
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

const POSITION_SEQUENCE_BY_PLAYER_COUNT: Record<number, PositionCode[]> = {
  2: ["BTN/SB", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "UTG"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
  7: ["BTN", "SB", "BB", "UTG", "MP", "HJ", "CO"],
  8: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"],
  9: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "LJ", "HJ", "CO"]
};

function toStoredPositionCode(label: PositionCode): StoredPositionCode {
  if (label === "BTN/SB") {
    return "BTN";
  }
  if (label === "UTG+1") {
    return "MP";
  }
  if (label === "LJ") {
    return "HJ";
  }
  return label;
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
  const dealerIndex = orderedPlayers.findIndex((player) => player.seatIndex === dealerSeat);
  const safeDealerIndex = dealerIndex >= 0 ? dealerIndex : 0;
  const expectedSequence =
    POSITION_SEQUENCE_BY_PLAYER_COUNT[orderedPlayers.length] ?? POSITION_SEQUENCE_BY_PLAYER_COUNT[9];

  for (let step = 0; step < orderedPlayers.length; step += 1) {
    const cursor = (safeDealerIndex + step) % orderedPlayers.length;
    const seat = orderedPlayers[cursor].seatIndex;
    if (seat === null) {
      continue;
    }

    const label = expectedSequence[Math.min(step, expectedSequence.length - 1)];
    labels.set(seat, label);
  }

  if (orderedPlayers.length === 2 && sbSeat !== null && bbSeat !== null) {
    labels.set(sbSeat, "BTN/SB");
    labels.set(bbSeat, "BB");
  }

  return labels;
}

async function fetchRoomByCode(roomCode: string): Promise<RoomRecord | null> {
  const startedAt = performance.now();
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  try {
    return (await prisma.gameRoom.findUnique({
      where: { roomCode: normalizedRoomCode },
      include: {
        roomPlayers: {
          include: {
            user: {
              select: {
                profile: {
                  select: {
                    avatarUrl: true
                  }
                }
              }
            }
          }
        },
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
            deckShuffled: true,
            boardCards: true,
            holeCardsByUser: true,
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
  } finally {
    recordPerfSample("rooms.fetchRoomByCode", performance.now() - startedAt, {
      roomCode: normalizedRoomCode
    });
  }
}

async function fetchRoomPatchSnapshotByCode(roomCode: string): Promise<RoomPatchSnapshot | null> {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  return (await prisma.gameRoom.findUnique({
    where: { roomCode: normalizedRoomCode },
    select: {
      roomCode: true,
      status: true,
      gameMode: true,
      currentHandNumber: true,
      currentStreet: true,
      activeSeat: true,
      bigBlind: true,
      roomPlayers: {
        select: {
          userId: true,
          seatIndex: true,
          stack: true,
          currentBet: true,
          isReady: true,
          isConnected: true,
          hasFolded: true,
          isAllIn: true,
          leftAt: true
        }
      },
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
          boardCards: true
        }
      }
    }
  })) as RoomPatchSnapshot | null;
}

function buildRoomActionPatchFromSnapshot(snapshot: RoomPatchSnapshot): RoomActionPatch {
  const roomStatus = toPublicRoomStatus(snapshot.status);
  const roomMode = toPublicRoomMode(snapshot.gameMode);
  const latestHand = snapshot.hands[0] ?? null;
  const handStatus = normalizeHandStatus(latestHand?.status);
  const streetCode = normalizeStreet(snapshot.currentStreet ?? latestHand?.street);
  const gameStatus: NonNullable<RoomActionPatch["game"]>["status"] =
    handStatus === "SETTLED" ? "settled" : streetCode === "SHOWDOWN" ? "showdown" : "in-progress";

  const players = snapshot.roomPlayers
    .filter((player) => !player.leftAt)
    .sort((a, b) => (a.seatIndex ?? Number.MAX_SAFE_INTEGER) - (b.seatIndex ?? Number.MAX_SAFE_INTEGER));

  const activeSeat = latestHand?.activeSeat ?? snapshot.activeSeat;
  const activePlayer =
    activeSeat === null ? null : players.find((player) => player.seatIndex === activeSeat) ?? null;

  const currentBet = players
    .filter((player) => !player.hasFolded)
    .reduce((maxBet, player) => Math.max(maxBet, toNumber(player.currentBet)), 0);

  const reservedBoardCards =
    roomMode === "online" ? normalizeCardList(latestHand?.boardCards ?? []) : [];
  const boardCards = roomMode === "online" ? revealedBoardCardsByStreet(reservedBoardCards, streetCode) : [];
  const minBet = Math.max(1, toNumber(snapshot.bigBlind));

  return {
    type: "action-applied",
    roomCode: snapshot.roomCode,
    roomStatus,
    game:
      roomStatus !== "active" || !latestHand
        ? null
        : {
            handId: latestHand.id,
            handNumber: latestHand.handNumber ?? snapshot.currentHandNumber,
            street: toPublicStreet(streetCode),
            status: gameStatus,
            potTotal: gameStatus === "settled" ? 0 : toNumber(latestHand.potTotal),
            currentBet,
            activeSeat,
            activePlayerUserId: activePlayer?.userId ?? null,
            dealerSeat: latestHand.dealerSeat ?? null,
            sbSeat: latestHand.sbSeat ?? null,
            bbSeat: latestHand.bbSeat ?? null,
            minBet,
            minRaiseDelta: minBet,
            boardCards
          },
    players: players.map((player) => {
      const stack = toNumber(player.stack);
      const status: RoomActionPatch["players"][number]["status"] = player.hasFolded
        ? "folded"
        : player.isAllIn || stack <= 0
          ? "all-in"
          : gameStatus === "in-progress" &&
              activeSeat !== null &&
              player.seatIndex !== null &&
              player.seatIndex === activeSeat
            ? "acting"
            : "waiting";

      return {
        userId: player.userId,
        seatIndex: player.seatIndex,
        stack,
        currentBet: toNumber(player.currentBet),
        status,
        isReady: player.isReady,
        isConnected: player.isConnected
      };
    })
  };
}

function buildRoomState(room: RoomRecord, currentUserId: string | null): RoomState {
  const activeSeat = room.activeSeat;
  const roomStatus = toPublicRoomStatus(room.status);
  const roomMode = toPublicRoomMode(room.gameMode);
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
  const eligibleForPosition = getSeatedActivePlayers(sortedPlayers).filter(
    (player) => toNumber(player.stack) > 0 || toNumber(player.currentBet) > 0
  );
  const dealerSeatForLabels =
    latestHand?.dealerSeat ??
    room.dealerSeat ??
    eligibleForPosition[0]?.seatIndex ??
    sortedPlayers[0]?.seatIndex ??
    null;
  const labelBySeat =
    dealerSeatForLabels === null
      ? new Map<number, PositionCode>()
      : computePositionLabelBySeat(
          eligibleForPosition,
          dealerSeatForLabels,
          latestHand?.sbSeat ?? null,
          latestHand?.bbSeat ?? null
        );

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
      avatarUrl: player.user?.profile?.avatarUrl ?? null,
      seatIndex: player.seatIndex,
      isHost: player.isHost,
      isReady: player.isReady,
      isConnected: player.isConnected,
      stack,
      currentBet,
      status,
      positionLabel:
        player.seatIndex !== null
          ? (labelBySeat.get(player.seatIndex) ?? null)
          : null,
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
  const showdownEvaluationByUserId =
    roomMode === "online"
      ? (() => {
          const board = normalizeCardList(latestHand?.boardCards ?? []);
          if (board.length < 5) {
            return new Map<string, { handRankCode: HandRankCode; bestFiveCards: string[] }>();
          }

          const holeCardsByUser = normalizeHoleCardsByUser(latestHand?.holeCardsByUser);
          const map = new Map<string, { handRankCode: HandRankCode; bestFiveCards: string[] }>();

          for (const player of contenders) {
            const holeCards = holeCardsByUser[player.userId] ?? [];
            if (holeCards.length < 2) {
              continue;
            }

            const evaluated = evaluateBestHoldemHand([...holeCards.slice(0, 2), ...board.slice(0, 5)]);
            map.set(player.userId, {
              handRankCode: handRankCodeFromCategory(evaluated.category),
              bestFiveCards: [...evaluated.bestFiveCards]
            });
          }

          return map;
        })()
      : new Map<string, { handRankCode: HandRankCode; bestFiveCards: string[] }>();
  const settlementEntries = (latestHand?.results ?? [])
    .map((result) => {
      const showdownEvaluation = showdownEvaluationByUserId.get(result.userId);
      return {
        userId: result.userId,
        displayName: playerNameMap.get(result.userId) ?? result.userId,
        amountWon: toNumber(result.amountWon),
        netChange: toNumber(result.netChange),
        handRankCode: showdownEvaluation?.handRankCode ?? null,
        bestFiveCards: showdownEvaluation?.bestFiveCards ?? []
      };
    })
    .sort((a, b) => b.netChange - a.netChange);
  const reservedBoardCards =
    roomMode === "online" ? normalizeCardList(latestHand?.boardCards ?? []) : [];
  const boardCards = roomMode === "online" ? revealedBoardCardsByStreet(reservedBoardCards, streetCode) : [];
  const holeCardsByUser = normalizeHoleCardsByUser(latestHand?.holeCardsByUser);
  const myHoleCards =
    roomMode === "online" && currentUserId ? holeCardsByUser[currentUserId] ?? [] : [];

  return {
    room: {
      id: room.id,
      code: room.roomCode,
      mode: roomMode,
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
            myHoleCards,
            boardCards,
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

type SidePot = {
  amount: number;
  participantUserIds: string[];
};

function buildSidePotsFromContributions(
  contributions: Array<{
    userId: string;
    amount: number;
  }>
): SidePot[] {
  const active = contributions
    .filter((item) => item.amount > 0)
    .map((item) => ({ ...item }))
    .sort((a, b) => a.amount - b.amount);

  if (active.length === 0) {
    return [];
  }

  const sidePots: SidePot[] = [];
  let previousLevel = 0;

  while (active.length > 0) {
    const currentLevel = active[0].amount;
    const layer = currentLevel - previousLevel;

    if (layer > 0) {
      const participantUserIds = active.map((item) => item.userId);
      sidePots.push({
        amount: layer * participantUserIds.length,
        participantUserIds
      });
    }

    while (active.length > 0 && active[0].amount === currentLevel) {
      active.shift();
    }
    previousLevel = currentLevel;
  }

  return sidePots;
}

async function settleCurrentHand(input: {
  tx: Prisma.TransactionClient;
  room: RoomRecord;
  winnerUserIds?: string[];
}): Promise<void> {
  const { tx, room } = input;
  const roomMode = toPublicRoomMode(room.gameMode);
  const hand = room.hands[0];

  if (!hand) {
    throw new Error("HAND_NOT_FOUND");
  }

  const handStatus = normalizeHandStatus(hand.status);
  const roomStreet = normalizeStreet(room.currentStreet ?? hand.street);
  const fallbackPotTotal = Math.max(
    Math.max(0, toNumber(hand.potTotal)),
    Math.max(0, toNumber(room.potTotal))
  );

  if (handStatus === "SETTLED") {
    throw new Error("HAND_ALREADY_SETTLED");
  }

  const seatedPlayersBeforeSettle = getSeatedActivePlayers(room.roomPlayers);
  const contendersBeforeSettle = seatedPlayersBeforeSettle.filter((player) => !player.hasFolded);
  const actionableBeforeSettle = getActionablePlayers(seatedPlayersBeforeSettle);

  if (handStatus !== "SHOWDOWN") {
    const canPromoteToShowdown =
      roomStreet === "SHOWDOWN" ||
      room.activeSeat === null ||
      contendersBeforeSettle.length <= 1 ||
      actionableBeforeSettle.length === 0;

    if (!canPromoteToShowdown) {
      throw new Error("HAND_NOT_SHOWDOWN");
    }

    await moveHandToShowdown({
      tx,
      roomId: room.id,
      handId: hand.id,
      finalPotTotal: fallbackPotTotal
    });
  }

  const seatedPlayers = seatedPlayersBeforeSettle;
  const contenders = contendersBeforeSettle;
  const winnerUserIds = [...new Set(input.winnerUserIds ?? [])];

  const potTotal = Math.max(0, toNumber(hand.potTotal));
  const payoutByUserId = new Map<string, number>();
  const splitWinnerUserIds = new Set<string>();

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

  const sidePots = buildSidePotsFromContributions(
    seatedPlayers.map((player) => ({
      userId: player.userId,
      amount: contributedByUserId.get(player.userId) ?? 0
    }))
  );

  const contenderSet = new Set(contenders.map((player) => player.userId));
  const contenderByUserId = new Map(contenders.map((player) => [player.userId, player]));

  const manualWinnerSet = new Set(winnerUserIds);
  if (roomMode !== "online") {
    if (winnerUserIds.length === 0) {
      throw new Error("WINNERS_REQUIRED");
    }

    const manualWinners = contenders.filter((player) => manualWinnerSet.has(player.userId));
    if (manualWinners.length !== winnerUserIds.length) {
      throw new Error("INVALID_WINNERS");
    }
  }

  const contenderStrengthByUserId =
    roomMode === "online"
      ? (() => {
          const boardCards = normalizeCardList(hand.boardCards);
          const holeCardsByUser = normalizeHoleCardsByUser(hand.holeCardsByUser);

          if (boardCards.length < 5) {
            throw new Error("HAND_NOT_SHOWDOWN");
          }

          const strengthByUserId = new Map<
            string,
            ReturnType<typeof evaluateBestHoldemHand>
          >();

          for (const contender of contenders) {
            const holeCards = holeCardsByUser[contender.userId] ?? [];
            if (holeCards.length < 2) {
              throw new Error("INVALID_WINNERS");
            }

            strengthByUserId.set(
              contender.userId,
              evaluateBestHoldemHand([...holeCards.slice(0, 2), ...boardCards.slice(0, 5)])
            );
          }

          return strengthByUserId;
        })()
      : null;

  const computedTotalPot = sidePots.reduce((sum, sidePot) => sum + sidePot.amount, 0);
  if (sidePots.length === 0 && potTotal > 0) {
    sidePots.push({
      amount: potTotal,
      participantUserIds: seatedPlayers.map((player) => player.userId)
    });
  } else if (sidePots.length > 0 && computedTotalPot !== potTotal) {
    const adjusted = Math.max(0, sidePots[0].amount + (potTotal - computedTotalPot));
    sidePots[0] = {
      ...sidePots[0],
      amount: adjusted
    };
  }

  for (const sidePot of sidePots) {
    if (sidePot.amount <= 0) {
      continue;
    }

    const eligibleParticipants = sidePot.participantUserIds
      .filter((userId) => contenderSet.has(userId))
      .map((userId) => contenderByUserId.get(userId))
      .filter((player): player is RoomPlayerRecord => !!player)
      .sort((a, b) => (a.seatIndex ?? 999) - (b.seatIndex ?? 999));

    if (eligibleParticipants.length === 0) {
      throw new Error("INVALID_WINNERS");
    }

    let eligibleWinners: RoomPlayerRecord[] = [];
    if (roomMode === "online") {
      if (!contenderStrengthByUserId) {
        throw new Error("INVALID_WINNERS");
      }

      const topWinners: RoomPlayerRecord[] = [];
      let topStrength: ReturnType<typeof evaluateBestHoldemHand> | null = null;

      for (const participant of eligibleParticipants) {
        const strength = contenderStrengthByUserId.get(participant.userId);
        if (!strength) {
          throw new Error("INVALID_WINNERS");
        }

        if (!topStrength) {
          topStrength = strength;
          topWinners.push(participant);
          continue;
        }

        const comparison = compareHoldemHandStrength(strength, topStrength);
        if (comparison > 0) {
          topStrength = strength;
          topWinners.length = 0;
          topWinners.push(participant);
          continue;
        }

        if (comparison === 0) {
          topWinners.push(participant);
        }
      }

      eligibleWinners = topWinners.sort((a, b) => (a.seatIndex ?? 999) - (b.seatIndex ?? 999));
    } else {
      eligibleWinners = eligibleParticipants.filter((player) => manualWinnerSet.has(player.userId));
    }

    if (eligibleWinners.length === 0) {
      throw new Error("INVALID_WINNERS");
    }

    const eachShare = Math.floor(sidePot.amount / eligibleWinners.length);
    const remainder = sidePot.amount % eligibleWinners.length;

    eligibleWinners.forEach((winner, index) => {
      const previous = payoutByUserId.get(winner.userId) ?? 0;
      payoutByUserId.set(winner.userId, previous + eachShare + (index === 0 ? remainder : 0));
    });

    if (eligibleWinners.length > 1) {
      eligibleWinners.forEach((winner) => splitWinnerUserIds.add(winner.userId));
    }
  }

  const paidWinners = seatedPlayers
    .filter((player) => (payoutByUserId.get(player.userId) ?? 0) > 0)
    .sort((a, b) => (a.seatIndex ?? 999) - (b.seatIndex ?? 999));

  for (const winner of paidWinners) {
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

  const globalResultType: "WIN" | "SPLIT" = paidWinners.length <= 1 ? "WIN" : "SPLIT";
  for (const player of seatedPlayers) {
    const amountWon = payoutByUserId.get(player.userId) ?? 0;
    const contribution = contributedByUserId.get(player.userId) ?? 0;
    const netChange = amountWon - contribution;
    const resultType: "WIN" | "SPLIT" =
      amountWon > 0 && splitWinnerUserIds.has(player.userId) ? "SPLIT" : globalResultType;

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

  const roomMode = toPublicRoomMode(room.gameMode);

  const seatedPlayers = getSeatedActivePlayers(room.roomPlayers);
  const eligiblePlayers = seatedPlayers.filter((player) => toNumber(player.stack) > 0);

  if (eligiblePlayers.length < 2) {
    throw new Error("NOT_ENOUGH_ACTIVE_PLAYERS");
  }

  const dealerSeat = eligiblePlayers.some((player) => player.seatIndex === dealerSeatCandidate)
    ? dealerSeatCandidate
    : (eligiblePlayers[0].seatIndex ?? 0);
  const isHeadsUp = eligiblePlayers.length === 2;
  const sbSeat = isHeadsUp
    ? dealerSeat
    : getNextSeat(eligiblePlayers, dealerSeat, () => true);
  const bbSeat = isHeadsUp
    ? getNextSeat(eligiblePlayers, dealerSeat, () => true)
    : getNextSeat(eligiblePlayers, sbSeat ?? dealerSeat, () => true);
  const labelBySeat = computePositionLabelBySeat(eligiblePlayers, dealerSeat, sbSeat, bbSeat);
  let shuffledDeck: CardCode[] = [];
  let holeCardsByUser: Record<string, CardCode[]> = {};
  let boardCards: CardCode[] = [];

  if (roomMode === "online") {
    const dealStartSeat =
      sbSeat ??
      getNextSeat(eligiblePlayers, dealerSeat, () => true) ??
      (eligiblePlayers[0]?.seatIndex ?? dealerSeat);
    const dealingOrderPlayers = getClockwisePlayersFromSeat(eligiblePlayers, dealStartSeat);
    shuffledDeck = shuffleDeck(createStandardDeck());
    const dealt = dealCards({
      shuffledDeck,
      dealingOrderUserIds: dealingOrderPlayers.map((player) => player.userId),
      holeCardsPerPlayer: 2,
      boardCardCount: 5
    });
    holeCardsByUser = dealt.holeCardsByUser;
    boardCards = dealt.boardCards;
  }

  await Promise.all(
    seatedPlayers.map((player) => {
      const computedLabel = player.seatIndex !== null ? labelBySeat.get(player.seatIndex) : null;
      return tx.roomPlayer.update({
        where: { id: player.id },
        data: {
          currentBet: BigInt(0),
          hasFolded: false,
          isAllIn: toNumber(player.stack) <= 0,
          isEliminated: toNumber(player.stack) <= 0,
          positionLabel: computedLabel ? toStoredPositionCode(computedLabel) : null
        }
      });
    })
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
      sidePotTotal: BigInt(0),
      deckShuffled: shuffledDeck,
      boardCards,
      holeCardsByUser:
        roomMode === "online"
          ? (holeCardsByUser as Prisma.InputJsonValue)
          : Prisma.JsonNull
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
  mode?: RoomMode;
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
  const gameMode = input.mode === "local" ? "local" : "online";
  const displayName = await resolveDisplayName(input.hostUserId);

  await prisma.gameRoom.create({
    data: {
      roomCode,
      hostUserId: input.hostUserId,
      gameMode,
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

export async function getRoomStatesByCodeForUsers(
  roomCode: string,
  userIds: string[]
): Promise<Map<string, RoomState> | null> {
  const room = await fetchRoomByCode(roomCode);

  if (!room) {
    return null;
  }

  const statesByUserId = new Map<string, RoomState>();
  const uniqueUserIds = Array.from(new Set(userIds.filter((userId) => userId.trim().length > 0)));

  for (const userId of uniqueUserIds) {
    statesByUserId.set(userId, buildRoomState(room, userId));
  }

  return statesByUserId;
}

export async function getRoomActionPatchByCode(roomCode: string): Promise<RoomActionPatch | null> {
  const snapshot = await fetchRoomPatchSnapshotByCode(roomCode);
  if (!snapshot) {
    return null;
  }

  return buildRoomActionPatchFromSnapshot(snapshot);
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
  includeRoomState?: boolean;
  trace?: ActionTraceInput;
}): Promise<ApplyPlayerActionResult> {
  const startedAt = performance.now();
  const roomCode = normalizeRoomCode(input.roomCode);
  const includeRoomState = input.includeRoomState !== false;
  let dbTransactionStartedAtMs = 0;
  let dbTransactionCommittedAtMs = 0;

  try {
    dbTransactionStartedAtMs = Date.now();
    if (input.trace?.traceId) {
      console.info("[online-trace] db_transaction_start", {
        traceId: input.trace.traceId,
        roomCode,
        actionType: input.actionType,
        dbTransactionStartedAtMs
      });
    }

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

    const existingHandActions = await tx.handAction.findMany({
      where: {
        handId: hand.id
      },
      select: {
        actionOrder: true,
        seatIndex: true,
        street: true
      }
    });
    const nextActionOrder = existingHandActions.reduce(
      (maxOrder, action) => Math.max(maxOrder, action.actionOrder),
      0
    ) + 1;

    await tx.handAction.create({
      data: {
        handId: hand.id,
        roomId: room.id,
        userId: actor.userId,
        seatIndex: actor.seatIndex,
        street,
        actionType: mapActionTypeToDb(input.actionType),
        amount: BigInt(contribution),
        actionOrder: nextActionOrder
      }
    });

    const seatedNextPlayers = players.map((player) => {
      if (player.id !== actor.id) {
        return player;
      }

      return {
        ...player,
        stack: BigInt(nextStack),
        currentBet: BigInt(nextCurrentBet),
        hasFolded,
        isAllIn: nextStack <= 0,
        isEliminated: nextStack <= 0
      };
    });

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
      const actedSeats = new Set(
        existingHandActions
          .filter((action) => action.street === street)
          .map((action) => action.seatIndex)
      );
      actedSeats.add(actor.seatIndex);
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

    dbTransactionCommittedAtMs = Date.now();
    if (input.trace?.traceId) {
      console.info("[online-trace] db_transaction_commit", {
        traceId: input.trace.traceId,
        roomCode,
        actionType: input.actionType,
        dbTransactionCommittedAtMs,
        dbTransactionDurationMs: Math.max(0, dbTransactionCommittedAtMs - dbTransactionStartedAtMs)
      });
    }

    const traceMeta: RoomActionTraceMeta | null = input.trace?.traceId
      ? {
          traceId: input.trace.traceId,
          clientActionAtMs: input.trace.clientActionAtMs,
          requestReceivedAtMs: input.trace.requestReceivedAtMs,
          dbTransactionStartedAtMs,
          dbTransactionCommittedAtMs
        }
      : null;

    if (!includeRoomState) {
      return {
        roomState: null,
        traceMeta
      };
    }

    const next = await fetchRoomByCode(roomCode);

    if (!next) {
      throw new Error("ROOM_NOT_FOUND");
    }

    return {
      roomState: buildRoomState(next, input.userId),
      traceMeta
    };
  } finally {
    recordPerfSample("rooms.applyPlayerActionByRoomCode", performance.now() - startedAt, {
      roomCode,
      actionType: input.actionType
    });
  }
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
