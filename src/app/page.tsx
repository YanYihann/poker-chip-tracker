"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { BottomActionPanel } from "@/components/actions/bottom-action-panel";
import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import type { TableSeatPlayer } from "@/components/player/types";
import { PokerTable } from "@/components/table/poker-table";
import { Badge } from "@/components/ui/badge";
import { getRoom, submitRoomAction, type RoomState } from "@/features/rooms/api";
import { getRoomSocket } from "@/features/rooms/realtime";

const STREET_LABEL_MAP: Record<AppLocale, Record<NonNullable<RoomState["game"]>["street"], string>> = {
  zh: {
    preflop: "翻牌前",
    flop: "翻牌",
    turn: "转牌",
    river: "河牌",
    showdown: "摊牌"
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
    "in-progress": "进行中",
    showdown: "摊牌"
  },
  en: {
    "in-progress": "In Progress",
    showdown: "Showdown"
  }
};

const ROOM_STATUS_LABEL_MAP: Record<AppLocale, Record<RoomState["room"]["status"], string>> = {
  zh: {
    waiting: "等待中",
    active: "进行中",
    finished: "已结束",
    cancelled: "已取消"
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
    fold: { topLabel: "弃牌", mainLabel: "弃牌" },
    check: { topLabel: "过牌", mainLabel: "过牌" },
    call: { topLabel: "跟注", mainLabel: "跟注" },
    bet: { topLabel: "下注", mainLabel: "下注" },
    raise: { topLabel: "加注", mainLabel: "加注" },
    "all-in": { topLabel: "全下", mainLabel: "全下" }
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
  const searchParams = useSearchParams();
  const roomCode = (searchParams.get("room") ?? "").toUpperCase();
  const { locale, isZh } = useLanguage();

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
          setError(
            loadError instanceof Error
              ? loadError.message
              : isZh
                ? "无法加载房间状态。"
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
      setError(payload.message ?? (isZh ? "实时同步错误。" : "Realtime error."));
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
            setError(actionError instanceof Error ? actionError.message : isZh ? "操作失败。" : "Action failed.");
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
        <AppTopBar title={isZh ? "扑克筹码账本" : "PokerChip Ledger"} />
        <section className="space-y-4 px-4 pt-4">
          <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
            <h2 className="font-headline text-2xl text-stitch-onSurface">
              {isZh ? "服务器牌桌模式" : "Server Table Mode"}
            </h2>
            <p className="mt-2 text-sm text-stitch-onSurfaceVariant">
              {isZh
                ? "当前牌桌已改为服务器权威房间与牌局状态。"
                : "This table now uses server-authoritative room and game state."}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/rooms/create"
                className="rounded-xl bg-stitch-primary px-3 py-2 text-center text-sm font-semibold text-stitch-onPrimary"
              >
                {isZh ? "创建房间" : "Create Room"}
              </Link>
              <Link
                href="/rooms/join"
                className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-center text-sm text-stitch-onSurface"
              >
                {isZh ? "加入房间" : "Join Room"}
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-stitch-background pb-44">
      <AppTopBar title={isZh ? `牌桌 ${roomCode}` : `Table ${roomCode}`} backHref={`/rooms/${roomCode}`} />

      <section className="flex-1 px-4 pb-4 pt-4">
        {loading ? (
          <article className="mb-3 rounded-2xl bg-stitch-surfaceContainer p-3 text-xs text-stitch-onSurfaceVariant">
            {isZh ? "正在加载服务器牌局状态..." : "Loading server game state..."}
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
                  {game.isMyTurn ? (isZh ? "你的回合" : "Your Turn") : isZh ? "等待中" : "Waiting"}
                </Badge>
              </div>
              <span className="text-xs text-stitch-onSurfaceVariant">
                {isZh ? "待跟注" : "To Call"}: <strong className="text-stitch-mint">{formatCurrency(game.toCall, locale)}</strong>
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
                  ? "未到你的回合。服务器将你标记为当前行动玩家后，操作栏才会显示。"
                  : "Not your turn. Action bar is hidden until server marks you as active player."}
              </article>
            ) : null}
          </>
        ) : null}

        {roomState && !game ? (
          <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            {isZh ? "房间状态为" : "Room status is"}{" "}
            <strong className="text-stitch-onSurface">{roomStatusLabels[roomState.room.status]}</strong>
            {isZh
              ? "。若牌局已结束，记录会归档到个人历史中。"
              : ". If this game has finished, the session is archived and available in profile/history."}
            <Link
              href="/history"
              className="mt-2 inline-block rounded-lg bg-stitch-primary px-3 py-1.5 text-xs font-semibold text-stitch-onPrimary"
            >
              {isZh ? "打开历史记录" : "Open Session History"}
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
            ? `提交中 ${actionCopy[pendingAction as keyof typeof actionCopy].mainLabel}...`
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