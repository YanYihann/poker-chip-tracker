"use client";

import { useEffect, useMemo, useState } from "react";

import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import type { TableSeatPlayer } from "@/components/player/types";
import { OnlineTablePlaceholders } from "@/components/table/online-table-placeholders";
import {
  decideNextHand,
  getRoom,
  type RoomActionPatch,
  settleHand,
  submitRoomAction,
  type RoomState
} from "@/features/rooms/api";
import type { TableModeAdapter } from "@/features/table/mode/types";
import { getRoomSocket } from "@/features/rooms/realtime";
import { buildPlaceholderPlayers } from "@/lib/table-layout";

type OnlineActionType = NonNullable<RoomState["game"]>["legalActions"][number];
type OnlineGameStatus = NonNullable<RoomState["game"]>["status"];
type OnlineStreet = NonNullable<RoomState["game"]>["street"];
type SyncedVariant = "online" | "local";

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

function deriveGameForCurrentUser(roomState: RoomState | null): RoomState["game"] {
  const game = roomState?.game ?? null;
  if (!roomState || !game) {
    return game;
  }

  const meUserId = roomState.me?.userId ?? null;
  const mePlayer = meUserId
    ? roomState.players.find((player) => player.userId === meUserId) ?? null
    : null;

  const isMyTurn =
    game.status === "in-progress" &&
    !!meUserId &&
    game.activePlayerUserId === meUserId;
  const canAct =
    isMyTurn &&
    !!mePlayer &&
    mePlayer.status !== "folded" &&
    mePlayer.status !== "all-in" &&
    mePlayer.stack > 0;
  const toCall = mePlayer ? Math.max(0, game.currentBet - mePlayer.currentBet) : 0;

  const legalActions: NonNullable<RoomState["game"]>["legalActions"] = canAct
    ? toCall === 0
      ? ["fold", "check", "bet", "all-in"]
      : ["fold", "call", "raise", "all-in"]
    : [];

  return {
    ...game,
    isMyTurn: canAct,
    toCall,
    legalActions
  };
}

function applyRoomActionPatch(prev: RoomState | null, patch: RoomActionPatch): RoomState | null {
  if (!prev || prev.room.code !== patch.roomCode) {
    return prev;
  }

  const patchPlayersByUserId = new Map(patch.players.map((player) => [player.userId, player]));
  const nextPlayers = prev.players.map((player) => {
    const next = patchPlayersByUserId.get(player.userId);
    if (!next) {
      return player;
    }

    return {
      ...player,
      seatIndex: next.seatIndex,
      stack: next.stack,
      currentBet: next.currentBet,
      status: next.status,
      isReady: next.isReady,
      isConnected: next.isConnected
    };
  });

  const previousGame = prev.game;
  const nextGame =
    patch.game === null
      ? null
      : {
          handId: patch.game.handId,
          handNumber: patch.game.handNumber,
          street: patch.game.street,
          status: patch.game.status,
          potTotal: patch.game.potTotal,
          currentBet: patch.game.currentBet,
          activeSeat: patch.game.activeSeat,
          activePlayerUserId: patch.game.activePlayerUserId,
          dealerSeat: patch.game.dealerSeat,
          sbSeat: patch.game.sbSeat,
          bbSeat: patch.game.bbSeat,
          isMyTurn: previousGame?.isMyTurn ?? false,
          legalActions: previousGame?.legalActions ?? [],
          toCall: previousGame?.toCall ?? 0,
          minBet: patch.game.minBet,
          minRaiseDelta: patch.game.minRaiseDelta,
          canSettle: previousGame?.canSettle ?? false,
          canDecideNextHand: previousGame?.canDecideNextHand ?? false,
          myHoleCards: previousGame?.myHoleCards ?? [],
          boardCards: patch.game.boardCards,
          eligibleWinnerUserIds: nextPlayers
            .filter((player) => player.status !== "folded")
            .map((player) => player.userId),
          lastSettlement:
            patch.game.status === "settled"
              ? previousGame?.lastSettlement ?? null
              : null
        };

  return {
    ...prev,
    room: {
      ...prev.room,
      status: patch.roomStatus,
      currentHandNumber: patch.game?.handNumber ?? prev.room.currentHandNumber,
      dealerSeat: patch.game?.dealerSeat ?? prev.room.dealerSeat
    },
    players: nextPlayers,
    game: nextGame
  };
}

export function useOnlineRoomTableModeAdapter(
  roomCode: string,
  options?: { variant?: SyncedVariant }
): TableModeAdapter {
  const variant = options?.variant ?? "online";
  const { locale, isZh } = useLanguage();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(Boolean(roomCode));
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const [actionAmountInput, setActionAmountInput] = useState("");
  const [settlementOpen, setSettlementOpen] = useState(false);

  const game = useMemo(() => deriveGameForCurrentUser(roomState), [roomState]);
  const isHost = roomState?.me?.isHost ?? false;
  const usesAutoEvaluator = variant === "online";
  const actionCopy = ACTION_COPY[locale];
  const canSettle = Boolean(game?.status === "showdown" && isHost);
  const canOpenManualSettlement = canSettle && !usesAutoEvaluator;
  const canAutoSettle = canSettle && usesAutoEvaluator;
  const canStartNextHand = Boolean(game?.status === "settled" && isHost);

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
                ? "无法加载牌桌状态。"
                : "Unable to load table state."
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

    const onRoomPatch = (patch: RoomActionPatch) => {
      if (!active || patch.roomCode !== roomCode) {
        return;
      }

      setRoomState((prev) => applyRoomActionPatch(prev, patch));
    };

    void loadRoom();
    socket.on("room:state", onRoomState);
    socket.on("room:patch", onRoomPatch);
    socket.on("room:error", onRoomError);
    socket.emit("room:subscribe", { roomCode });

    return () => {
      active = false;
      socket.emit("room:unsubscribe", { roomCode });
      socket.off("room:state", onRoomState);
      socket.off("room:patch", onRoomPatch);
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

  useEffect(() => {
    if (game?.status !== "showdown") {
      setSettlementOpen(false);
    }
  }, [game?.status]);

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
            setError(isZh ? `下注金额至少为 ${game.minBet}` : `Bet amount must be at least ${game.minBet}`);
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

  const settlementPlayers = useMemo(() => {
    if (!roomState) {
      return [];
    }

    const eligibleIds = new Set(game?.eligibleWinnerUserIds ?? []);
    const candidates =
      eligibleIds.size === 0
        ? roomState.players
        : roomState.players.filter((player) => eligibleIds.has(player.userId));

    return candidates.map((player) => ({
      id: player.userId,
      name: player.displayName,
      stackLabel: formatCurrency(player.stack, locale),
      status: player.status
    }));
  }, [game?.eligibleWinnerUserIds, locale, roomState]);

  const utilityActions = useMemo(() => {
    const actions: Array<{
      id: string;
      label: string;
      onPress: () => Promise<void>;
    }> = [];

    if (canAutoSettle) {
      actions.push({
        id: "auto-settle",
        label: isZh ? "自动牌力结算" : "Auto Settle",
        onPress: async () => {
          if (!roomCode || pendingAction || !canAutoSettle) {
            return;
          }

          setPendingAction(true);
          setError(null);

          try {
            const next = await settleHand(roomCode);
            setRoomState(next);
          } catch (settleError) {
            setError(
              settleError instanceof Error
                ? settleError.message
                : isZh
                  ? "自动结算失败。"
                  : "Failed to auto settle hand."
            );
          } finally {
            setPendingAction(false);
          }
        }
      });
    }

    if (canStartNextHand) {
      actions.push(
        {
          id: "next-hand",
          label: isZh ? "开始下一手" : "Start Next Hand",
          onPress: async () => {
            if (!roomCode || pendingAction || !canStartNextHand) {
              return;
            }

            setPendingAction(true);
            setError(null);

            try {
              const next = await decideNextHand(roomCode, true);
              setRoomState(next);
            } catch (nextHandError) {
              setError(
                nextHandError instanceof Error
                  ? nextHandError.message
                  : isZh
                    ? "无法开始下一手。"
                    : "Unable to start next hand."
              );
            } finally {
              setPendingAction(false);
            }
          }
        },
        {
          id: "end-session",
          label: isZh ? "结束牌局并归档" : "End Session & Archive",
          onPress: async () => {
            if (!roomCode || pendingAction || !canStartNextHand) {
              return;
            }

            setPendingAction(true);
            setError(null);

            try {
              const next = await decideNextHand(roomCode, false);
              setRoomState(next);
            } catch (endSessionError) {
              setError(
                endSessionError instanceof Error
                  ? endSessionError.message
                  : isZh
                    ? "无法结束并归档当前牌局。"
                    : "Unable to end and archive the current session."
              );
            } finally {
              setPendingAction(false);
            }
          }
        }
      );
    }

    return actions;
  }, [canAutoSettle, canStartNextHand, isZh, pendingAction, roomCode]);

  const showActionPanel = Boolean(game?.isMyTurn && game.status === "in-progress");
  const hasRaiseActions = legalActions.includes("bet") || legalActions.includes("raise");
  const shouldShowActionPanel =
    showActionPanel || canSettle || utilityActions.length > 0 || pendingAction;

  const title =
    variant === "local"
      ? roomCode
        ? isZh
          ? `本地同步牌桌 ${roomCode}`
          : `Local Synced Table ${roomCode}`
        : isZh
          ? "本地同步牌桌"
          : "Local Synced Table"
      : roomCode
        ? isZh
          ? `在线牌桌 ${roomCode}`
          : `Online Table ${roomCode}`
        : isZh
          ? "在线牌桌"
          : "Online Table";

  return {
    mode: variant === "local" ? "local" : "online",
    title,
    backHref: roomCode ? `/rooms/${roomCode}` : "/profile",
    players: tablePlayers,
    potLabel: game ? formatCurrency(game.potTotal, locale) : "$0",
    boardCards: game?.boardCards ?? [],
    street: game?.street ?? "preflop",
    streetLabel: game ? STREET_LABELS[locale][game.street] : STREET_LABELS[locale].preflop,
    statusLabel: game ? STATUS_LABELS[locale][game.status] : isZh ? "等待中" : "Waiting",
    handKey: `${variant}-${game?.handId ?? `room-${roomCode || "shell"}`}`,
    status: toTableStatus(game),
    actingPlayerId: game?.activePlayerUserId ?? null,
    mainActions,
    utilityActions,
    canOpenSettlement: canOpenManualSettlement,
    onOpenSettlement: () => {
      if (canOpenManualSettlement) {
        setSettlementOpen(true);
      }
    },
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
            message:
              variant === "local"
                ? isZh
                  ? "正在加载本地同步牌桌状态..."
                  : "Loading local synced table state..."
                : isZh
                  ? "正在加载服务端在线牌桌状态..."
                  : "Loading server-authoritative online table state..."
          }
        : null,
    statusHint:
      pendingAction
        ? isZh
          ? "操作提交中..."
          : "Submitting action..."
        : canSettle
          ? isZh
            ? usesAutoEvaluator
              ? "本手已进入待结算，房主可执行自动牌力结算。"
              : "本手已进入待结算，房主可打开结算面板。"
            : usesAutoEvaluator
              ? "Hand is awaiting settlement. Host can run auto hand evaluation."
              : "Hand is awaiting settlement. Host can open settlement."
          : canStartNextHand
            ? isZh
              ? "本手已结算，房主可开始下一手。"
              : "Hand settled. Host can start the next hand."
            : game && game.status === "in-progress" && !game.isMyTurn
        ? isZh
          ? "当前未轮到你行动，等待服务端推进回合。"
          : "It is not your turn. Waiting for server turn progression."
        : null,
    settlement: usesAutoEvaluator
      ? null
      : {
      isOpen: settlementOpen,
      players: settlementPlayers,
      canUndo: false,
      canReopen: false,
      onClose: () => setSettlementOpen(false),
      onQuickWin: async (winnerId: string) => {
        if (!roomCode || pendingAction || !canSettle || !winnerId) {
          return;
        }

        setPendingAction(true);
        setError(null);

        try {
          const next = await settleHand(roomCode, [winnerId]);
          setRoomState(next);
          setSettlementOpen(false);
        } catch (settleError) {
          setError(
            settleError instanceof Error
              ? settleError.message
              : isZh
                ? "结算失败。"
                : "Failed to settle hand."
          );
        } finally {
          setPendingAction(false);
        }
      },
      onQuickSplit: async (winnerIds: string[]) => {
        if (!roomCode || pendingAction || !canSettle || winnerIds.length === 0) {
          return;
        }

        const uniqueWinners = Array.from(new Set(winnerIds));

        setPendingAction(true);
        setError(null);

        try {
          const next = await settleHand(roomCode, uniqueWinners);
          setRoomState(next);
          setSettlementOpen(false);
        } catch (settleError) {
          setError(
            settleError instanceof Error
              ? settleError.message
              : isZh
                ? "结算失败。"
                : "Failed to settle hand."
          );
        } finally {
          setPendingAction(false);
        }
      },
      onUndo: () => undefined,
      onEditHand: () => undefined,
      onReopenSettlement: () => undefined
    },
    supplementaryContent:
      variant === "online" ? (
        <OnlineTablePlaceholders
          mode={variant}
          game={game}
          roomStatus={roomState?.room.status ?? null}
          myHoleCards={game?.myHoleCards ?? []}
          boardCards={game?.boardCards ?? []}
        />
      ) : null,
    showActionPanel: shouldShowActionPanel
  };
}
