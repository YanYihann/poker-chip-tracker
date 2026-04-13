import type { PlayerStatus } from "@/types/domain";

export type TableSeatPlayer = {
  id: string;
  name: string;
  stackLabel: string;
  positionLabel?: string;
  isHero?: boolean;
  isActive?: boolean;
  status: PlayerStatus;
};
