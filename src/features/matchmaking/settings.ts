export type MatchTier = "beginner" | "advanced" | "expert";
export type MatchOptions = { maxPlayers: number; tier: MatchTier };
export const DEFAULT_MATCH_OPTIONS: MatchOptions = { maxPlayers: 2, tier: "beginner" };
export const MATCH_TIER_LABELS = {
  beginner: { zh: "新手场", en: "Beginner" },
  advanced: { zh: "高手场", en: "Advanced" },
  expert: { zh: "专家场", en: "Expert" }
} as const;
