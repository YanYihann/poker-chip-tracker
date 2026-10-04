"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SessionEndConfirmation } from "@/components/settlement/session-end-confirmation";

import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import type { TableSeatPlayer } from "@/components/player/types";
import { buildActionOrder, assignPositions } from "@/features/table/rules";
import { endLocalSession, startLocalHand, useTableController } from "@/features/table/useTableController";
import { createLocalLedger, summarizeLocalSession, type SessionSummary } from "@/features/settlement/session-summary";
import { useArchiveStore } from "@/store/useArchiveStore";
import type { TableModeAdapter } from "@/features/table/mode/types";
import { useBettingStore } from "@/store/useBettingStore";
import { useHandStore } from "@/store/useHandStore";
import { useMotionStore } from "@/store/useMotionStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useSettlementStore } from "@/store/useSettlementStore";
import type { Player, TableActionType } from "@/types/domain";
import { fetchCurrentUser, type AuthUser } from "@/features/auth/api";

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

function startLocalSession(owner?: { userId: string; playerId: string }): boolean {
  const sessionStore = useSessionStore.getState();
  const handStore = useHandStore.getState();
  const bettingStore = useBettingStore.getState();
  const settlementStore = useSettlementStore.getState();

  const players = [...sessionStore.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const seatOrder = players.map((_, index) => index);

  if (players.length === 0) {
    return false;
  }

  const dealerSeatIndex = seatOrder[0] ?? 0;
  const reseatedPlayers: Player[] = players.map((player, index) => ({
    ...player,
    seatIndex: seatOrder[index],
    isHero: owner ? player.id === owner.playerId : player.isHero,
    currentBet: 0,
    totalInvestedThisHand: 0,
    status: player.stack <= 0 ? "all-in" : "waiting"
  }));

  const withPositions = assignPositions(reseatedPlayers, dealerSeatIndex);
  const actionOrder = buildActionOrder(withPositions, dealerSeatIndex, "preflop");
  const actingPlayerId = actionOrder[0] ?? null;
  const withActingStatus = setActingStatus(withPositions, actingPlayerId);

  sessionStore.applySnapshot({
    sessionId: `local-${crypto.randomUUID()}`,
    sessionName: sessionStore.sessionName,
    startedAtIso: new Date().toISOString(),
    dealerSeatIndex,
    players: withActingStatus,
    ledger: { ...createLocalLedger(withActingStatus), owner }
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
  const [setupMode, setSetupMode] = useState(() => !useSessionStore.getState().ledger);
  const [account, setAccount] = useState<AuthUser | null>(null);
  const [mySeat, setMySeat] = useState("player-1");
  useEffect(() => {
    let active = true;
    void fetchCurrentUser().then((user) => { if (active) setAccount(user); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const ownerPlayerId = controller.players.some((player) => player.id === mySeat) ? mySeat : controller.players[0]?.id;
  const [amountInput, setAmountInput] = useState("400");
  const ledger = useSessionStore((state) => state.ledger);
  const archivedEntries = useArchiveStore((state) => state.entries);
  const [sessionReportOpen, setSessionReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SessionSummary | null>(null);
  const [endConfirmationOpen, setEndConfirmationOpen] = useState(false);
  const finished = Boolean(ledger?.endedAtIso);
  const lastSummary = useMemo(() => ledger?.endedAtIso
    ? summarizeLocalSession({ ...useSessionStore.getState(), ledger })
    : archivedEntries.find((entry) => entry.summary)?.summary ?? null, [ledger, archivedEntries]);
  const actingPlayer = controller.players.find((p) => p.id === controller.actingPlayerId);
  const maxWager = (actingPlayer?.stack ?? 0) + (actingPlayer?.currentBet ?? 0);
  const amountValid = amountInput !== "" && Number.isSafeInteger(Number(amountInput)) && Number(amountInput) >= controller.minRaiseTo && Number(amountInput) <= maxWager;

  useEffect(() => {
    const amount = String(controller.minRaiseTo);
    setAmountInput(amount);
    controller.setActionAmount(Number(amount));
  }, [controller.minRaiseTo, controller.actingPlayerId]);

  const players = useMemo<TableSeatPlayer[]>(() => {
    return [...controller.players].sort((a, b) => a.seatIndex - b.seatIndex).map((player, index) => ({
      id: player.id,
      name: player.name,
      seatIndex: index,
      seatCount: controller.playerCount,
      avatarUrl: player.avatar ?? null,
      stackLabel: formatCurrency(player.stack, locale),
      betLabel: !setupMode && player.currentBet > 0 ? `${isZh ? "注" : "Bet"} ${formatCurrency(player.currentBet, locale)}` : undefined,
      positionLabel: setupMode ? undefined : player.position,
      isHero: player.isHero,
      isActive: !setupMode && player.id === controller.actingPlayerId,
      status: setupMode ? "waiting" : player.status
    }));
  }, [controller.actingPlayerId, controller.playerCount, controller.players, isZh, locale, setupMode]);

  const setupContent =
    setupMode ? (
      <article className="local-setup rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4">
        <p className="text-sm font-semibold text-stitch-onSurface">
          {isZh ? "牌局设置" : "Game setup"}
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
        {account && <label className="mt-4 block text-sm text-stitch-onSurfaceVariant">
          {isZh ? "我的座位" : "My seat"}
          <select className="mt-1 h-11 w-full rounded-xl bg-stitch-surfaceContainerHigh px-3 text-stitch-onSurface" value={ownerPlayerId ?? ""} onChange={(event) => setMySeat(event.target.value)}>
            {controller.players.map((player, index) => <option key={player.id} value={player.id}>{index + 1} · {player.name}</option>)}
          </select>
          <small className="mt-1 block">{isZh ? `此座位的盈亏计入 ${account.username}。` : `This seat’s P/L is recorded for ${account.username}.`}</small>
        </label>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-stitch-primary px-3 py-2 text-xs font-semibold text-stitch-onPrimary disabled:opacity-50"
            disabled={controller.resumeAvailable || controller.players.some((p) => !p.name.trim() || p.stack < 1)}
            onClick={() => {
              if (startLocalSession(account && ownerPlayerId ? { userId: account.id, playerId: ownerPlayerId } : undefined)) {
                setSetupMode(false);
              }
            }}
          >
            {isZh ? "开始牌局" : "Start game"}
          </button>
        </div>
      </article>
    ) : finished ? (
      <article className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant">
        <button
          type="button"
          className="text-link font-semibold"
          disabled={controller.status !== "settlement-confirmed"}
          onClick={() => {
            const session = useSessionStore.getState();
            session.applySnapshot({ ...session, sessionId: `local-${crypto.randomUUID()}`, ledger: undefined,
              players: session.players.map((player) => ({ ...player, stack: ledger?.startingPlayers.find((p) => p.id === player.id)?.stack ?? 2000, currentBet: 0, totalInvestedThisHand: 0, status: "waiting" })) });
            useHandStore.getState().resetForNewHand([]);
            useBettingStore.getState().resetForNewHand();
            useSettlementStore.getState().resetForNewHand();
            useMotionStore.getState().clearAll();
            setSetupMode(true);
          }}
        >
          {isZh ? "新牌局" : "New session"}
        </button>
      </article>
    ) : null;

  const topActionHint = useMemo(() => {
    if (setupMode) {
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
  }, [controller.lastActionPlayerName, controller.lastActionType, isZh, locale, setupMode]);

  return {
    mode: "local",
    musicScene: setupMode || finished ? "lobby" : "table",
    title: isZh ? "\u672c\u5730\u6a21\u5f0f\u724c\u684c" : "Local Mode Table",
    backHref: "/online",
    playerCount: controller.playerCount,
    onPlayerCountChange: setupMode && !controller.resumeAvailable ? controller.setPlayerCount : undefined,
    players,
    tableCenterContent: setupMode ? <>
      <p>{controller.playerCount} {isZh ? "人局" : "players"}</p>
      <span>{isZh ? "盲注" : "Blinds"} 100 / 200</span>
    </> : undefined,
    potLabel: formatCurrency(controller.pot, locale),
    boardCards: null,
    street: controller.street,
    streetLabel: STREET_LABELS[locale][controller.street],
    statusLabel: STATUS_LABELS[locale][controller.status],
    handKey: `local-${controller.playerCount}-${controller.sessionName}`,
    status: controller.status,
    actingPlayerId: setupMode ? null : controller.actingPlayerId,
    mainActions: setupMode || finished ? [] : controller.mainActions.map((action) => action.id === "bet" || action.id === "raise" ? {...action,disabled:!amountValid} : action),
    utilityActions: setupMode ? [] : finished ? [{ id: "session-report", label: isZh ? "查看最终结算" : "View settlement", onPress: () => { setSelectedReport(lastSummary); setSessionReportOpen(true); } }] : [
      ...controller.utilityActions.map((action) => ({ ...action, label: isZh ? action.label : ({ undo: "Undo", "next-hand": "Next hand", reopen: "Reopen hand", "edit-hand": "Edit hand", "end-hand": "End hand" }[action.id]) })),
      { id: "end-session", label: isZh ? "结束牌局" : "End session", disabled: controller.status !== "settlement-confirmed", onPress: () => setEndConfirmationOpen(true) }
    ],
    canOpenSettlement: setupMode || finished ? false : controller.canOpenSettlement,
    sessionSettlement: { isOpen: sessionReportOpen, summary: selectedReport, onClose: () => setSessionReportOpen(false) },
    onOpenSettlement: setupMode ? () => undefined : controller.openSettlement,
    amountControl: !setupMode && controller.mainActions.some((a) => a.id === "bet" || a.id === "raise") ? {
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
    settlement: setupMode
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
      onResume: () => {controller.resumeSession(); setSetupMode(false);},
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
    statusHint: !setupMode && controller.actingPlayerId ? `${isZh ? "轮到" : "Action on"} ${controller.players.find((p) => p.id === controller.actingPlayerId)?.name} · ${isZh ? "需跟注" : "To call"} ${controller.toCall}` : setupMode
      ? null
      : controller.status === "in-progress" && !controller.actingPlayerId
        ? isZh
          ? "\u5f53\u524d\u6ca1\u6709\u53ef\u884c\u52a8\u73a9\u5bb6\u3002"
          : "No actionable player at the moment."
        : null,
    topActionHint,
    supplementaryContent: <><SessionEndConfirmation isOpen={endConfirmationOpen} onCancel={() => setEndConfirmationOpen(false)} onConfirm={() => {
      setEndConfirmationOpen(false);
      const summary = endLocalSession();
      if (summary) { setSelectedReport(summary); setSessionReportOpen(true); }
    }} />{setupContent}{setupMode && lastSummary ? <article className="local-session-history-entry">
      <button type="button" onClick={() => { setSelectedReport(lastSummary); setSessionReportOpen(true); }}>{isZh ? "上场结算" : "Previous settlement"}</button>
      <Link href="/history/local">{isZh ? "本地历史" : "Local history"}</Link>
    </article> : finished ? <article className="local-session-history-entry"><Link href="/history/local">{isZh ? "本地历史" : "Local history"}</Link></article> : null}</>,
    showActionPanel: !setupMode
  };
}
