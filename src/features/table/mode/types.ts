import type { ReactNode } from "react";

import type { TableSeatPlayer } from "@/components/player/types";
import type { HandStatus, PlayerStatus, Street } from "@/types/domain";

export type TableBannerTone = "info" | "warning";

export type TableBannerModel = {
  tone: TableBannerTone;
  message: string;
};

export type TableModeMainAction = {
  id: string;
  topLabel: string;
  mainLabel: string;
  onPress: () => void;
};

export type TableModeUtilityAction = {
  id: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export type TableModeAmountControl = {
  value: string;
  onValueChange: (next: string) => void;
  onStep: (delta: number) => void;
  helperText?: string;
};

export type TableModeSettlementPlayer = {
  id: string;
  name: string;
  stackLabel: string;
  status: PlayerStatus;
};

export type TableModeSettlementModel = {
  isOpen: boolean;
  players: TableModeSettlementPlayer[];
  canUndo: boolean;
  canReopen: boolean;
  onClose: () => void;
  onQuickWin: (winnerId: string) => void;
  onQuickSplit: (winnerIds: string[]) => void;
  onUndo: () => void;
  onEditHand: () => void;
  onReopenSettlement: () => void;
};

export type TableModeResumeModel = {
  available: boolean;
  savedAtIso: string | null;
  onResume: () => void;
  onDiscard: () => void;
};

export type TableModeAdapter = {
  mode: "local" | "online";
  title: string;
  backHref?: string;
  playerCount?: number;
  onPlayerCountChange?: (nextCount: number) => void;
  players: TableSeatPlayer[];
  potLabel: string;
  boardCards?: string[] | null;
  street: Street;
  streetLabel: string;
  statusLabel: string;
  handKey: string;
  status: HandStatus;
  actingPlayerId: string | null;
  mainActions: TableModeMainAction[];
  utilityActions: TableModeUtilityAction[];
  canOpenSettlement: boolean;
  onOpenSettlement: () => void;
  amountControl?: TableModeAmountControl | null;
  settlement?: TableModeSettlementModel | null;
  resume?: TableModeResumeModel;
  banner?: TableBannerModel | null;
  statusHint?: string | null;
  mainContent?: ReactNode;
  supplementaryContent?: ReactNode;
  showActionPanel?: boolean;
};
