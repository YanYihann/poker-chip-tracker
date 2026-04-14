"use client";

import { useEffect, useMemo, useState } from "react";

import type { TableSeatPlayer } from "@/components/player/types";
import { OnlineTablePlaceholders } from "@/components/table/online-table-placeholders";
import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import { getRoom, submitRoomAction, type RoomState } from "@/features/rooms/api";
import { getRoomSocket } from "@/features/rooms/realtime";
import type { TableModeAdapter } from "@/features/table/mode/types";
import { buildPlaceholderPlayers } from "@/lib/table-layout";

type OnlineActionType = NonNullable<RoomState["game"]>["legalActions"][number];
type OnlineGameStatus = NonNullable<RoomState["game"]>["status"];
type OnlineStreet = NonNullable<RoomState["game"]>["street"];

const STREET_LABELS: Record<AppLocale, Record<OnlineStreet, string>> = {
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

const STATUS_LABELS: Record<AppLocale, Record<OnlineGameStatus, string>> = {
  zh: {
    "in-progress": "进行中",
    showdown: "待结算",
    settled: "已结算"
  },
  en: {
    "in-progress": "In Progress",
    showdown: "Awaiting Settlement",
    settled: "Settled"
  }
};

const ACTION_COPY: Record<
  AppLocale,
  Record<OnlineActionType, { topLabel: string; mainLabel: string }>
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
  const formatted = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 0
  }).format(Math.abs(amount));

  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function toTableStatus(game: RoomState["game"]): TableModeAdapter["status"] {
  if (!game) {
    return "in-progress";
  }

  if (game.status === "in-progress") {
    return "in-progress";
  }

  if (game.status === "showdown") {
    return "pre-settlement";
  }

  return "settlement-confirmed";
}

function toSeatPlayers(roomState: RoomState | null, locale: AppLocale, isZh: boolean): TableSeatPlayer[] {
  if (!roomState) {
    return buildPlaceholderPlayers(6).map((player) => ({
      ...player,
      isActive: false,
      status: "waiting"
    }));
  }

  const orderedPlayers = [...roomState.players].sort((a, b) => {
    const aSeat = a.seatIndex ?? Number.MAX_SAFE_INTEGER;
    const bSeat = b.seatIndex ?? Number.MAX_SAFE_INTEGER;
    return aSeat - bSeat;
  });

  return orderedPlayers.map((player) => {
    const stackLabel = formatCurrency(player.stack, locale);
    const currentBetLabel =
      player.currentBet > 0
        ? `${isZh ? "注额" : "Bet"} ${formatCurrency(player.currentBet, locale)}`
        : null;

    return {
      id: player.userId,
      name: player.displayName,
      avatarUrl: player.avatarUrl,
      stackLabel: currentBetLabel ? `${stackLabel} · ${currentBetLabel}` : stackLabel,
      positionLabel: player.positionLabel ?? (player.seatIndex !== null ? `S${player.seatIndex + 1}` : undefined),
      isHero: roomState.me?.userId === player.userId,
      isActive: roomState.game?.activePlayerUserId === player.userId,
      status: player.status
    } satisfies TableSeatPlayer;
  });
}

export function useOnlineRoomTableModeAdapter(roomCode: string): TableModeAdapter {
  const { locale, isZh } = useLanguage();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(Boolean(roomCode));
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const [actionAmountInput, setActionAmountInput] = useState("");

  const game = roomState?.game ?? null;
  const actionCopy = ACTION_COPY[locale];

  useEffect(() => {
    if (!roomCode) {
      setLoading(false);
      setRoomState(null);
      setError(null);
      return;
    }

    let active = true;
    const socket = getRoomSocket();

    const loadRoom = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextRoom = await getRoom(roomCode);
        if (active) {
          setRoomState(nextRoom);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isZh
                ? "无法加载在线牌桌状态。"
                : "Unable to load online table state."
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

      setError(payload.message ?? (isZh ? "实时同步异常。" : "Realtime synchronization error."));
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

  useEffect(() => {
    if (!game || game.status !== "in-progress") {
      return;
    }

    const defaultAmount =
      game.legalActions.includes("raise") && game.currentBet > 0
        ? game.currentBet + game.minRaiseDelta
        : game.minBet;

    setActionAmountInput(String(defaultAmount));
  }, [game?.currentBet, game?.handId, game?.legalActions, game?.minBet, game?.minRaiseDelta, game?.status]);

  const tablePlayers = useMemo(() => toSeatPlayers(roomState, locale, isZh), [isZh, locale, roomState]);

  const legalActions = useMemo<OnlineActionType[]>(
    () => (game?.isMyTurn && game.status === "in-progress" ? game.legalActions : []),
    [game]
  );

  const mainActions = useMemo(
    () =>
      legalActions.map((actionType) => ({
        id: actionType,
        topLabel: actionCopy[actionType].topLabel,
        mainLabel: actionCopy[actionType].mainLabel,
        onPress: async () => {
          if (!roomCode || pendingAction || !game) {
            return;
          }

          const parsedAmount = Number(actionAmountInput);
          const normalizedAmount =
            Number.isFinite(parsedAmount) && parsedAmount > 0 ? Math.floor(parsedAmount) : 0;

          if (actionType === "bet" && normalizedAmount < game.minBet) {
            setError(
              isZh ? `下注金额至少为 ${game.minBet}` : `Bet amount must be at least ${game.minBet}`
            );
            return;
          }

          if (actionType === "raise" && normalizedAmount < game.currentBet + game.minRaiseDelta) {
            setError(
              isZh
                ? `加注到至少 ${game.currentBet + game.minRaiseDelta}`
                : `Raise-to amount must be at least ${game.currentBet + game.minRaiseDelta}`
            );
            return;
          }

          setPendingAction(true);
          setError(null);

          try {
            const next = await submitRoomAction(
              roomCode,
              actionType,
              actionType === "bet" || actionType === "raise" ? normalizedAmount : undefined
            );
            setRoomState(next);
          } catch (actionError) {
            setError(
              actionError instanceof Error
                ? actionError.message
                : isZh
                  ? "提交操作失败。"
                  : "Failed to submit player action."
            );
          } finally {
            setPendingAction(false);
          }
        }
      })),
    [actionAmountInput, actionCopy, game, isZh, legalActions, pendingAction, roomCode]
  );

  const showActionPanel = Boolean(game?.isMyTurn && game.status === "in-progress");
  const hasRaiseActions =
    legalActions.includes("bet") || legalActions.includes("raise");

  return {
    mode: "online",
    title: roomCode ? (isZh ? `在线牌桌 ${roomCode}` : `Online Table ${roomCode}`) : isZh ? "在线牌桌" : "Online Table",
    backHref: roomCode ? `/rooms/${roomCode}` : "/profile",
    players: tablePlayers,
    potLabel: game ? formatCurrency(game.potTotal, locale) : "$0",
    street: game?.street ?? "preflop",
    streetLabel: game ? STREET_LABELS[locale][game.street] : STREET_LABELS[locale].preflop,
    statusLabel: game ? STATUS_LABELS[locale][game.status] : isZh ? "等待中" : "Waiting",
    handKey: game?.handId ?? `online-${roomCode || "shell"}`,
    status: toTableStatus(game),
    actingPlayerId: game?.activePlayerUserId ?? null,
    mainActions,
    utilityActions: [],
    canOpenSettlement: false,
    onOpenSettlement: () => undefined,
    amountControl:
      showActionPanel && hasRaiseActions && game
        ? {
            value: actionAmountInput,
            onValueChange: (next) => {
              const digitsOnly = next.replace(/[^\d]/g, "");
              const normalized = digitsOnly.replace(/^0+(?=\d)/, "");
              setActionAmountInput(normalized);
            },
            onStep: (delta) => {
              const current = Number(actionAmountInput || "0");
              const base = Number.isFinite(current) ? current : 0;
              const next = Math.max(0, base + delta);
              setActionAmountInput(next === 0 ? "" : String(next));
            },
            helperText: `${isZh ? "最小下注" : "Min Bet"}: ${game.minBet} | ${
              isZh ? "最小加注增量" : "Min Raise Delta"
            }: ${game.minRaiseDelta}`
          }
        : null,
    banner: error
      ? { tone: "warning", message: error }
      : loading
        ? {
            tone: "info",
            message: isZh ? "正在加载服务端牌桌状态..." : "Loading server-authoritative table state..."
          }
        : null,
    statusHint:
      game && game.status === "in-progress" && !game.isMyTurn
        ? isZh
          ? "当前未轮到你行动，等待服务端推进回合。"
          : "It is not your turn. Waiting for server turn progression."
        : pendingAction
          ? isZh
            ? "操作提交中..."
            : "Submitting action..."
          : null,
    supplementaryContent: (
      <OnlineTablePlaceholders game={game} roomStatus={roomState?.room.status ?? null} />
    ),
    showActionPanel
  };
}

