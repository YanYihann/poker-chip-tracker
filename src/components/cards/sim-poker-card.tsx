"use client";

import { cn } from "@/lib/cn";

const SUIT_META = {
  S: { symbol: "\u2660", isRed: false, zh: "\u9ed1\u6843", en: "Spades" },
  H: { symbol: "\u2665", isRed: true, zh: "\u7ea2\u6843", en: "Hearts" },
  D: { symbol: "\u2666", isRed: true, zh: "\u65b9\u5757", en: "Diamonds" },
  C: { symbol: "\u2663", isRed: false, zh: "\u6885\u82b1", en: "Clubs" }
} as const;

type SuitCode = keyof typeof SUIT_META;

export type ParsedCard = {
  displayRank: string;
  symbol: string;
  isRed: boolean;
  suitNameZh: string;
  suitNameEn: string;
};

const SIZE_CLASS = {
  xs: {
    frame: "h-10 w-7 rounded-md",
    rank: "text-[8px] sm:text-[9px]",
    center: "text-sm sm:text-base"
  },
  sm: {
    frame: "h-12 w-8 rounded-md",
    rank: "text-[9px] sm:text-[10px]",
    center: "text-base sm:text-lg"
  },
  md: {
    frame: "h-14 w-10 rounded-md",
    rank: "text-[10px] sm:text-[11px]",
    center: "text-lg sm:text-xl"
  }
} as const;

type SimPokerCardProps = {
  card: string | null | undefined;
  size?: keyof typeof SIZE_CLASS;
  hidden?: boolean;
  className?: string;
  isZh?: boolean;
};

export function parseCardCode(card: string | null | undefined): ParsedCard | null {
  if (!card) {
    return null;
  }

  const normalized = card.toUpperCase().trim();
  const matched = /^([2-9TJQKA])([SHDC])$/.exec(normalized);

  if (!matched) {
    return null;
  }

  const rankCode = matched[1] as "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";
  const suitCode = matched[2] as SuitCode;
  const suit = SUIT_META[suitCode];

  return {
    displayRank: rankCode === "T" ? "10" : rankCode,
    symbol: suit.symbol,
    isRed: suit.isRed,
    suitNameZh: suit.zh,
    suitNameEn: suit.en
  };
}

export function SimPokerCard({
  card,
  size = "sm",
  hidden = false,
  className,
  isZh = true
}: SimPokerCardProps) {
  const parsed = parseCardCode(card);
  const toneClass = parsed?.isRed ? "text-[#bf1f2f]" : "text-[#1a1c21]";
  const sizeClass = SIZE_CLASS[size];
  const showBack = hidden || !parsed;
  const ariaLabel = showBack
    ? isZh
      ? "\u672a\u7ffb\u5f00\u6251\u514b\u724c"
      : "Hidden poker card"
    : isZh
      ? `${parsed.suitNameZh}${parsed.displayRank}`
      : `${parsed.displayRank} of ${parsed.suitNameEn}`;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border shadow-[0_5px_12px_rgba(2,6,23,0.32)]",
        sizeClass.frame,
        showBack
          ? "border-sky-300/45 bg-[linear-gradient(135deg,#0f766e_0%,#075985_100%)]"
          : "border-white/80 bg-gradient-to-b from-white to-slate-100",
        className
      )}
      aria-label={ariaLabel}
    >
      {showBack ? (
        <div className="grid h-full w-full place-items-center text-[10px] font-black text-white/90">
          {"\u2605"}
        </div>
      ) : (
        <>
          <span
            className={cn(
              "absolute left-1 top-0.5 font-bold leading-none",
              sizeClass.rank,
              toneClass
            )}
          >
            {parsed.displayRank}
          </span>
          <span
            className={cn(
              "grid h-full w-full place-items-center font-black",
              sizeClass.center,
              toneClass
            )}
          >
            {parsed.symbol}
          </span>
        </>
      )}
    </div>
  );
}
