export type PlayerId = string;
export type SessionId = string;

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export type HandStatus = "in-progress" | "pre-settlement" | "settlement-confirmed";

export type PlayerStatus = "waiting" | "acting" | "folded" | "all-in" | "winner";

export type Position =
  | "BTN"
  | "SB"
  | "BB"
  | "UTG"
  | "UTG+1"
  | "MP"
  | "LJ"
  | "HJ"
  | "CO";

export type TableActionType =
  | "fold"
  | "check"
  | "bet"
  | "call"
  | "raise"
  | "all-in"
  | "quick-win"
  | "quick-split"
  | "settle-pot"
  | "undo-last-action"
  | "edit-hand"
  | "reopen-settlement"
  | "end-hand";

export type ReversibleTableActionType =
  | "fold"
  | "check"
  | "bet"
  | "call"
  | "raise"
  | "all-in"
  | "end-hand";

export type Player = {
  id: PlayerId;
  name: string;
  avatar?: string;
  seatIndex: number;
  stack: number;
  currentBet: number;
  totalInvestedThisHand: number;
  status: PlayerStatus;
  position?: Position;
  isHero?: boolean;
};

export type SessionSlice = {
  sessionId: SessionId;
  sessionName: string;
  startedAtIso: string;
  dealerSeatIndex: number;
  players: Player[];
};

export type HandSlice = {
  street: Street;
  status: HandStatus;
  actingPlayerId: PlayerId | null;
  actionOrder: PlayerId[];
  actionIndex: number;
  lastActionType?: TableActionType;
  actionCount: number;
};

export type BettingSlice = {
  pot: number;
  currentBet: number;
  minBet: number;
  minRaiseDelta: number;
  lastAggressiveAmount: number;
};

export type SettlementSlice = {
  isDialogOpen: boolean;
  revision: number;
  notes: string;
};

export type TableSnapshot = {
  session: SessionSlice;
  hand: HandSlice;
  betting: BettingSlice;
  settlement: SettlementSlice;
};

export type HandAuditEntry = {
  id: string;
  action: TableActionType;
  beforeStreet: Street;
  afterStreet: Street;
  note: string;
  createdAtIso: string;
};

export type AvailablePlayerAction = "fold" | "check" | "call" | "bet" | "raise" | "all-in";

export type TableMotionKind = "chip-to-pot" | "pot-to-winner";

export type TableMotionEvent = {
  id: string;
  kind: TableMotionKind;
  sourcePlayerId?: string;
  targetPlayerId?: string;
  amount: number;
  delayMs?: number;
  createdAt: number;
};

export type ArchivedSessionRecord = {
  id: string;
  sessionName: string;
  endedAtIso: string;
  playerCount: number;
  totalPot: number;
  winners: Array<{ playerId: string; name: string; amount: number }>;
  note?: string;
};

export type PersistedLiveSession = {
  version: 1;
  savedAtIso: string;
  snapshot: TableSnapshot;
};
