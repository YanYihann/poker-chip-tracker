"use client";

import { cn } from "@/lib/cn";

const SUIT_META = {
  S: { symbol: "♠", isRed: false, zh: "黑桃", en: "Spades" },
  H: { symbol: "♥", isRed: true, zh: "红桃", en: "Hearts" },
  D: { symbol: "♦", isRed: true, zh: "方片", en: "Diamonds" },
  C: { symbol: "♣", isRed: false, zh: "梅花", en: "Clubs" }
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
    frame: "h-10 w-7 rounded-[8px]",
    inner: "rounded-[7px]",
    cornerRank: "text-[7px]",
    cornerSuit: "text-[8px]",
    centerSuit: "text-[17px]"
  },
  sm: {
    frame: "h-12 w-8 rounded-[9px]",
    inner: "rounded-[8px]",
    cornerRank: "text-[8px]",
    cornerSuit: "text-[9px]",
    centerSuit: "text-[19px]"
  },
  md: {
    frame: "h-14 w-10 rounded-[10px]",
    inner: "rounded-[9px]",
    cornerRank: "text-[10px]",
    cornerSuit: "text-[11px]",
    centerSuit: "text-[22px]"
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
  const toneClass = parsed?.isRed ? "text-[#be2430]" : "text-[#1a1f27]";
  const sizeClass = SIZE_CLASS[size];
  const ariaLabel = hidden
    ? isZh
      ? "未翻开扑克牌"
      : "Hidden poker card"
    : parsed
      ? isZh
        ? `${parsed.suitNameZh}${parsed.displayRank}`
        : `${parsed.displayRank} of ${parsed.suitNameEn}`
      : isZh
        ? "未知牌面"
        : "Unknown card";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border border-black/45 shadow-[0_5px_12px_rgba(0,0,0,0.45)]",
        sizeClass.frame,
        className
      )}
      aria-label={ariaLabel}
    >
      {hidden || !parsed ? (
        <div className={cn("absolute inset-0 border border-[#8d5f27] bg-[radial-gradient(circle_at_52%_26%,#b91f24_0%,#7f1017_38%,#4e090d_84%,#370507_100%)]", sizeClass.inner)}>
          <div className="absolute inset-[2px] rounded-[5px] border border-[#f0c267]/78" />
          <div className="absolute inset-[4px] rounded-[4px] border border-[#6e130f] bg-[repeating-linear-gradient(45deg,rgba(255,209,123,0.13)_0px,rgba(255,209,123,0.13)_2px,rgba(90,8,10,0.08)_2px,rgba(90,8,10,0.08)_8px)]" />
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border border-[#e7b85d]/85 bg-[radial-gradient(circle,#7d0f15_15%,#5f0a10_100%)] shadow-[0_0_0_1px_rgba(43,4,6,0.55)]" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e7b85d]/80 bg-[#6e0f14]" />
          <div className="absolute inset-0 opacity-35 [background:radial-gradient(circle_at_1px_1px,rgba(15,7,1,0.3)_1px,transparent_1.2px)] [background-size:5px_5px]" />
        </div>
      ) : (
        <div
          className={cn(
            "absolute inset-0 border border-white/80 bg-[linear-gradient(to_bottom,#fffdf8_0%,#f3f4f7_84%)]",
            sizeClass.inner
          )}
        >
          <div className="absolute inset-[2px] rounded-[5px] border border-black/8" />
          <div className={cn("absolute left-[4px] top-[3px] flex flex-col items-center leading-none", toneClass)}>
            <span className={cn("font-extrabold tracking-[-0.02em]", sizeClass.cornerRank)}>{parsed.displayRank}</span>
            <span className={cn("mt-px font-black", sizeClass.cornerSuit)}>{parsed.symbol}</span>
          </div>
          <div className={cn("absolute bottom-[3px] right-[4px] flex rotate-180 flex-col items-center leading-none", toneClass)}>
            <span className={cn("font-extrabold tracking-[-0.02em]", sizeClass.cornerRank)}>{parsed.displayRank}</span>
            <span className={cn("mt-px font-black", sizeClass.cornerSuit)}>{parsed.symbol}</span>
          </div>
          <span className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-black", toneClass, sizeClass.centerSuit)}>
            {parsed.symbol}
          </span>
        </div>
      )}
    </div>
  );
}
