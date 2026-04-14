"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { parseCardCode } from "@/components/cards/sim-poker-card";

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
          const parsed = parseCardCode(card);
          const toneClass = parsed?.isRed ? "text-[#dc2626]" : "text-[#111827]";

          return (
            <div
              key={`my-hole-${index}`}
              className={[
                "relative h-14 w-10 overflow-hidden rounded-md border shadow-[0_6px_14px_rgba(2,6,23,0.35)]",
                parsed
                  ? "border-white/80 bg-gradient-to-b from-white to-slate-100"
                  : "border-stitch-outlineVariant/40 bg-stitch-surfaceContainerHighest/80"
              ].join(" ")}
              aria-label={
                parsed
                  ? isZh
                    ? `${parsed.suitNameZh}${parsed.displayRank}`
                    : `${parsed.displayRank} of ${parsed.suitNameEn}`
                  : isZh
                    ? "\u7a7a\u724c\u4f4d"
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
                  {card ?? ""}
                </span>
              )}
            </div>
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
