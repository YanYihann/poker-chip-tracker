"use client";

import { useMemo } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import type { RoomState } from "@/features/rooms/api";

type OnlineTablePlaceholdersProps = {
  mode: "online" | "local";
  game: RoomState["game"] | null;
  roomStatus: RoomState["room"]["status"] | null;
  meUserId?: string | null;
  myHoleCards: string[];
  boardCards: string[];
};

type SettlementEntry = NonNullable<NonNullable<RoomState["game"]>["lastSettlement"]>["entries"][number];

const HAND_RANK_LABELS = {
  zh: {
    "high-card": "高牌",
    "one-pair": "一对",
    "two-pair": "两对",
    "three-of-a-kind": "三条",
    straight: "顺子",
    flush: "同花",
    "full-house": "葫芦",
    "four-of-a-kind": "四条",
    "straight-flush": "同花顺"
  },
  en: {
    "high-card": "High Card",
    "one-pair": "One Pair",
    "two-pair": "Two Pair",
    "three-of-a-kind": "Trips",
    straight: "Straight",
    flush: "Flush",
    "full-house": "Full House",
    "four-of-a-kind": "Quads",
    "straight-flush": "Straight Flush"
  }
} as const;

const SUIT_META = {
  S: { symbol: "♠", zh: "黑桃", en: "Spades", isRed: false },
  H: { symbol: "♥", zh: "红桃", en: "Hearts", isRed: true },
  D: { symbol: "♦", zh: "方片", en: "Diamonds", isRed: true },
  C: { symbol: "♣", zh: "梅花", en: "Clubs", isRed: false }
} as const;

type SuitCode = keyof typeof SUIT_META;

type ParsedCard = {
  rank: string;
  suit: SuitCode;
  displayRank: string;
  symbol: string;
  suitNameZh: string;
  suitNameEn: string;
  isRed: boolean;
};

function parseCardCode(card: string | null): ParsedCard | null {
  if (!card || card.length < 2) {
    return null;
  }

  const normalized = card.toUpperCase().trim();
  const rankCode = normalized[0];
  const suitCode = normalized[1] as SuitCode;

  if (!(suitCode in SUIT_META)) {
    return null;
  }

  const displayRank = rankCode === "T" ? "10" : rankCode;
  const suitMeta = SUIT_META[suitCode];

  return {
    rank: rankCode,
    suit: suitCode,
    displayRank,
    symbol: suitMeta.symbol,
    suitNameZh: suitMeta.zh,
    suitNameEn: suitMeta.en,
    isRed: suitMeta.isRed
  };
}

function getBoardRevealCount(game: RoomState["game"] | null, boardCards: string[]): number {
  if (boardCards.length > 0) {
    return Math.max(0, Math.min(5, boardCards.length));
  }

  if (!game) {
    return 0;
  }

  if (game.street === "flop") {
    return 3;
  }

  if (game.street === "turn") {
    return 4;
  }

  if (game.street === "river" || game.street === "showdown") {
    return 5;
  }

  return 0;
}

export function OnlineTablePlaceholders({
  mode,
  game,
  roomStatus,
  meUserId = null,
  myHoleCards,
  boardCards
}: OnlineTablePlaceholdersProps) {
  const { isZh } = useLanguage();

  const boardRevealCount = useMemo(() => getBoardRevealCount(game, boardCards), [boardCards, game]);

  const showdownLabel = useMemo(() => {
    if (!game) {
      return isZh
        ? "等待牌局开始后同步摊牌状态。"
        : "Showdown state will sync after the hand starts.";
    }

    if (game.status === "showdown") {
      return isZh
        ? mode === "online"
          ? "摊牌阶段中，等待房主执行自动牌力结算。"
          : "摊牌阶段中，等待房主结算。"
        : mode === "online"
          ? "In showdown phase, waiting for host auto settlement."
          : "In showdown phase, waiting for host settlement.";
    }

    if (game.status === "settled") {
      return isZh
        ? "本手已结算，等待下一手开始。"
        : "Hand settled. Waiting for the next hand.";
    }

    return isZh ? "当前未进入摊牌。" : "Showdown has not started for this hand.";
  }, [game, isZh]);

  const settlementEntries = game?.lastSettlement?.entries ?? [];
  const mySettlementEntry = useMemo<SettlementEntry | null>(() => {
    if (!meUserId || settlementEntries.length === 0) {
      return null;
    }

    return settlementEntries.find((entry) => entry.userId === meUserId) ?? null;
  }, [meUserId, settlementEntries]);

  const myBestFiveCardSet = useMemo(
    () => new Set((mySettlementEntry?.bestFiveCards ?? []).map((card) => card.toUpperCase())),
    [mySettlementEntry?.bestFiveCards]
  );

  return (
    <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-stitch-onSurfaceVariant">
        {mode === "local"
          ? isZh
            ? "本地同步模式状态"
            : "Local Synced Mode State"
          : isZh
            ? "在线发牌状态"
            : "Online Dealing State"}
      </p>

      <div className="mt-3 grid gap-3">
        <section className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
          <p className="text-xs font-semibold text-stitch-onSurface">
            {mode === "local"
              ? isZh
                ? "底牌（本地同步模式不发牌）"
                : "Hole Cards (No Dealing in Local Synced Mode)"
              : isZh
                ? "我的底牌（仅自己可见）"
                : "My Hole Cards (Private)"}
          </p>
          <div className="mt-2 flex gap-2">
            {Array.from({ length: 2 }, (_, index) => {
              const card = myHoleCards[index] ?? null;
              const parsed = parseCardCode(card);
              const highlighted = !!card && myBestFiveCardSet.has(card.toUpperCase());
              const toneClass =
                parsed?.isRed
                  ? "text-[#dc2626]"
                  : "text-[#111827]";
              const fallbackLabel = card ?? "";

              return (
                <div
                  key={`hole-card-${index + 1}`}
                  className={[
                    "relative h-14 w-10 overflow-hidden rounded-md border shadow-[0_6px_14px_rgba(2,6,23,0.35)]",
                    parsed
                      ? highlighted
                        ? "border-amber-400/80 bg-gradient-to-b from-white to-slate-100"
                        : "border-white/80 bg-gradient-to-b from-white to-slate-100"
                      : "border-stitch-outlineVariant/40 bg-stitch-surfaceContainerHighest/80"
                  ].join(" ")}
                  aria-label={
                    parsed
                      ? isZh
                        ? `${parsed.suitNameZh}${parsed.displayRank}`
                        : `${parsed.displayRank} of ${parsed.suitNameEn}`
                      : isZh
                        ? "空牌位"
                        : "Empty card slot"
                  }
                >
                  {parsed ? (
                    <>
                      <span
                        className={[
                          "absolute left-1 top-0.5 text-[9px] font-bold leading-none",
                          toneClass
                        ].join(" ")}
                      >
                        {parsed.displayRank}
                      </span>
                      <span
                        className={[
                          "grid h-full w-full place-items-center text-base font-black",
                          toneClass
                        ].join(" ")}
                      >
                        {parsed.symbol}
                      </span>
                    </>
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[10px] font-semibold tracking-[0.03em] text-stitch-onSurfaceVariant">
                      {fallbackLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
            {isZh
              ? mode === "local"
                ? "本地同步模式不发牌，仅记录筹码动作与位置轮换。"
                : "服务端仅向当前用户返回自己的两张底牌。"
              : mode === "local"
                ? "Local synced mode skips dealing and only tracks chips/actions/positions."
                : "Server only returns your own two private hole cards."}
          </p>
        </section>

        <section className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
          <p className="text-xs font-semibold text-stitch-onSurface">
            {mode === "local"
              ? isZh
                ? "公共牌（本地同步模式不翻牌）"
                : "Board Cards (No Board Reveal in Local Synced Mode)"
              : isZh
                ? "公共牌（按街道公开）"
                : "Board Cards (Street-Revealed)"}
          </p>
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: 5 }, (_, index) => {
              const isRevealed = index < boardRevealCount;
              const card = boardCards[index] ?? null;
              const parsed = isRevealed ? parseCardCode(card) : null;
              const highlighted =
                isRevealed && !!card && myBestFiveCardSet.has(card.toUpperCase());
              const toneClass =
                parsed?.isRed
                  ? "text-[#dc2626]"
                  : "text-[#111827]";

              return (
                <div
                  key={`board-card-${index + 1}`}
                  className={[
                    "relative h-12 w-8 overflow-hidden rounded-md border shadow-[0_5px_12px_rgba(2,6,23,0.32)]",
                    !isRevealed
                      ? "border-sky-300/45 bg-[linear-gradient(135deg,#0f766e_0%,#075985_100%)]"
                      : highlighted
                        ? "border-amber-400/85 bg-gradient-to-b from-white to-slate-100"
                        : "border-white/80 bg-gradient-to-b from-white to-slate-100"
                  ].join(" ")}
                  aria-label={
                    !isRevealed
                      ? isZh
                        ? "未翻开的公共牌"
                        : "Hidden board card"
                      : parsed
                        ? isZh
                          ? `${parsed.suitNameZh}${parsed.displayRank}`
                          : `${parsed.displayRank} of ${parsed.suitNameEn}`
                        : isZh
                          ? "未知牌面"
                          : "Unknown card"
                  }
                >
                  {!isRevealed ? (
                    <div className="grid h-full w-full place-items-center text-[10px] font-black text-white/90">
                      ★
                    </div>
                  ) : parsed ? (
                    <>
                      <span
                        className={[
                          "absolute left-1 top-0.5 text-[8px] font-bold leading-none",
                          toneClass
                        ].join(" ")}
                      >
                        {parsed.displayRank}
                      </span>
                      <span
                        className={[
                          "grid h-full w-full place-items-center text-sm font-black",
                          toneClass
                        ].join(" ")}
                      >
                        {parsed.symbol}
                      </span>
                    </>
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[10px] font-semibold text-stitch-onSurfaceVariant">
                      ?
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
            {isZh
              ? mode === "local"
                ? "本地同步模式保持不发牌，只同步下注流程。"
                : "翻牌前 0 张、翻牌 3 张、转牌 4 张、河牌 5 张。"
              : mode === "local"
                ? "Local synced mode keeps board hidden and only syncs betting flow."
                : "Preflop 0, flop 3, turn 4, river 5 public cards."}
          </p>
        </section>

        <section className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
          <p className="text-xs font-semibold text-stitch-onSurface">
            {isZh ? "摊牌状态" : "Showdown State"}
          </p>
          <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">{showdownLabel}</p>
          {roomStatus && !game ? (
            <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
              {isZh ? `当前房间状态：${roomStatus}` : `Current room status: ${roomStatus}`}
            </p>
          ) : null}
        </section>

        {mode === "online" && game?.status === "settled" && settlementEntries.length > 0 ? (
          <section className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
            <p className="text-xs font-semibold text-stitch-onSurface">
              {isZh ? "自动牌力结算结果" : "Auto Evaluated Showdown"}
            </p>
            <div className="mt-2 space-y-2">
              {settlementEntries.map((entry) => {
                const handLabel = entry.handRankCode
                  ? HAND_RANK_LABELS[isZh ? "zh" : "en"][entry.handRankCode]
                  : isZh
                    ? "未摊牌"
                    : "No Showdown Hand";

                return (
                  <article
                    key={`settlement-${entry.userId}`}
                    className="rounded-lg border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHighest/70 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-stitch-onSurface">
                        {entry.displayName}
                      </p>
                      <p
                        className={[
                          "text-[11px] font-semibold",
                          entry.netChange >= 0 ? "text-stitch-mint" : "text-stitch-tertiary"
                        ].join(" ")}
                      >
                        {entry.netChange >= 0 ? "+" : ""}
                        {entry.netChange}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] text-stitch-onSurfaceVariant">{handLabel}</p>
                    {entry.bestFiveCards.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.bestFiveCards.map((card) => (
                          <span
                            key={`${entry.userId}-${card}`}
                            className="rounded-md border border-stitch-secondary/45 bg-stitch-secondary/15 px-1.5 py-0.5 text-[10px] font-semibold text-stitch-secondary"
                          >
                            {card}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}
