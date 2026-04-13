# Database Schema Draft

## Overview
This app supports:
- user accounts
- profiles
- room creation and join by room code
- waiting room
- active multiplayer poker game state
- hand-by-hand actions
- completed session history per user

## Tables

### users
Application-level auth users.

Fields:
- id UUID primary key
- email text unique not null
- password_hash text not null
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

### profiles
Public profile data for a user.

Fields:
- user_id UUID primary key references users(id) on delete cascade
- username text unique not null
- avatar_url text null
- total_sessions integer not null default 0
- total_hands integer not null default 0
- total_profit bigint not null default 0
- total_loss bigint not null default 0
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

### refresh_tokens
Optional if using refresh-token based auth.

Fields:
- id UUID primary key
- user_id UUID not null references users(id) on delete cascade
- token_hash text not null
- expires_at timestamptz not null
- created_at timestamptz not null default now()
- revoked_at timestamptz null

### game_rooms
A room/lobby and its top-level game state.

Fields:
- id UUID primary key
- room_code text unique not null
- host_user_id UUID not null references users(id)
- status text not null check (status in ('waiting','active','finished','cancelled'))
- max_players integer not null
- starting_stack bigint not null
- small_blind bigint not null
- big_blind bigint not null
- allow_join_after_start boolean not null default false
- lock_on_start boolean not null default true
- current_hand_number integer not null default 0
- current_street text null check (current_street in ('preflop','flop','turn','river','showdown'))
- dealer_seat integer null
- active_seat integer null
- pot_total bigint not null default 0
- side_pot_total bigint not null default 0
- created_at timestamptz not null default now()
- started_at timestamptz null
- finished_at timestamptz null

Indexes:
- unique(room_code)
- index(host_user_id, status)

### room_players
Membership plus per-room player state.

Fields:
- id UUID primary key
- room_id UUID not null references game_rooms(id) on delete cascade
- user_id UUID not null references users(id) on delete cascade
- display_name text not null
- seat_index integer null
- is_host boolean not null default false
- is_ready boolean not null default false
- is_connected boolean not null default true
- stack bigint not null default 0
- current_bet bigint not null default 0
- total_buy_in bigint not null default 0
- has_folded boolean not null default false
- is_all_in boolean not null default false
- is_eliminated boolean not null default false
- position_label text null check (position_label in ('BTN','SB','BB','UTG','MP','HJ','CO'))
- joined_at timestamptz not null default now()
- left_at timestamptz null

Constraints:
- unique(room_id, user_id)
- unique(room_id, seat_index) where seat_index is not null

### hands
One record per hand.

Fields:
- id UUID primary key
- room_id UUID not null references game_rooms(id) on delete cascade
- hand_number integer not null
- status text not null check (status in ('active','showdown','settled','cancelled'))
- street text not null check (street in ('preflop','flop','turn','river','showdown'))
- dealer_seat integer not null
- sb_seat integer not null
- bb_seat integer not null
- active_seat integer null
- pot_total bigint not null default 0
- side_pot_total bigint not null default 0
- started_at timestamptz not null default now()
- settled_at timestamptz null

Constraints:
- unique(room_id, hand_number)

### hand_actions
Every action in order for replay/history.

Fields:
- id UUID primary key
- hand_id UUID not null references hands(id) on delete cascade
- room_id UUID not null references game_rooms(id) on delete cascade
- user_id UUID not null references users(id)
- seat_index integer not null
- street text not null check (street in ('preflop','flop','turn','river','showdown'))
- action_type text not null check (action_type in ('fold','check','call','bet','raise','all_in','post_sb','post_bb','undo','edit','reopen_settlement'))
- amount bigint not null default 0
- action_order integer not null
- created_at timestamptz not null default now()

Constraints:
- unique(hand_id, action_order)

### hand_results
Settlement result for a hand.

Fields:
- id UUID primary key
- hand_id UUID not null references hands(id) on delete cascade
- room_id UUID not null references game_rooms(id) on delete cascade
- user_id UUID not null references users(id)
- result_type text not null check (result_type in ('win','split'))
- amount_won bigint not null default 0
- net_change bigint not null default 0
- created_at timestamptz not null default now()

### game_sessions
Archived completed room/game summary.

Fields:
- id UUID primary key
- room_id UUID not null unique references game_rooms(id) on delete cascade
- host_user_id UUID not null references users(id)
- total_hands integer not null default 0
- started_at timestamptz not null
- finished_at timestamptz not null
- created_at timestamptz not null default now()

### player_session_stats
Per-user session summary shown on profile/history.

Fields:
- id UUID primary key
- game_session_id UUID not null references game_sessions(id) on delete cascade
- room_id UUID not null references game_rooms(id) on delete cascade
- user_id UUID not null references users(id) on delete cascade
- start_stack bigint not null
- end_stack bigint not null
- profit_loss bigint not null
- hands_played integer not null default 0
- created_at timestamptz not null default now()

Constraints:
- unique(game_session_id, user_id)

## Notes for implementation
- The backend is server-authoritative.
- The frontend should never directly mutate final room or hand state without a server response.
- Realtime events should broadcast room updates, player readiness changes, active turn changes, hand stage changes, bet updates, settlement updates, and room completion.
- If the app uses Prisma, map these tables into Prisma models closely.