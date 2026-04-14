"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { SimPokerCard } from "@/components/cards/sim-poker-card";

type OnlineMyHoleCardsProps = {
  cards: string[];
};

export function OnlineMyHoleCards({ cards }: OnlineMyHoleCardsProps) {
  const { isZh } = useLanguage();

  return (
    <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-stitch-onSurfaceVariant">
        {isZh ? "我的底牌" : "My Hole Cards"}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {Array.from({ length: 2 }, (_, index) => (
          <SimPokerCard
            key={`my-hole-${index}`}
            card={cards[index] ?? null}
            hidden={!cards[index]}
            size="md"
            isZh={isZh}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
        {isZh
          ? "仅你自己可见；公共牌已在牌桌中央显示。"
          : "Visible only to you; board cards are shown at table center."}
      </p>
    </article>
  );
}
