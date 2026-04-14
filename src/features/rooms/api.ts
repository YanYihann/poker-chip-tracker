import { getApiUrl, toNetworkError } from "@/lib/api-base-url";

type RoomPlayer = {
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
  positionLabel: "BTN" | "SB" | "BB" | "UTG" | "MP" | "HJ" | "CO" | null;
  joinedAtIso: string;
};

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
  players: RoomPlayer[];
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
    street: "preflop" | "flop" | "turn" | "river" | "showdown";
    status: "in-progress" | "showdown" | "settled";
    potTotal: number;
    currentBet: number;
    activeSeat: number | null;
    activePlayerUserId: string | null;
    dealerSeat: number | null;
    sbSeat: number | null;
    bbSeat: number | null;
    isMyTurn: boolean;
    legalActions: Array<"fold" | "check" | "call" | "bet" | "raise" | "all-in">;
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

type ApiError = {
  message?: string;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(getApiUrl(path), {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });
  } catch (error) {
    throw toNetworkError(error);
  }

  const payload = (await response.json().catch(() => null)) as ApiError | T | null;

  if (!response.ok) {
    throw new Error((payload as ApiError | null)?.message ?? "Request failed.");
  }

  return payload as T;
}

export async function createRoom(input?: {
  maxPlayers?: number;
  startingStack?: number;
  smallBlind?: number;
  bigBlind?: number;
}): Promise<RoomState> {
  const payload = await request<{ room: RoomState }>("/api/rooms", {
    method: "POST",
    body: JSON.stringify(input ?? {})
  });

  return payload.room;
}

export async function joinRoom(input: {
  roomCode: string;
  displayName?: string;
}): Promise<RoomState> {
  const payload = await request<{ room: RoomState }>("/api/rooms/join", {
    method: "POST",
    body: JSON.stringify({
      roomCode: input.roomCode.toUpperCase(),
      displayName: input.displayName
    })
  });

  return payload.room;
}

export async function getRoom(roomCode: string): Promise<RoomState> {
  const payload = await request<{ room: RoomState }>(`/api/rooms/${roomCode.toUpperCase()}`);
  return payload.room;
}

export async function setReady(roomCode: string, isReady: boolean): Promise<RoomState> {
  const payload = await request<{ room: RoomState }>(`/api/rooms/${roomCode.toUpperCase()}/ready`, {
    method: "PATCH",
    body: JSON.stringify({ isReady })
  });
  return payload.room;
}

export async function setPlayerBuyIn(roomCode: string, buyIn: number): Promise<RoomState> {
  const payload = await request<{ room: RoomState }>(`/api/rooms/${roomCode.toUpperCase()}/buy-in`, {
    method: "PATCH",
    body: JSON.stringify({ buyIn })
  });
  return payload.room;
}

export async function startRoom(roomCode: string): Promise<RoomState> {
  const payload = await request<{ room: RoomState }>(`/api/rooms/${roomCode.toUpperCase()}/start`, {
    method: "POST"
  });
  return payload.room;
}

export async function submitRoomAction(
  roomCode: string,
  actionType: "fold" | "check" | "call" | "bet" | "raise" | "all-in",
  amount?: number
): Promise<RoomState> {
  const payload = await request<{ room: RoomState }>(`/api/rooms/${roomCode.toUpperCase()}/action`, {
    method: "POST",
    body: JSON.stringify({ actionType, amount })
  });
  return payload.room;
}

export async function updateRoomBlinds(
  roomCode: string,
  input: {
    smallBlind: number;
    bigBlind: number;
  }
): Promise<RoomState> {
  const payload = await request<{ room: RoomState }>(`/api/rooms/${roomCode.toUpperCase()}/blinds`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return payload.room;
}

export async function settleHand(
  roomCode: string,
  winnerUserIds: string[]
): Promise<RoomState> {
  const payload = await request<{ room: RoomState }>(`/api/rooms/${roomCode.toUpperCase()}/settle`, {
    method: "POST",
    body: JSON.stringify({ winnerUserIds })
  });
  return payload.room;
}

export async function decideNextHand(
  roomCode: string,
  continueSession: boolean
): Promise<RoomState> {
  const payload = await request<{ room: RoomState }>(`/api/rooms/${roomCode.toUpperCase()}/next-hand`, {
    method: "POST",
    body: JSON.stringify({ continueSession })
  });
  return payload.room;
}
