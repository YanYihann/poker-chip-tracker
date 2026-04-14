ALTER TABLE "hands"
ADD COLUMN "deck_shuffled" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "board_cards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "hole_cards_by_user" JSONB;

