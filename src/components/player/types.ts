import type { PlayerStatus } from "@/types/domain";

export type TableSeatPlayer = {
  id: string;
  name: string;
  seatIndex?: number;
  seatCount?: number;
  avatarUrl?: string | null;
  stackLabel: string;
  betLabel?: string;
  isPlaceholder?: boolean;
  placeholderLabel?: string;
  placeholderSelected?: boolean;
  onPress?: () => void;
  revealedCards?: string[];
  resultDeltaLabel?: string | null;
  positionLabel?: string;
  isHero?: boolean;
  isActive?: boolean;
  status: PlayerStatus;
};
