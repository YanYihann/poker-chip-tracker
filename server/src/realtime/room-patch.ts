import type { RoomState } from "../modules/rooms/room.service.js";

export type RoomActionTraceMeta = {
  traceId: string;
  clientActionAtMs: number | null;
  requestReceivedAtMs: number;
  dbTransactionStartedAtMs: number;
  dbTransactionCommittedAtMs: number;
  websocketBroadcastSentAtMs?: number;
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

export function buildRoomActionPatch(roomState: RoomState): RoomActionPatch {
  return {
    type: "action-applied",
    roomCode: roomState.room.code,
    roomStatus: roomState.room.status,
    game: roomState.game
      ? {
          handId: roomState.game.handId,
          handNumber: roomState.game.handNumber,
          street: roomState.game.street,
          status: roomState.game.status,
          potTotal: roomState.game.potTotal,
          currentBet: roomState.game.currentBet,
          activeSeat: roomState.game.activeSeat,
          activePlayerUserId: roomState.game.activePlayerUserId,
          dealerSeat: roomState.game.dealerSeat,
          sbSeat: roomState.game.sbSeat,
          bbSeat: roomState.game.bbSeat,
          minBet: roomState.game.minBet,
          minRaiseDelta: roomState.game.minRaiseDelta,
          boardCards: roomState.game.boardCards
        }
      : null,
    players: roomState.players.map((player) => ({
      userId: player.userId,
      seatIndex: player.seatIndex,
      stack: player.stack,
      currentBet: player.currentBet,
      status: player.status,
      isReady: player.isReady,
      isConnected: player.isConnected
    }))
  };
}
