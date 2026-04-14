import type { PlayerStatus } from "@/types/domain";

export type TableSeatPlayer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  stackLabel: string;
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
