"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import type { TableSeatPlayer } from "@/components/player/types";
import { OnlineHandSettlementView } from "@/components/table/online-hand-settlement-view";
import { OnlineMyHoleCards } from "@/components/table/online-my-hole-cards";
import {
  decideNextHand,
  getRoom,
  type RoomActionPatch,
  settleHand,
  setPlayerSeat,
  setReady,
  startRoom,
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
type RoomPlayer = RoomState["players"][number];

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

const LAST_ACTION_LABELS: Record<
  AppLocale,
  Record<NonNullable<NonNullable<RoomState["game"]>["lastAction"]>["actionType"], string>
> = {
  zh: {
    fold: "弃牌",
    check: "过牌",
    call: "跟注",
    bet: "下注",
    raise: "加注",
    "all-in": "全下",
    "post-sb": "下小盲",
    "post-bb": "下大盲"
  },
  en: {
    fold: "folded",
    check: "checked",
    call: "called",
    bet: "bet",
    raise: "raised",
    "all-in": "went all-in",
    "post-sb": "posted SB",
    "post-bb": "posted BB"
  }
};

function formatCurrency(amount: number, locale: AppLocale): string {
  const formatted = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 0
  }).format(Math.abs(amount));

  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatSignedCurrency(amount: number, locale: AppLocale): string {
  const formatted = formatCurrency(Math.abs(amount), locale);
  return amount >= 0 ? `+${formatted}` : `-${formatted}`;
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

function toLocalSyncedSeatSelectionPlayers(input: {
  roomState: RoomState;
  locale: AppLocale;
  isZh: boolean;
  onSelectSeat: (seatIndex: number) => void;
}): TableSeatPlayer[] {
  const seatCount = Math.max(2, Math.min(10, input.roomState.room.maxPlayers));
  const playerBySeat = new Map<number, RoomPlayer>();

  input.roomState.players.forEach((player) => {
    if (
      player.seatIndex !== null &&
      player.seatIndex >= 0 &&
      player.seatIndex < seatCount &&
      !playerBySeat.has(player.seatIndex)
    ) {
      playerBySeat.set(player.seatIndex, player);
    }
  });

  return Array.from({ length: seatCount }, (_, seatIndex) => {
    const seatedPlayer = playerBySeat.get(seatIndex);
    if (!seatedPlayer) {
      return {
        id: `local-synced-seat-${seatIndex + 1}`,
        name: `S${seatIndex + 1}`,
        stackLabel: "",
        isPlaceholder: true,
        placeholderLabel: "+",
        placeholderSelected: false,
        onPress: () => input.onSelectSeat(seatIndex),
        status: "waiting"
      } satisfies TableSeatPlayer;
    }

    const stackLabel = formatCurrency(seatedPlayer.stack, input.locale);
    const currentBetLabel =
      seatedPlayer.currentBet > 0
        ? `${input.isZh ? "注额" : "Bet"} ${formatCurrency(seatedPlayer.currentBet, input.locale)}`
        : null;

    return {
      id: seatedPlayer.userId,
      name: seatedPlayer.displayName,
      avatarUrl: seatedPlayer.avatarUrl,
      stackLabel: currentBetLabel ? `${stackLabel} · ${currentBetLabel}` : stackLabel,
      positionLabel: `S${seatIndex + 1}`,
      isHero: input.roomState.me?.userId === seatedPlayer.userId,
      isActive: false,
      status: seatedPlayer.status
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
  const playerNameByUserId = new Map(nextPlayers.map((player) => [player.userId, player.displayName]));

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
          lastAction: patch.game.lastAction
            ? {
                userId: patch.game.lastAction.userId,
                displayName:
                  playerNameByUserId.get(patch.game.lastAction.userId) ??
                  previousGame?.lastAction?.displayName ??
                  patch.game.lastAction.userId,
                actionType: patch.game.lastAction.actionType,
                amount: patch.game.lastAction.amount,
                street: patch.game.lastAction.street
              }
            : null,
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
  const router = useRouter();
  const variant = options?.variant ?? "online";
  const { locale, isZh } = useLanguage();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(Boolean(roomCode));
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const [actionAmountInput, setActionAmountInput] = useState("");
  const [settlementOpen, setSettlementOpen] = useState(false);
  const settledSyncHandRef = useRef<string | null>(null);
  const roomFinishedRedirectedRef = useRef(false);

  const game = useMemo(() => deriveGameForCurrentUser(roomState), [roomState]);
  const isHost = roomState?.me?.isHost ?? false;
  const usesAutoEvaluator = variant === "online";
  const isLocalSeatSelectionPhase = variant === "local" && roomState?.room.status === "waiting";
  const mySeatIndex = roomState?.me?.seatIndex ?? null;
  const allPlayersSeated = Boolean(
    roomState && roomState.players.length > 0 && roomState.players.every((player) => player.seatIndex !== null)
  );
  const actionCopy = ACTION_COPY[locale];
  const canSettle = Boolean(game?.status === "showdown" && isHost && !usesAutoEvaluator);
  const canOpenManualSettlement = canSettle;
  const canStartNextHand = Boolean(game?.status === "settled" && isHost);

  useEffect(() => {
    if (!roomCode) {
      setLoading(false);
      setRoomState(null);
      setError(null);
      settledSyncHandRef.current = null;
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

      if (patch.game?.status === "settled" && patch.game.handId) {
        const settledHandKey = `${patch.roomCode}:${patch.game.handId}`;
        if (settledSyncHandRef.current === settledHandKey) {
          return;
        }

        settledSyncHandRef.current = settledHandKey;
        void getRoom(roomCode)
          .then((nextRoom) => {
            if (active) {
              setRoomState(nextRoom);
            }
          })
          .catch(() => undefined);
      }
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

  useEffect(() => {
    if (!roomCode) {
      roomFinishedRedirectedRef.current = false;
      return;
    }

    const roomStatus = roomState?.room.status;
    const shouldRedirect = roomStatus === "finished" || roomStatus === "cancelled";

    if (!shouldRedirect) {
      roomFinishedRedirectedRef.current = false;
      return;
    }

    if (roomFinishedRedirectedRef.current) {
      return;
    }

    roomFinishedRedirectedRef.current = true;
    router.replace("/rooms/join");
  }, [roomCode, roomState?.room.status, router]);

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

  const settlementEntries = game?.lastSettlement?.entries ?? [];
  const settlementEntryByUserId = useMemo(
    () => new Map(settlementEntries.map((entry) => [entry.userId, entry])),
    [settlementEntries]
  );

  const selectLocalSeat = useCallback(
    async (seatIndex: number) => {
      if (!roomCode || !roomState || variant !== "local" || roomState.room.status !== "waiting" || pendingAction) {
        return;
      }

      setPendingAction(true);
      setError(null);

      try {
        const seatUpdated = await setPlayerSeat(roomCode, seatIndex);
        const nextReady = seatUpdated.me?.seatIndex !== null;
        const readyUpdated = await setReady(roomCode, nextReady);
        setRoomState(readyUpdated);
      } catch (seatError) {
        setError(
          seatError instanceof Error
            ? seatError.message
            : isZh
              ? "无法设置座位。"
              : "Unable to set seat."
        );
      } finally {
        setPendingAction(false);
      }
    },
    [isZh, pendingAction, roomCode, roomState, variant]
  );

  const clearLocalSeat = useCallback(async () => {
    if (!roomCode || !roomState || variant !== "local" || roomState.room.status !== "waiting" || pendingAction) {
      return;
    }

    setPendingAction(true);
    setError(null);

    try {
      const seatUpdated = await setPlayerSeat(roomCode, null);
      const nextReady = seatUpdated.me?.seatIndex !== null;
      const readyUpdated = await setReady(roomCode, nextReady);
      setRoomState(readyUpdated);
    } catch (seatError) {
      setError(
        seatError instanceof Error
          ? seatError.message
          : isZh
            ? "无法取消座位。"
            : "Unable to clear seat."
      );
    } finally {
      setPendingAction(false);
    }
  }, [isZh, pendingAction, roomCode, roomState, variant]);

  const tablePlayers = useMemo(() => {
    if (isLocalSeatSelectionPhase && roomState) {
      return toLocalSyncedSeatSelectionPlayers({
        roomState,
        locale,
        isZh,
        onSelectSeat: (seatIndex) => {
          void selectLocalSeat(seatIndex);
        }
      });
    }

    const basePlayers = toSeatPlayers(roomState, locale, isZh);

    if (variant !== "online" || game?.status !== "settled") {
      return basePlayers;
    }

    return basePlayers.map((player) => {
      const settledEntry = settlementEntryByUserId.get(player.id);
      if (!settledEntry) {
        return player;
      }

      return {
        ...player,
        revealedCards: [...settledEntry.holeCards.slice(0, 2)],
        resultDeltaLabel: formatSignedCurrency(settledEntry.netChange, locale)
      };
    });
  }, [
    game?.status,
    isLocalSeatSelectionPhase,
    isZh,
    locale,
    roomState,
    selectLocalSeat,
    settlementEntryByUserId,
    variant
  ]);

  const utilityActions = useMemo(() => {
    const actions: Array<{
      id: string;
      label: string;
      onPress: () => Promise<void>;
      disabled?: boolean;
    }> = [];

    if (isLocalSeatSelectionPhase) {
      if (mySeatIndex !== null) {
        actions.push({
          id: "leave-seat",
          label: isZh ? "取消我的座位" : "Leave Seat",
          onPress: async () => {
            await clearLocalSeat();
          }
        });
      }

      if (isHost) {
        actions.push({
          id: "confirm-seats-start",
          label: isZh ? "确认座位并开始" : "Confirm Seats & Start",
          disabled: pendingAction || !roomState?.canStart || !allPlayersSeated,
          onPress: async () => {
            if (!roomCode || pendingAction || !roomState?.canStart || !allPlayersSeated) {
              return;
            }

            setPendingAction(true);
            setError(null);

            try {
              const next = await startRoom(roomCode);
              setRoomState(next);
            } catch (startError) {
              setError(
                startError instanceof Error
                  ? startError.message
                  : isZh
                    ? "无法开始游戏。"
                    : "Unable to start game."
              );
            } finally {
              setPendingAction(false);
            }
          }
        });
      }

      return actions;
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
  }, [
    allPlayersSeated,
    canStartNextHand,
    clearLocalSeat,
    isHost,
    isLocalSeatSelectionPhase,
    isZh,
    mySeatIndex,
    pendingAction,
    roomCode,
    roomState?.canStart
  ]);

  const showActionPanel = Boolean(game?.isMyTurn && game.status === "in-progress");
  const hasRaiseActions = legalActions.includes("bet") || legalActions.includes("raise");
  const shouldShowActionPanel =
    showActionPanel || canSettle || utilityActions.length > 0 || pendingAction;
  const isSettledOnlineView =
    variant === "online" && game?.status === "settled" && settlementEntries.length > 0;
  const topActionHint = useMemo(() => {
    if (!roomState || roomState.room.status !== "active") {
      return null;
    }

    if (!game?.lastAction) {
      return isZh ? "上一位操作：等待首个动作" : "Previous action: waiting for first move";
    }

    const amountText =
      game.lastAction.amount > 0 ? ` ${formatCurrency(game.lastAction.amount, locale)}` : "";
    const actionLabel = LAST_ACTION_LABELS[locale][game.lastAction.actionType];
    if (isZh) {
      return `上一位操作：${game.lastAction.displayName} ${actionLabel}${amountText}`;
    }

    return `Previous action: ${game.lastAction.displayName} ${actionLabel}${amountText}`;
  }, [game?.lastAction, isZh, locale, roomState]);
  const settledPotTotal = useMemo(
    () =>
      settlementEntries.reduce((sum, entry) => sum + Math.max(0, Math.trunc(entry.amountWon ?? 0)), 0),
    [settlementEntries]
  );

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
  const potLabel = isSettledOnlineView
    ? formatCurrency(settledPotTotal, locale)
    : game
      ? formatCurrency(game.potTotal, locale)
      : "$0";

  return {
    mode: variant === "local" ? "local" : "online",
    title,
    backHref: roomCode ? `/rooms/${roomCode}` : "/profile",
    players: tablePlayers,
    potLabel,
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
        : isLocalSeatSelectionPhase
          ? mySeatIndex === null
            ? isZh
              ? "请在牌桌点击 + 选择你的现实座位。"
              : "Tap + on the table to pick your real seat."
            : isHost
              ? roomState?.canStart && allPlayersSeated
                ? isZh
                  ? "所有玩家已选座并就绪，房主可确认开始。"
                  : "All players are seated and ready. Host can confirm start."
                : isZh
                  ? "等待所有玩家完成选座并就绪后，由房主确认开始。"
                  : "Waiting for everyone to seat and ready up before host confirms start."
              : isZh
                ? "你已选座，等待房主确认开始。"
                : "Seat selected. Waiting for host confirmation."
        : canSettle
          ? isZh
            ? "本手已进入待结算，房主可打开结算面板。"
            : "Hand is awaiting settlement. Host can open settlement."
          : variant === "online" && game?.status === "showdown"
            ? isZh
              ? "系统正在自动进行牌力结算，请稍候..."
              : "Auto hand evaluation is in progress..."
          : canStartNextHand
            ? isZh
              ? "本手已结算，房主可开始下一手。"
              : "Hand settled. Host can start the next hand."
            : variant === "online" && game?.status === "settled"
              ? isZh
                ? "本手已结算，等待房主选择下一手或结束整局。"
                : "Hand settled. Waiting for host decision."
            : game && game.status === "in-progress" && !game.isMyTurn
        ? isZh
          ? "当前未轮到你行动，等待服务端推进回合。"
          : "It is not your turn. Waiting for server turn progression."
        : null,
    topActionHint,
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
    mainContent:
      isSettledOnlineView && game ? (
        <OnlineHandSettlementView
          players={tablePlayers}
          potLabel={potLabel}
          boardCards={game.boardCards}
          handKey={`${variant}-settled-${game.handId ?? "unknown-hand"}`}
          settlementEntries={settlementEntries}
        />
      ) : undefined,
    supplementaryContent:
      variant === "online" && !isSettledOnlineView ? (
        <OnlineMyHoleCards cards={game?.myHoleCards ?? []} />
      ) : null,
    showActionPanel: shouldShowActionPanel
  };
}
