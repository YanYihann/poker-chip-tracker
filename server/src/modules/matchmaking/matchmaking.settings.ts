import { z } from "zod";

export const MATCH_TIERS = {
  beginner: { startingStack: 10000, smallBlind: 100, bigBlind: 200 },
  advanced: { startingStack: 50000, smallBlind: 500, bigBlind: 1000 },
  expert: { startingStack: 100000, smallBlind: 1000, bigBlind: 2000 }
} as const;
export const matchOptionsSchema = z.object({
  maxPlayers: z.number().int().min(2).max(8).default(2),
  tier: z.enum(["beginner", "advanced", "expert"]).default("beginner")
});
export type MatchOptions = z.infer<typeof matchOptionsSchema>;
