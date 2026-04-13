"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { BottomActionPanel } from "@/components/actions/bottom-action-panel";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { PokerTable } from "@/components/table/poker-table";
import { Badge } from "@/components/ui/badge";
import { getRoom, submitRoomAction, type RoomState } from "@/features/rooms/api";
import { getRoomSocket } from "@/features/rooms/realtime";
import type { TableSeatPlayer } from "@/components/player/types";

const STREET_LABEL_MAP: Record<NonNullable<RoomState["game"]>["street"], string> = {
  preflop: "Pre-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown"
};

const STATUS_LABEL_MAP: Record<NonNullable<RoomState["game"]>["status"], string> = {
  "in-progress": "In Progress",
  showdown: "Showdown"
};

const ACTION_COPY: Record<
  "fold" | "check" | "call" | "bet" | "raise" | "all-in",
  { topLabel: string; mainLabel: string }
> = {
  fold: { topLabel: "Fold", mainLabel: "弃牌" },
  check: { topLabel: "Check", mainLabel: "过牌" },
  call: { topLabel: "Call", mainLabel: "跟注" },
  bet: { topLabel: "Bet", mainLabel: "下注" },
  raise: { topLabel: "Raise", mainLabel: "加注" },
  "all-in": { topLabel: "All-in", mainLabel: "全下" }
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

export default function HomePage() {
  const searchParams = useSearchParams();
  const roomCode = (searchParams.get("room") ?? "").toUpperCase();

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) {
      setLoading(false);
      setRoomState(null);
      return;
    }

    let active = true;
    const socket = getRoomSocket();

    const loadRoom = async () => {
      setLoading(true);
      setError(null);
      try {
        const state = await getRoom(roomCode);
        if (active) {
          setRoomState(state);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load room state.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const onRoomState = (nextState: RoomState) => {
      if (!active || nextState.room.code !== roomCode) {
        return;
      }
      setRoomState(nextState);
    };

    const onRoomError = (payload: { message?: string }) => {
      if (!active) {
        return;
      }
      setError(payload.message ?? "Realtime error.");
    };

    void loadRoom();
    socket.on("room:state", onRoomState);
    socket.on("room:error", onRoomError);
    socket.emit("room:subscribe", { roomCode });

    return () => {
      active = false;
      socket.emit("room:unsubscribe", { roomCode });
      socket.off("room:state", onRoomState);
      socket.off("room:error", onRoomError);
    };
  }, [roomCode]);

  const game = roomState?.game ?? null;

  const tablePlayers = useMemo<TableSeatPlayer[]>(() => {
    if (!roomState) {
      return [];
    }

    const ordered = [...roomState.players].sort((a, b) => {
      const aSeat = a.seatIndex ?? 999;
      const bSeat = b.seatIndex ?? 999;
      return aSeat - bSeat;
    });

    return ordered.map((player) => ({
      id: player.userId,
      name: player.displayName,
      stackLabel: formatCurrency(player.stack),
      positionLabel: player.seatIndex !== null ? `S${player.seatIndex + 1}` : undefined,
      isHero: roomState.me?.userId === player.userId,
      isActive: game?.activePlayerUserId === player.userId,
      status: player.status
    }));
  }, [roomState, game?.activePlayerUserId]);

  const mainActions = useMemo(
    () =>
      (game?.legalActions ?? []).map((actionType) => ({
        id: actionType,
        topLabel: ACTION_COPY[actionType].topLabel,
        mainLabel: ACTION_COPY[actionType].mainLabel,
        onPress: async () => {
          if (!roomCode || pendingAction) {
            return;
          }

          setPendingAction(actionType);
          setError(null);
          try {
            const next = await submitRoomAction(roomCode, actionType);
            setRoomState(next);
          } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : "Action failed.");
          } finally {
            setPendingAction(null);
          }
        }
      })),
    [game?.legalActions, pendingAction, roomCode]
  );

  if (!roomCode) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
        <AppTopBar title="PokerChip Ledger" />
        <section className="space-y-4 px-4 pt-4">
          <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
            <h2 className="font-headline text-2xl text-stitch-onSurface">Server Table Mode</h2>
            <p className="mt-2 text-sm text-stitch-onSurfaceVariant">
              This table now uses server-authoritative room and game state.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/rooms/create"
                className="rounded-xl bg-stitch-primary px-3 py-2 text-center text-sm font-semibold text-stitch-onPrimary"
              >
                Create Room
              </Link>
              <Link
                href="/rooms/join"
                className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-center text-sm text-stitch-onSurface"
              >
                Join Room
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-stitch-background pb-44">
      <AppTopBar title={`Table ${roomCode}`} backHref={`/rooms/${roomCode}`} />

      <section className="flex-1 px-4 pb-4 pt-4">
        {loading ? (
          <article className="mb-3 rounded-2xl bg-stitch-surfaceContainer p-3 text-xs text-stitch-onSurfaceVariant">
            Loading server game state...
          </article>
        ) : null}

        {error ? (
          <article className="mb-3 rounded-2xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 p-3 text-xs text-stitch-tertiary">
            {error}
          </article>
        ) : null}

        {roomState && game ? (
          <>
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainerHigh px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="primary">{STREET_LABEL_MAP[game.street]}</Badge>
                <Badge variant="mint">{STATUS_LABEL_MAP[game.status]}</Badge>
                <Badge variant={game.isMyTurn ? "mint" : "neutral"}>
                  {game.isMyTurn ? "Your Turn" : "Waiting"}
                </Badge>
              </div>
              <span className="text-xs text-stitch-onSurfaceVariant">
                To Call: <strong className="text-stitch-mint">{formatCurrency(game.toCall)}</strong>
              </span>
            </div>

            <PokerTable
              players={tablePlayers}
              potLabel={formatCurrency(game.potTotal)}
              streetLabel={STREET_LABEL_MAP[game.street]}
              statusLabel={STATUS_LABEL_MAP[game.status]}
            />

            {!game.isMyTurn ? (
              <article className="mt-3 rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant">
                Not your turn. Action bar is hidden until server marks you as active player.
              </article>
            ) : null}
          </>
        ) : null}

        {roomState && !game ? (
          <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            Room status is <strong className="text-stitch-onSurface">{roomState.room.status}</strong>. If this game has
            finished, the session is archived and available in profile/history.
            <Link
              href="/history"
              className="mt-2 inline-block rounded-lg bg-stitch-primary px-3 py-1.5 text-xs font-semibold text-stitch-onPrimary"
            >
              Open Session History
            </Link>
          </article>
        ) : null}
      </section>

      {roomState?.game?.isMyTurn ? (
        <BottomActionPanel
          mainActions={mainActions}
          utilityActions={[]}
          canOpenSettlement={false}
          onOpenSettlement={() => undefined}
        />
      ) : null}

      {pendingAction ? (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-stitch-surfaceContainerHigh px-3 py-1 text-xs text-stitch-onSurfaceVariant">
          Submitting {pendingAction}...
        </div>
      ) : null}
    </main>
  );
}
