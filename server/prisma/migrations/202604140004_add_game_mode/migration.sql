ALTER TABLE "game_rooms"
ADD COLUMN "game_mode" TEXT NOT NULL DEFAULT 'online';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'game_rooms_game_mode_check'
  ) THEN
    ALTER TABLE "game_rooms"
      ADD CONSTRAINT "game_rooms_game_mode_check"
      CHECK ("game_mode" IN ('local', 'online'));
  END IF;
END $$;

