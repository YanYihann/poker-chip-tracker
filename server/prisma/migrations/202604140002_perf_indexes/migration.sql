CREATE INDEX IF NOT EXISTS "room_players_room_id_left_at_seat_index_idx"
ON "room_players"("room_id", "left_at", "seat_index");

CREATE INDEX IF NOT EXISTS "hand_actions_hand_id_street_seat_index_idx"
ON "hand_actions"("hand_id", "street", "seat_index");

CREATE INDEX IF NOT EXISTS "hand_actions_room_id_user_id_hand_id_idx"
ON "hand_actions"("room_id", "user_id", "hand_id");
