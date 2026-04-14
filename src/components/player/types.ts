import type { PlayerStatus } from "@/types/domain";

export type TableSeatPlayer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  stackLabel: string;
  positionLabel?: string;
  isHero?: boolean;
  isActive?: boolean;
  status: PlayerStatus;
};
