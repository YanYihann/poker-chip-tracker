"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { BottomActionPanel } from "@/components/actions/bottom-action-panel";
import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import type { TableSeatPlayer } from "@/components/player/types";
import { PokerTable } from "@/components/table/poker-table";
import { Badge } from "@/components/ui/badge";
import { fetchCurrentUser } from "@/features/auth/api";
import { getRoom, submitRoomAction, type RoomState } from "@/features/rooms/api";
import { getRoomSocket } from "@/features/rooms/realtime";

const STREET_LABEL_MAP: Record<AppLocale, Record<NonNullable<RoomState["game"]>["street"], string>> = {
  zh: {
    preflop: "\u7ffb\u724c\u524d",
    flop: "\u7ffb\u724c",
    turn: "\u8f6c\u724c",
    river: "\u6cb3\u724c",
    showdown: "\u644a\u724c"
  },
  en: {
    preflop: "Pre-flop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown"
  }
};

const STATUS_LABEL_MAP: Record<AppLocale, Record<NonNullable<RoomState["game"]>["status"], string>> = {
  zh: {
    "in-progress": "\u8fdb\u884c\u4e2d",
    showdown: "\u644a\u724c"
  },
  en: {
    "in-progress": "In Progress",
    showdown: "Showdown"
  }
};

const ROOM_STATUS_LABEL_MAP: Record<AppLocale, Record<RoomState["room"]["status"], string>> = {
  zh: {
    waiting: "\u7b49\u5f85\u4e2d",
    active: "\u8fdb\u884c\u4e2d",
    finished: "\u5df2\u7ed3\u675f",
    cancelled: "\u5df2\u53d6\u6d88"
  },
  en: {
    waiting: "Waiting",
    active: "Active",
    finished: "Finished",
    cancelled: "Cancelled"
  }
};

const ACTION_COPY: Record<
  AppLocale,
  Record<
    "fold" | "check" | "call" | "bet" | "raise" | "all-in",
    { topLabel: string; mainLabel: string }
  >
> = {
  zh: {
    fold: { topLabel: "\u5f03\u724c", mainLabel: "\u5f03\u724c" },
    check: { topLabel: "\u8fc7\u724c", mainLabel: "\u8fc7\u724c" },
    call: { topLabel: "\u8ddf\u6ce8", mainLabel: "\u8ddf\u6ce8" },
    bet: { topLabel: "\u4e0b\u6ce8", mainLabel: "\u4e0b\u6ce8" },
    raise: { topLabel: "\u52a0\u6ce8", mainLabel: "\u52a0\u6ce8" },
    "all-in": { topLabel: "\u5168\u4e0b", mainLabel: "\u5168\u4e0b" }
  },
  en: {
    fold: { topLabel: "Fold", mainLabel: "Fold" },
    check: { topLabel: "Check", mainLabel: "Check" },
    call: { topLabel: "Call", mainLabel: "Call" },
    bet: { topLabel: "Bet", mainLabel: "Bet" },
    raise: { topLabel: "Raise", mainLabel: "Raise" },
    "all-in": { topLabel: "All-in", mainLabel: "All-in" }
  }
};

function formatCurrency(amount: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCode = (searchParams.get("room") ?? "").toUpperCase();
  const { locale, isZh } = useLanguage();

  const [entryResolving, setEntryResolving] = useState(true);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roomCode) {
      setEntryResolving(false);
      return;
    }

    let active = true;

    const resolveEntry = async () => {
      try {
        await fetchCurrentUser();
        if (active) {
          router.replace("/rooms/join");
        }
      } catch {
        if (active) {
          router.replace("/auth?next=/rooms/join");
        }
      } finally {
        if (active) {
          setEntryResolving(false);
        }
      }
    };

    void resolveEntry();

    return () => {
      active = false;
    };
  }, [roomCode, router]);

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
          setError(
            loadError instanceof Error
              ? loadError.message
              : isZh
                ? "\u65e0\u6cd5\u52a0\u8f7d\u623f\u95f4\u72b6\u6001\u3002"
                : "Unable to load room state."
          );
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
      setError(payload.message ?? (isZh ? "\u5b9e\u65f6\u540c\u6b65\u9519\u8bef\u3002" : "Realtime error."));
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
  }, [isZh, roomCode]);

  const game = roomState?.game ?? null;
  const streetLabels = STREET_LABEL_MAP[locale];
  const statusLabels = STATUS_LABEL_MAP[locale];
  const roomStatusLabels = ROOM_STATUS_LABEL_MAP[locale];
  const actionCopy = ACTION_COPY[locale];

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
      stackLabel: formatCurrency(player.stack, locale),
      positionLabel: player.seatIndex !== null ? `S${player.seatIndex + 1}` : undefined,
      isHero: roomState.me?.userId === player.userId,
      isActive: game?.activePlayerUserId === player.userId,
      status: player.status
    }));
  }, [game?.activePlayerUserId, locale, roomState]);

  const mainActions = useMemo(
    () =>
      (game?.legalActions ?? []).map((actionType) => ({
        id: actionType,
        topLabel: actionCopy[actionType].topLabel,
        mainLabel: actionCopy[actionType].mainLabel,
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
            setError(actionError instanceof Error ? actionError.message : isZh ? "\u64cd\u4f5c\u5931\u8d25\u3002" : "Action failed.");
          } finally {
            setPendingAction(null);
          }
        }
      })),
    [actionCopy, game?.legalActions, isZh, pendingAction, roomCode]
  );

  if (!roomCode) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
        <AppTopBar title={isZh ? "\u6251\u514b\u7b79\u7801\u8d26\u672c" : "PokerChip Ledger"} />
        <section className="px-4 pt-4">
          <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5 text-center">
            <h2 className="font-headline text-2xl text-stitch-onSurface">
              {isZh ? "\u6b63\u5728\u8df3\u8f6c..." : "Redirecting..."}
            </h2>
            <p className="mt-2 text-sm text-stitch-onSurfaceVariant">
              {entryResolving
                ? isZh
                  ? "\u6b63\u5728\u68c0\u67e5\u767b\u5f55\u72b6\u6001\u3002"
                  : "Checking your sign-in status."
                : isZh
                  ? "\u5373\u5c06\u8fdb\u5165\u76ee\u6807\u9875\u9762\u3002"
                  : "Taking you to the right page."}
            </p>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-stitch-background pb-44">
      <AppTopBar title={isZh ? `\u724c\u684c ${roomCode}` : `Table ${roomCode}`} backHref={`/rooms/${roomCode}`} />

      <section className="flex-1 px-4 pb-4 pt-4">
        {loading ? (
          <article className="mb-3 rounded-2xl bg-stitch-surfaceContainer p-3 text-xs text-stitch-onSurfaceVariant">
            {isZh ? "\u6b63\u5728\u52a0\u8f7d\u670d\u52a1\u5668\u724c\u5c40\u72b6\u6001..." : "Loading server game state..."}
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
                <Badge variant="primary">{streetLabels[game.street]}</Badge>
                <Badge variant="mint">{statusLabels[game.status]}</Badge>
                <Badge variant={game.isMyTurn ? "mint" : "neutral"}>
                  {game.isMyTurn ? (isZh ? "\u4f60\u7684\u56de\u5408" : "Your Turn") : isZh ? "\u7b49\u5f85\u4e2d" : "Waiting"}
                </Badge>
              </div>
              <span className="text-xs text-stitch-onSurfaceVariant">
                {isZh ? "\u5f85\u8ddf\u6ce8" : "To Call"}: <strong className="text-stitch-mint">{formatCurrency(game.toCall, locale)}</strong>
              </span>
            </div>

            <PokerTable
              players={tablePlayers}
              potLabel={formatCurrency(game.potTotal, locale)}
              streetLabel={streetLabels[game.street]}
              statusLabel={statusLabels[game.status]}
            />

            {!game.isMyTurn ? (
              <article className="mt-3 rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant">
                {isZh
                  ? "\u672a\u5230\u4f60\u7684\u56de\u5408\u3002\u670d\u52a1\u5668\u5c06\u4f60\u6807\u8bb0\u4e3a\u5f53\u524d\u884c\u52a8\u73a9\u5bb6\u540e\uff0c\u64cd\u4f5c\u680f\u624d\u4f1a\u663e\u793a\u3002"
                  : "Not your turn. Action bar is hidden until server marks you as active player."}
              </article>
            ) : null}
          </>
        ) : null}

        {roomState && !game ? (
          <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            {isZh ? "\u623f\u95f4\u72b6\u6001\u4e3a" : "Room status is"}{" "}
            <strong className="text-stitch-onSurface">{roomStatusLabels[roomState.room.status]}</strong>
            {isZh
              ? "\u3002\u82e5\u724c\u5c40\u5df2\u7ed3\u675f\uff0c\u8bb0\u5f55\u4f1a\u5f52\u6863\u5230\u4e2a\u4eba\u5386\u53f2\u4e2d\u3002"
              : ". If this game has finished, the session is archived and available in profile/history."}
            <Link
              href="/history"
              className="mt-2 inline-block rounded-lg bg-stitch-primary px-3 py-1.5 text-xs font-semibold text-stitch-onPrimary"
            >
              {isZh ? "\u6253\u5f00\u5386\u53f2\u8bb0\u5f55" : "Open Session History"}
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
          {isZh
            ? `\u63d0\u4ea4\u4e2d ${actionCopy[pendingAction as keyof typeof actionCopy].mainLabel}...`
            : `Submitting ${actionCopy[pendingAction as keyof typeof actionCopy].mainLabel}...`}
        </div>
      ) : null}
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8" />}>
      <HomePageContent />
    </Suspense>
  );
}
