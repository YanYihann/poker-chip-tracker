CREATE TABLE "matchmaking_tickets" (
    "user_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "room_id" UUID,
    "matched_at" TIMESTAMPTZ(6),
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "matchmaking_tickets_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "matchmaking_tickets_id_key" ON "matchmaking_tickets"("id");
CREATE INDEX "matchmaking_tickets_room_id_expires_at_idx" ON "matchmaking_tickets"("room_id", "expires_at");
ALTER TABLE "matchmaking_tickets" ADD CONSTRAINT "matchmaking_tickets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "matchmaking_tickets" ADD CONSTRAINT "matchmaking_tickets_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "game_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
