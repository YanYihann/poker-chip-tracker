ALTER TABLE "game_rooms" ADD COLUMN "matchmaking_tier" TEXT;
ALTER TABLE "hands" ADD COLUMN "next_hand_ready_user_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "game_rooms_matchmaking_tier_status_max_players_idx" ON "game_rooms"("matchmaking_tier", "status", "max_players");
