"use client";

import { useEffect, useMemo, useState } from "react";

import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import type { TableSeatPlayer } from "@/components/player/types";
import { buildActionOrder, assignPositions } from "@/features/table/rules";
import { startLocalHand, useTableController } from "@/features/table/useTableController";
import type { TableModeAdapter } from "@/features/table/mode/types";
import { getAutoSeatIndices, MAX_PLAYERS } from "@/lib/table-layout";
import { useBettingStore } from "@/store/useBettingStore";
import { useHandStore } from "@/store/useHandStore";
import { useMotionStore } from "@/store/useMotionStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useSettlementStore } from "@/store/useSettlementStore";
import type { Player, TableActionType } from "@/types/domain";

const STREET_LABELS: Record<AppLocale, Record<TableModeAdapter["street"], string>> = {
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

const STATUS_LABELS: Record<AppLocale, Record<TableModeAdapter["status"], string>> = {
  zh: {
    "in-progress": "\u8fdb\u884c\u4e2d",
    "pre-settlement": "\u5f85\u7ed3\u7b97",
    "settlement-confirmed": "\u5df2\u7ed3\u7b97"
  },
  en: {
    "in-progress": "In Progress",
    "pre-settlement": "Awaiting Settlement",
    "settlement-confirmed": "Settled"
  }
};

const LAST_ACTION_LABELS: Record<AppLocale, Record<TableActionType, string>> = {
  zh: {
    fold: "弃牌",
    check: "过牌",
    call: "跟注",
    bet: "下注",
    raise: "加注",
    "all-in": "全下",
    "quick-win": "快速判赢",
    "quick-split": "快速平分",
    "settle-pot": "结算底池",
    "undo-last-action": "撤销操作",
    "edit-hand": "编辑本手",
    "reopen-settlement": "重开结算",
    "end-hand": "结束本手"
  },
  en: {
    fold: "folded",
    check: "checked",
    call: "called",
    bet: "bet",
    raise: "raised",
    "all-in": "went all-in",
    "quick-win": "quick-won",
    "quick-split": "quick-split",
    "settle-pot": "settled pot",
    "undo-last-action": "undid action",
    "edit-hand": "edited hand",
    "reopen-settlement": "reopened settlement",
    "end-hand": "ended hand"
  }
};

function formatCurrency(amount: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 0
  }).format(amount);
}

function setActingStatus(players: Player[], actingPlayerId: string | null): Player[] {
  return players.map((player) => {
    if (player.status === "folded" || player.status === "all-in" || player.status === "winner") {
      return { ...player };
    }

    if (!actingPlayerId) {
      return { ...player, status: "waiting" };
    }

    return {
      ...player,
      status: player.id === actingPlayerId ? "acting" : "waiting"
    };
  });
}

function applyLocalSeatSelection(seatOrder: number[]): boolean {
  const sessionStore = useSessionStore.getState();
  const handStore = useHandStore.getState();
  const bettingStore = useBettingStore.getState();
  const settlementStore = useSettlementStore.getState();

  const players = [...sessionStore.players].sort((a, b) => a.seatIndex - b.seatIndex);

  if (players.length === 0 || seatOrder.length !== players.length) {
    return false;
  }

  const uniqueSeats = new Set(seatOrder);
  if (uniqueSeats.size !== seatOrder.length) {
    return false;
  }

  const dealerSeatIndex = seatOrder[0] ?? 0;
  const reseatedPlayers: Player[] = players.map((player, index) => ({
    ...player,
    seatIndex: seatOrder[index],
    currentBet: 0,
    totalInvestedThisHand: 0,
    status: player.stack <= 0 ? "all-in" : "waiting"
  }));

  const withPositions = assignPositions(reseatedPlayers, dealerSeatIndex);
  const actionOrder = buildActionOrder(withPositions, dealerSeatIndex, "preflop");
  const actingPlayerId = actionOrder[0] ?? null;
  const withActingStatus = setActingStatus(withPositions, actingPlayerId);

  sessionStore.applySnapshot({
    sessionId: sessionStore.sessionId,
    sessionName: sessionStore.sessionName,
    startedAtIso: sessionStore.startedAtIso,
    dealerSeatIndex,
    players: withActingStatus
  });
  handStore.resetForNewHand(actionOrder);
  bettingStore.resetForNewHand();
  settlementStore.resetForNewHand();
  useMotionStore.getState().clearAll();
  startLocalHand();

  return true;
}

export function useLocalTableModeAdapter(): TableModeAdapter {
  const controller = useTableController();
  const { locale, isZh } = useLanguage();
  const [seatSelectionMode, setSeatSelectionMode] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [amountInput, setAmountInput] = useState("400");
  const actingPlayer = controller.players.find((p) => p.id === controller.actingPlayerId);
  const maxWager = (actingPlayer?.stack ?? 0) + (actingPlayer?.currentBet ?? 0);
  const amountValid = amountInput !== "" && Number.isSafeInteger(Number(amountInput)) && Number(amountInput) >= controller.minRaiseTo && Number(amountInput) <= maxWager;

  useEffect(() => {
    const amount = String(controller.minRaiseTo);
    setAmountInput(amount);
    controller.setActionAmount(Number(amount));
  }, [controller.minRaiseTo, controller.actingPlayerId]);

  const players = useMemo<TableSeatPlayer[]>(() => {
    if (seatSelectionMode) {
      return Array.from({ length: MAX_PLAYERS }, (_, seatIndex) => {
        const selectedOrder = selectedSeats.indexOf(seatIndex);
        return {
          id: `seat-picker-${seatIndex + 1}`,
          name: `S${seatIndex + 1}`,
          seatIndex,
          seatCount: MAX_PLAYERS,
          stackLabel: "",
          isPlaceholder: true,
          placeholderLabel: selectedOrder >= 0 ? String(selectedOrder + 1) : "+",
          placeholderSelected: selectedOrder >= 0,
          onPress: () => {
            setSelectedSeats((current) => {
              if (current.includes(seatIndex)) {
                return current.filter((item) => item !== seatIndex);
              }

              if (current.length >= controller.playerCount) {
                return current;
              }

              return [...current, seatIndex];
            });
          },
          status: "waiting"
        } satisfies TableSeatPlayer;
      });
    }

    return controller.players.map((player) => ({
      id: player.id,
      name: player.name,
      seatIndex: player.seatIndex,
      seatCount: MAX_PLAYERS,
      avatarUrl: player.avatar ?? null,
      stackLabel: formatCurrency(player.stack, locale),
      betLabel: player.currentBet > 0 ? `${isZh ? "注" : "Bet"} ${formatCurrency(player.currentBet, locale)}` : undefined,
      positionLabel: player.position,
      isHero: player.isHero,
      isActive: player.id === controller.actingPlayerId,
      status: player.status
    }));
  }, [controller.actingPlayerId, controller.playerCount, controller.players, locale, seatSelectionMode, selectedSeats]);

  const seatSelectionContent =
    seatSelectionMode ? (
      <article className="local-setup rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4">
        <p className="text-sm font-semibold text-stitch-onSurface">
          {isZh ? "牌局设置" : "Game setup"}
        </p>
        <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
          {isZh
            ? `\u5728\u724c\u684c\u4e0a\u70b9\u51fb + \u9009\u62e9\u73b0\u5b9e\u5ea7\u4f4d\uff0c\u5df2\u9009 ${selectedSeats.length}/${controller.playerCount}`
            : `Tap + on table seats to match real positions. Selected ${selectedSeats.length}/${controller.playerCount}`}
        </p>
        <div className="mt-4 space-y-2">
          <p className="text-xs text-stitch-onSurfaceVariant">{isZh ? "玩家姓名 / 起始筹码（盲注 100 / 200）" : "Player / Starting chips (blinds 100 / 200)"}</p>
          {controller.players.map((player) => <div key={player.id} className="local-setup-player grid grid-cols-2 gap-2">
            <input aria-label={`${isZh ? "姓名" : "Name"} ${player.id}`} value={player.name} maxLength={24}
              onChange={(event) => useSessionStore.getState().setPlayers(useSessionStore.getState().players.map((p) => p.id === player.id ? {...p,name:event.target.value} : p))}
              className="h-11 min-w-0 rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 text-sm" />
            <input aria-label={`${isZh ? "起始筹码" : "Starting chips"} ${player.id}`} type="number" inputMode="numeric" min={1} max={100000000} value={player.stack}
              onChange={(event) => { const stack = Number(event.target.value); if (Number.isSafeInteger(stack) && stack >= 0 && stack <= 100000000) useSessionStore.getState().setPlayers(useSessionStore.getState().players.map((p) => p.id === player.id ? {...p,stack} : p)); }}
              className="h-11 min-w-0 rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 text-sm" />
          </div>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurface" onClick={() => setSelectedSeats(getAutoSeatIndices(controller.playerCount))}>{isZh ? "自动安排座位" : "Auto-seat"}</button>
          <button
            type="button"
            className="rounded-xl bg-stitch-primary px-3 py-2 text-xs font-semibold text-stitch-onPrimary disabled:opacity-50"
            disabled={controller.resumeAvailable || selectedSeats.length !== controller.playerCount || controller.players.some((p) => !p.name.trim() || p.stack < 1)}
            onClick={() => {
              if (selectedSeats.length !== controller.playerCount) {
                return;
              }

              if (applyLocalSeatSelection(selectedSeats)) {
                setSeatSelectionMode(false);
              }
            }}
          >
            {isZh ? "确认入座，开始牌局" : "Take seats & play"}
          </button>
          <button
            type="button"
            className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant"
            onClick={() => setSelectedSeats([])}
          >
            {isZh ? "\u6e05\u7a7a\u9009\u62e9" : "Clear"}
          </button>
        </div>
      </article>
    ) : controller.status === "settlement-confirmed" ? (
      <article className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant">
        <button
          type="button"
          className="font-semibold text-stitch-primary"
          disabled={controller.status !== "settlement-confirmed"}
          onClick={() => {
            setSeatSelectionMode(true);
            setSelectedSeats([]);
          }}
        >
          {isZh ? "\u91cd\u65b0\u9009\u5ea7" : "Reselect Seats"}
        </button>
      </article>
    ) : null;

  const topActionHint = useMemo(() => {
    if (seatSelectionMode) {
      return null;
    }

    const actionType = controller.lastActionType;
    if (!actionType) {
      return isZh ? "上一位操作：等待首个动作" : "Previous action: waiting for first move";
    }

    const actionLabel = LAST_ACTION_LABELS[locale][actionType];
    const actorName = controller.lastActionPlayerName ?? (isZh ? "系统" : "System");

    if (isZh) {
      return `上一位操作：${actorName} ${actionLabel}`;
    }

    return `Previous action: ${actorName} ${actionLabel}`;
  }, [controller.lastActionPlayerName, controller.lastActionType, isZh, locale, seatSelectionMode]);

  return {
    mode: "local",
    musicScene: seatSelectionMode ? "lobby" : "table",
    title: isZh ? "\u672c\u5730\u6a21\u5f0f\u724c\u684c" : "Local Mode Table",
    backHref: "/online",
    playerCount: controller.playerCount,
    onPlayerCountChange: seatSelectionMode && !controller.resumeAvailable ? (count) => {setSelectedSeats([]); controller.setPlayerCount(count);} : undefined,
    players,
    potLabel: formatCurrency(controller.pot, locale),
    boardCards: null,
    street: controller.street,
    streetLabel: STREET_LABELS[locale][controller.street],
    statusLabel: STATUS_LABELS[locale][controller.status],
    handKey: `local-${controller.playerCount}-${controller.sessionName}`,
    status: controller.status,
    actingPlayerId: seatSelectionMode ? null : controller.actingPlayerId,
    mainActions: seatSelectionMode ? [] : controller.mainActions.map((action) => action.id === "bet" || action.id === "raise" ? {...action,disabled:!amountValid} : action),
    utilityActions: seatSelectionMode ? [] : controller.utilityActions,
    canOpenSettlement: seatSelectionMode ? false : controller.canOpenSettlement,
    onOpenSettlement: seatSelectionMode ? () => undefined : controller.openSettlement,
    amountControl: !seatSelectionMode && controller.mainActions.some((a) => a.id === "bet" || a.id === "raise") ? {
      value: amountInput,
      onValueChange: (value) => {
        const cleaned = value.replace(/[^\d]/g, "");
        setAmountInput(cleaned); controller.setActionAmount(Number(cleaned));
      },
      onStep: (delta) => {
        const value = Math.min(maxWager, Math.max(controller.minRaiseTo, Number(amountInput || controller.minRaiseTo) + delta));
        setAmountInput(String(value)); controller.setActionAmount(value);
      },
      helperText: `${isZh ? "本轮下注总额" : "Total wager this round"} ${controller.minRaiseTo}–${maxWager}${amountValid ? "" : isZh ? " · 请输入范围内的整数" : " · Enter a whole number in range"}`
    } : null,
    settlement: seatSelectionMode
      ? null
      : {
          isOpen: controller.settlementOpen,
          potLabel: controller.settlementPotLabel,
          players: controller.settlementPlayers,
          canUndo: controller.canSettlementUndo,
          canReopen: controller.canReopenSettlement,
          onClose: controller.closeSettlement,
          onQuickWin: controller.quickWin,
          onQuickSplit: controller.quickSplit,
          onUndo: controller.undoLastAction,
          onEditHand: controller.editHand,
          onReopenSettlement: controller.reopenSettlement
        },
    resume: {
      available: controller.resumeAvailable,
      savedAtIso: controller.resumeSavedAtIso,
      onResume: () => {controller.resumeSession(); setSeatSelectionMode(false);},
      onDiscard: controller.discardResumeSnapshot
    },
    banner:
      !controller.autosaveReady && controller.resumeAvailable
        ? {
            tone: "warning",
            message: isZh
              ? "\u68c0\u6d4b\u5230\u672c\u5730\u5feb\u7167\uff0c\u53ef\u4ee5\u6062\u590d\u6216\u4e22\u5f03\u540e\u7ee7\u7eed\u81ea\u52a8\u4fdd\u5b58\u3002"
              : "A local snapshot was found. Resume or discard to continue autosave."
          }
        : null,
    statusHint: !seatSelectionMode && controller.actingPlayerId ? `${isZh ? "轮到" : "Action on"} ${controller.players.find((p) => p.id === controller.actingPlayerId)?.name} · ${isZh ? "需跟注" : "To call"} ${controller.toCall}` : seatSelectionMode
      ? isZh
        ? "\u8bf7\u5148\u5728\u724c\u684c\u4e0a\u786e\u8ba4\u5ea7\u4f4d\uff0c\u518d\u8fdb\u5165\u64cd\u4f5c\u9636\u6bb5\u3002"
        : "Confirm seats on the table before actions."
      : controller.status === "in-progress" && !controller.actingPlayerId
        ? isZh
          ? "\u5f53\u524d\u6ca1\u6709\u53ef\u884c\u52a8\u73a9\u5bb6\u3002"
          : "No actionable player at the moment."
        : null,
    topActionHint,
    supplementaryContent: seatSelectionContent,
    showActionPanel: !seatSelectionMode
  };
}
