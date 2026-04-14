"use client";

import { useEffect, useMemo, useState } from "react";

import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import type { TableSeatPlayer } from "@/components/player/types";
import { buildActionOrder, assignPositions } from "@/features/table/rules";
import { useTableController } from "@/features/table/useTableController";
import type { TableModeAdapter } from "@/features/table/mode/types";
import { MAX_PLAYERS } from "@/lib/table-layout";
import { useBettingStore } from "@/store/useBettingStore";
import { useHandStore } from "@/store/useHandStore";
import { useMotionStore } from "@/store/useMotionStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useSettlementStore } from "@/store/useSettlementStore";
import type { Player } from "@/types/domain";

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

function formatCurrency(amount: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "USD",
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

  return true;
}

export function useLocalTableModeAdapter(): TableModeAdapter {
  const controller = useTableController();
  const { locale, isZh } = useLanguage();
  const [seatSelectionMode, setSeatSelectionMode] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);

  useEffect(() => {
    setSeatSelectionMode(true);
    setSelectedSeats([]);
  }, [controller.playerCount]);

  const players = useMemo<TableSeatPlayer[]>(() => {
    if (seatSelectionMode) {
      return Array.from({ length: MAX_PLAYERS }, (_, seatIndex) => {
        const selectedOrder = selectedSeats.indexOf(seatIndex);
        return {
          id: `seat-picker-${seatIndex + 1}`,
          name: `S${seatIndex + 1}`,
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
      avatarUrl: player.avatar ?? null,
      stackLabel: formatCurrency(player.stack, locale),
      positionLabel: player.position,
      isHero: player.isHero,
      isActive: player.id === controller.actingPlayerId,
      status: player.status
    }));
  }, [controller.actingPlayerId, controller.playerCount, controller.players, locale, seatSelectionMode, selectedSeats]);

  const seatSelectionContent =
    seatSelectionMode ? (
      <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4">
        <p className="text-sm font-semibold text-stitch-onSurface">
          {isZh ? "\u672c\u5730\u5ea7\u4f4d\u9009\u62e9" : "Local Seat Selection"}
        </p>
        <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
          {isZh
            ? `\u5728\u724c\u684c\u4e0a\u70b9\u51fb + \u9009\u62e9\u73b0\u5b9e\u5ea7\u4f4d\uff0c\u5df2\u9009 ${selectedSeats.length}/${controller.playerCount}`
            : `Tap + on table seats to match real positions. Selected ${selectedSeats.length}/${controller.playerCount}`}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-stitch-primary px-3 py-2 text-xs font-semibold text-stitch-onPrimary disabled:opacity-50"
            disabled={selectedSeats.length !== controller.playerCount}
            onClick={() => {
              if (selectedSeats.length !== controller.playerCount) {
                return;
              }

              if (applyLocalSeatSelection(selectedSeats)) {
                setSeatSelectionMode(false);
              }
            }}
          >
            {isZh ? "\u786e\u8ba4\u5ea7\u4f4d" : "Confirm Seats"}
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
    ) : (
      <article className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant">
        <button
          type="button"
          className="font-semibold text-stitch-primary"
          onClick={() => {
            setSeatSelectionMode(true);
            setSelectedSeats([]);
          }}
        >
          {isZh ? "\u91cd\u65b0\u9009\u5ea7" : "Reselect Seats"}
        </button>
      </article>
    );

  return {
    mode: "local",
    title: isZh ? "\u672c\u5730\u6a21\u5f0f\u724c\u684c" : "Local Mode Table",
    backHref: "/",
    playerCount: controller.playerCount,
    onPlayerCountChange: controller.setPlayerCount,
    players,
    potLabel: formatCurrency(controller.pot, locale),
    boardCards: null,
    street: controller.street,
    streetLabel: STREET_LABELS[locale][controller.street],
    statusLabel: STATUS_LABELS[locale][controller.status],
    handKey: `local-${controller.playerCount}-${controller.sessionName}`,
    status: controller.status,
    actingPlayerId: seatSelectionMode ? null : controller.actingPlayerId,
    mainActions: seatSelectionMode ? [] : controller.mainActions,
    utilityActions: seatSelectionMode ? [] : controller.utilityActions,
    canOpenSettlement: seatSelectionMode ? false : controller.canOpenSettlement,
    onOpenSettlement: seatSelectionMode ? () => undefined : controller.openSettlement,
    amountControl: null,
    settlement: seatSelectionMode
      ? null
      : {
          isOpen: controller.settlementOpen,
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
      onResume: controller.resumeSession,
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
    statusHint: seatSelectionMode
      ? isZh
        ? "\u8bf7\u5148\u5728\u724c\u684c\u4e0a\u786e\u8ba4\u5ea7\u4f4d\uff0c\u518d\u8fdb\u5165\u64cd\u4f5c\u9636\u6bb5\u3002"
        : "Confirm seats on the table before actions."
      : controller.status === "in-progress" && !controller.actingPlayerId
        ? isZh
          ? "\u5f53\u524d\u6ca1\u6709\u53ef\u884c\u52a8\u73a9\u5bb6\u3002"
          : "No actionable player at the moment."
        : null,
    supplementaryContent: seatSelectionContent,
    showActionPanel: !seatSelectionMode
  };
}
