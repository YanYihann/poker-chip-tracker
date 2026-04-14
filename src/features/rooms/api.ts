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
  positionLabel:
    | "BTN"
    | "SB"
    | "BB"
    | "UTG"
    | "UTG+1"
    | "MP"
    | "LJ"
    | "HJ"
    | "CO"
    | "BTN/SB"
    | null;
  joinedAtIso: string;
};

export type RoomActionTraceMeta = {
  traceId: string;
  clientActionAtMs: number | null;
  requestReceivedAtMs: number;
  dbTransactionStartedAtMs: number;
  dbTransactionCommittedAtMs: number;
  websocketBroadcastSentAtMs?: number;
};

export type RoomState = {
  room: {
    id: string;
    code: string;
    mode: "local" | "online";
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
    myHoleCards: string[];
    boardCards: string[];
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

export type RoomActionPatch = {
  type: "action-applied";
  roomCode: string;
  roomStatus: RoomState["room"]["status"];
  game: {
    handId: string | null;
    handNumber: number;
    street: NonNullable<RoomState["game"]>["street"];
    status: NonNullable<RoomState["game"]>["status"];
    potTotal: number;
    currentBet: number;
    activeSeat: number | null;
    activePlayerUserId: string | null;
    dealerSeat: number | null;
    sbSeat: number | null;
    bbSeat: number | null;
    minBet: number;
    minRaiseDelta: number;
    boardCards: string[];
  } | null;
  players: Array<{
    userId: string;
    seatIndex: number | null;
    stack: number;
    currentBet: number;
    status: RoomState["players"][number]["status"];
    isReady: boolean;
    isConnected: boolean;
  }>;
  meta?: RoomActionTraceMeta;
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
  mode?: "local" | "online";
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
  amount?: number,
  options?: {
    responseMode?: "room" | "ack";
    trace?: {
      traceId: string;
      clientActionAtMs: number;
    };
  }
): Promise<RoomState | null> {
  const responseMode = options?.responseMode ?? "room";
  const payload = await request<{ room: RoomState } | { ok: true; trace?: RoomActionTraceMeta }>(
    `/api/rooms/${roomCode.toUpperCase()}/action${responseMode === "ack" ? "?response=ack" : ""}`,
    {
      method: "POST",
      body: JSON.stringify({ actionType, amount }),
      headers: {
        ...(options?.trace
          ? {
              "x-action-trace-id": options.trace.traceId,
              "x-client-action-at": String(options.trace.clientActionAtMs),
              "x-room-response-mode": responseMode
            }
          : {
              "x-room-response-mode": responseMode
            })
      }
    }
  );

  if ("room" in payload) {
    return payload.room;
  }

  return null;
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
