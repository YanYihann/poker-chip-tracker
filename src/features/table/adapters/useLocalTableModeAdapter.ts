"use client";

import { useMemo } from "react";

import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import { useTableController } from "@/features/table/useTableController";
import type { TableModeAdapter } from "@/features/table/mode/types";

const STREET_LABELS: Record<AppLocale, Record<TableModeAdapter["street"], string>> = {
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

const STATUS_LABELS: Record<AppLocale, Record<TableModeAdapter["status"], string>> = {
  zh: {
    "in-progress": "进行中",
    "pre-settlement": "待结算",
    "settlement-confirmed": "已结算"
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

export function useLocalTableModeAdapter(): TableModeAdapter {
  const controller = useTableController();
  const { locale, isZh } = useLanguage();

  const players = useMemo(
    () =>
      controller.players.map((player) => ({
        id: player.id,
        name: player.name,
        avatarUrl: player.avatar ?? null,
        stackLabel: formatCurrency(player.stack, locale),
        positionLabel: player.position,
        isHero: player.isHero,
        isActive: player.id === controller.actingPlayerId,
        status: player.status
      })),
    [controller.actingPlayerId, controller.players, locale]
  );

  return {
    mode: "local",
    title: isZh ? "本地模式牌桌" : "Local Mode Table",
    backHref: "/",
    playerCount: controller.playerCount,
    onPlayerCountChange: controller.setPlayerCount,
    players,
    potLabel: formatCurrency(controller.pot, locale),
    street: controller.street,
    streetLabel: STREET_LABELS[locale][controller.street],
    statusLabel: STATUS_LABELS[locale][controller.status],
    handKey: `local-${controller.playerCount}-${controller.sessionName}`,
    status: controller.status,
    actingPlayerId: controller.actingPlayerId,
    mainActions: controller.mainActions,
    utilityActions: controller.utilityActions,
    canOpenSettlement: controller.canOpenSettlement,
    onOpenSettlement: controller.openSettlement,
    amountControl: null,
    settlement: {
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
              ? "检测到本地快照，选择恢复或丢弃后将继续自动保存。"
              : "A local snapshot was detected. Resume or discard it to continue autosave."
          }
        : null,
    statusHint:
      controller.status === "in-progress" && !controller.actingPlayerId
        ? isZh
          ? "当前没有可行动玩家。"
          : "No actionable player at the moment."
        : null,
    showActionPanel: true
  };
}
