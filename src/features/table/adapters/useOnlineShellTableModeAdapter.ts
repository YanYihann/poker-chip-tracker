"use client";

import { useMemo, useState } from "react";

import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import type { TableSeatPlayer } from "@/components/player/types";
import type { TableModeAdapter } from "@/features/table/mode/types";
import { buildPlaceholderPlayers, clampPlayerCount } from "@/lib/table-layout";

const STREET_LABELS: Record<AppLocale, string> = {
  zh: "翻牌前",
  en: "Pre-flop"
};

const STATUS_LABELS: Record<AppLocale, string> = {
  zh: "在线模式占位",
  en: "Online Mode Placeholder"
};

export function useOnlineShellTableModeAdapter(): TableModeAdapter {
  const { locale, isZh } = useLanguage();
  const [playerCount, setPlayerCount] = useState(6);

  const players = useMemo(
    () =>
      buildPlaceholderPlayers(playerCount).map((player, index) => {
        const status: TableSeatPlayer["status"] = index === 0 ? "acting" : "waiting";

        return {
          ...player,
          isActive: index === 0,
          status
        };
      }),
    [playerCount]
  );

  return {
    mode: "online",
    title: isZh ? "在线模式（壳）" : "Online Mode (Shell)",
    backHref: "/",
    playerCount,
    onPlayerCountChange: (nextCount) => setPlayerCount(clampPlayerCount(nextCount)),
    players,
    potLabel: "$0",
    street: "preflop",
    streetLabel: STREET_LABELS[locale],
    statusLabel: STATUS_LABELS[locale],
    handKey: `online-shell-${playerCount}`,
    status: "in-progress",
    actingPlayerId: null,
    mainActions: [],
    utilityActions: [],
    canOpenSettlement: false,
    onOpenSettlement: () => undefined,
    amountControl: null,
    settlement: null,
    banner: {
      tone: "info",
      message: isZh
        ? "这是 Phase 1 的在线模式入口壳层：仅完成模式分层与共享界面接线，尚未接入认证与实时对战。"
        : "This is the Phase 1 online shell entry: mode layering and shared UI wiring only, without auth or realtime gameplay yet."
    },
    statusHint: isZh
      ? "下一阶段会把该适配器接到在线房间状态和网络传输层。"
      : "The next phase will connect this adapter to online room state and transport.",
    showActionPanel: true
  };
}
