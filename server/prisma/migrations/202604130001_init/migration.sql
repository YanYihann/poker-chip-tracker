-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('waiting', 'active', 'finished', 'cancelled');

-- CreateEnum
CREATE TYPE "Street" AS ENUM ('preflop', 'flop', 'turn', 'river', 'showdown');

-- CreateEnum
CREATE TYPE "PositionLabel" AS ENUM ('BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO');

-- CreateEnum
CREATE TYPE "HandRecordStatus" AS ENUM ('active', 'showdown', 'settled', 'cancelled');

-- CreateEnum
CREATE TYPE "HandActionType" AS ENUM ('fold', 'check', 'call', 'bet', 'raise', 'all_in', 'post_sb', 'post_bb', 'undo', 'edit', 'reopen_settlement');

-- CreateEnum
CREATE TYPE "HandResultType" AS ENUM ('win', 'split');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "avatar_url" TEXT,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "total_hands" INTEGER NOT NULL DEFAULT 0,
    "total_profit" BIGINT NOT NULL DEFAULT 0,
    "total_loss" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_rooms" (
    "id" UUID NOT NULL,
    "room_code" TEXT NOT NULL,
    "host_user_id" UUID NOT NULL,
    "status" "RoomStatus" NOT NULL,
    "max_players" INTEGER NOT NULL,
    "starting_stack" BIGINT NOT NULL,
    "small_blind" BIGINT NOT NULL,
    "big_blind" BIGINT NOT NULL,
    "allow_join_after_start" BOOLEAN NOT NULL DEFAULT false,
    "lock_on_start" BOOLEAN NOT NULL DEFAULT true,
    "current_hand_number" INTEGER NOT NULL DEFAULT 0,
    "current_street" "Street",
    "dealer_seat" INTEGER,
    "active_seat" INTEGER,
    "pot_total" BIGINT NOT NULL DEFAULT 0,
    "side_pot_total" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "game_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_players" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "seat_index" INTEGER,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "is_ready" BOOLEAN NOT NULL DEFAULT false,
    "is_connected" BOOLEAN NOT NULL DEFAULT true,
    "stack" BIGINT NOT NULL DEFAULT 0,
    "current_bet" BIGINT NOT NULL DEFAULT 0,
    "total_buy_in" BIGINT NOT NULL DEFAULT 0,
    "has_folded" BOOLEAN NOT NULL DEFAULT false,
    "is_all_in" BOOLEAN NOT NULL DEFAULT false,
    "is_eliminated" BOOLEAN NOT NULL DEFAULT false,
    "position_label" "PositionLabel",
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),

    CONSTRAINT "room_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hands" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "hand_number" INTEGER NOT NULL,
    "status" "HandRecordStatus" NOT NULL,
    "street" "Street" NOT NULL,
    "dealer_seat" INTEGER NOT NULL,
    "sb_seat" INTEGER NOT NULL,
    "bb_seat" INTEGER NOT NULL,
    "active_seat" INTEGER,
    "pot_total" BIGINT NOT NULL DEFAULT 0,
    "side_pot_total" BIGINT NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMPTZ(6),

    CONSTRAINT "hands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hand_actions" (
    "id" UUID NOT NULL,
    "hand_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seat_index" INTEGER NOT NULL,
    "street" "Street" NOT NULL,
    "action_type" "HandActionType" NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "action_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hand_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hand_results" (
    "id" UUID NOT NULL,
    "hand_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "result_type" "HandResultType" NOT NULL,
    "amount_won" BIGINT NOT NULL DEFAULT 0,
    "net_change" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hand_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "host_user_id" UUID NOT NULL,
    "total_hands" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_session_stats" (
    "id" UUID NOT NULL,
    "game_session_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "start_stack" BIGINT NOT NULL,
    "end_stack" BIGINT NOT NULL,
    "profit_loss" BIGINT NOT NULL,
    "hands_played" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_session_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "game_rooms_room_code_key" ON "game_rooms"("room_code");

-- CreateIndex
CREATE INDEX "game_rooms_host_user_id_status_idx" ON "game_rooms"("host_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "room_players_room_id_user_id_key" ON "room_players"("room_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_players_room_id_seat_index_key" ON "room_players"("room_id", "seat_index");

-- CreateIndex
CREATE UNIQUE INDEX "hands_room_id_hand_number_key" ON "hands"("room_id", "hand_number");

-- CreateIndex
CREATE UNIQUE INDEX "hand_actions_hand_id_action_order_key" ON "hand_actions"("hand_id", "action_order");

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_room_id_key" ON "game_sessions"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_session_stats_game_session_id_user_id_key" ON "player_session_stats"("game_session_id", "user_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_rooms" ADD CONSTRAINT "game_rooms_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "game_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hands" ADD CONSTRAINT "hands_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "game_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_actions" ADD CONSTRAINT "hand_actions_hand_id_fkey" FOREIGN KEY ("hand_id") REFERENCES "hands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_actions" ADD CONSTRAINT "hand_actions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "game_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_actions" ADD CONSTRAINT "hand_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_results" ADD CONSTRAINT "hand_results_hand_id_fkey" FOREIGN KEY ("hand_id") REFERENCES "hands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_results" ADD CONSTRAINT "hand_results_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "game_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_results" ADD CONSTRAINT "hand_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "game_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_session_stats" ADD CONSTRAINT "player_session_stats_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_session_stats" ADD CONSTRAINT "player_session_stats_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "game_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_session_stats" ADD CONSTRAINT "player_session_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
