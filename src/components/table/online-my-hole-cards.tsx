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
        {isZh ? "\u6211\u7684\u5e95\u724c" : "My Hole Cards"}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {Array.from({ length: 2 }, (_, index) => {
          const card = cards[index] ?? null;

          return (
            <SimPokerCard
              key={`my-hole-${index}`}
              card={card}
              size="md"
              hidden={!card}
              isZh={isZh}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
        {isZh
          ? "\u4ec5\u4f60\u81ea\u5df1\u53ef\u89c1\uff1b\u516c\u5171\u724c\u5df2\u5728\u724c\u684c\u4e2d\u592e\u663e\u793a\u3002"
          : "Visible only to you; board cards are shown at table center."}
      </p>
    </article>
  );
}
