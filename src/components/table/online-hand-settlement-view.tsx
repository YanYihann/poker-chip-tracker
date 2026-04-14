"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import type { TableSeatPlayer } from "@/components/player/types";
import { SimPokerCard } from "@/components/cards/sim-poker-card";
import { PokerTable } from "@/components/table/poker-table";
import type { RoomState } from "@/features/rooms/api";

type SettlementEntry = NonNullable<NonNullable<RoomState["game"]>["lastSettlement"]>["entries"][number];

type OnlineHandSettlementViewProps = {
  players: TableSeatPlayer[];
  potLabel: string;
  boardCards: string[];
  handKey: string;
  settlementEntries: SettlementEntry[];
};

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

export function OnlineHandSettlementView({
  players,
  potLabel,
  boardCards,
  handKey,
  settlementEntries
}: OnlineHandSettlementViewProps) {
  const { isZh } = useLanguage();
  const rankLabels = HAND_RANK_LABELS[isZh ? "zh" : "en"];

  return (
    <section className="space-y-3">
      <article className="rounded-2xl border border-stitch-primary/30 bg-stitch-primary/10 px-3 py-2 text-xs text-stitch-primary">
        {isZh ? "本手已自动完成牌力结算。" : "This hand has been auto settled."}
      </article>

      <PokerTable
        players={players}
        potLabel={potLabel}
        boardCards={boardCards}
        streetLabel={isZh ? "结算" : "Settled"}
        statusLabel={isZh ? "本手完成" : "Hand Complete"}
        street="showdown"
        handKey={handKey}
      />

      <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4">
        <p className="text-[11px] uppercase tracking-[0.12em] text-stitch-onSurfaceVariant">
          {isZh ? "本手结果" : "Hand Results"}
        </p>
        <div className="mt-3 space-y-2">
          {settlementEntries.map((entry) => {
            const handRankLabel = entry.handRankCode
              ? rankLabels[entry.handRankCode]
              : isZh
                ? "未形成牌型"
                : "No Ranked Hand";

            return (
              <article
                key={`settled-entry-${entry.userId}`}
                className="rounded-xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainerHigh p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stitch-onSurface">{entry.displayName}</p>
                  <p
                    className={[
                      "text-sm font-semibold",
                      entry.netChange >= 0 ? "text-stitch-mint" : "text-stitch-tertiary"
                    ].join(" ")}
                  >
                    {entry.netChange >= 0 ? "+" : ""}
                    {entry.netChange}
                  </p>
                </div>
                <p className="mt-1 text-xs text-stitch-onSurfaceVariant">{handRankLabel}</p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.bestFiveCards.length > 0 ? (
                    entry.bestFiveCards.map((card, index) => (
                      <SimPokerCard
                        key={`${entry.userId}-${card}-${index}`}
                        card={card}
                        size="xs"
                        isZh={isZh}
                      />
                    ))
                  ) : (
                    <span className="text-xs text-stitch-onSurfaceVariant">
                      {isZh ? "无可展示最佳五张" : "No best-five cards to display"}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </article>
    </section>
  );
}
