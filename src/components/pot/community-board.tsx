"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

type StreetStage = "preflop" | "flop" | "turn" | "river" | "showdown";

type CommunityBoardProps = {
  street: StreetStage;
  handKey: string;
  boardCards?: string[] | null;
};

const SUIT_META = {
  S: { symbol: "♠", isRed: false },
  H: { symbol: "♥", isRed: true },
  D: { symbol: "♦", isRed: true },
  C: { symbol: "♣", isRed: false }
} as const;

type SuitCode = keyof typeof SUIT_META;

type ParsedCard = {
  displayRank: string;
  symbol: string;
  isRed: boolean;
};

function parseCardCode(card: string | null): ParsedCard | null {
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
    isRed: suit.isRed
  };
}

function toRevealCount(street: StreetStage, boardCards?: string[] | null): number {
  if (boardCards && boardCards.length > 0) {
    return Math.max(0, Math.min(5, boardCards.length));
  }

  if (street === "flop") {
    return 3;
  }
  if (street === "turn") {
    return 4;
  }
  if (street === "river" || street === "showdown") {
    return 5;
  }
  return 0;
}

export function CommunityBoard({ street, handKey, boardCards }: CommunityBoardProps) {
  const revealCount = toRevealCount(street, boardCards);
  const previousRevealCountRef = useRef(0);
  const previousHandKeyRef = useRef(handKey);

  if (previousHandKeyRef.current !== handKey) {
    previousHandKeyRef.current = handKey;
    previousRevealCountRef.current = 0;
  }

  const previousRevealCount = previousRevealCountRef.current;

  useEffect(() => {
    previousRevealCountRef.current = revealCount;
  }, [revealCount]);

  return (
    <div
      className={[
        "mt-2 flex items-center gap-0.5 rounded-xl border px-1 py-1 backdrop-blur-sm sm:mt-2.5 sm:gap-1 sm:px-1.5 sm:py-1.5",
        street === "showdown"
          ? "border-stitch-primary/45 bg-stitch-surfaceContainerHighest/72 shadow-[0_0_20px_rgba(242,202,80,0.24)]"
          : "border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh/70"
      ].join(" ")}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const isRevealed = index < revealCount;
        const isNewlyRevealed = isRevealed && index >= previousRevealCount;
        const cardLabel = isRevealed ? (boardCards?.[index] ?? "") : "";
        const parsed = isRevealed ? parseCardCode(cardLabel) : null;
        const toneClass = parsed?.isRed ? "text-[#bf1f2f]" : "text-[#1a1c21]";

        return (
          <div
            key={`${handKey}-${index}`}
            className="relative h-10 w-7 shrink-0 rounded-[8px] border border-black/45 shadow-[0_5px_14px_rgba(0,0,0,0.5)] sm:h-11 sm:w-8 sm:rounded-[9px]"
          >
            {isRevealed ? (
              <motion.div
                className={[
                  "absolute inset-0 overflow-hidden rounded-[7px] border border-[#7f6241]/70 sm:rounded-[8px]",
                  "bg-[radial-gradient(circle_at_30%_20%,rgba(255,245,219,0.62)_0%,rgba(235,214,176,0.7)_36%,rgba(189,151,100,0.54)_100%)]",
                  isNewlyRevealed ? "shadow-[0_0_12px_rgba(242,202,80,0.48)]" : ""
                ].join(" ")}
                initial={
                  isNewlyRevealed
                    ? {
                        rotateY: -92,
                        scale: 0.9,
                        opacity: 0.72
                      }
                    : false
                }
                animate={{
                  rotateY: 0,
                  scale: 1,
                  opacity: 1
                }}
                transition={{
                  duration: 0.34,
                  ease: [0.2, 0.8, 0.2, 1]
                }}
                style={{
                  transformStyle: "preserve-3d"
                }}
              >
                <div className="absolute inset-[2px] rounded-[5px] border border-[#674b31]/45 sm:rounded-[6px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_44%)]" />
                <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_2px_2px,rgba(78,51,27,0.11)_1.1px,transparent_1.2px)] [background-size:5px_5px]" />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgba(84,48,16,0.24),transparent)]" />
                {parsed ? (
                  <>
                    <div className={["absolute left-[4px] top-[3px] flex flex-col items-center leading-none", toneClass].join(" ")}>
                      <span className="text-[7px] font-extrabold tracking-[-0.02em] sm:text-[8px]">{parsed.displayRank}</span>
                      <span className="mt-px text-[8px] font-black sm:text-[9px]">{parsed.symbol}</span>
                    </div>
                    <div className={["absolute right-[4px] bottom-[3px] flex rotate-180 flex-col items-center leading-none", toneClass].join(" ")}>
                      <span className="text-[7px] font-extrabold tracking-[-0.02em] sm:text-[8px]">{parsed.displayRank}</span>
                      <span className="mt-px text-[8px] font-black sm:text-[9px]">{parsed.symbol}</span>
                    </div>
                    <span
                      className={[
                        "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[18px] font-black sm:text-[20px]",
                        toneClass
                      ].join(" ")}
                    >
                      {parsed.symbol}
                    </span>
                  </>
                ) : cardLabel ? (
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold tracking-[0.04em] text-[#5a3b1f] sm:text-[11px]">
                    {cardLabel}
                  </span>
                ) : (
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#5a3b1f]/75 sm:text-[11px]">
                    ?
                  </span>
                )}
              </motion.div>
            ) : (
              <div className="absolute inset-0 overflow-hidden rounded-[7px] border border-[#8d5f27] bg-[radial-gradient(circle_at_52%_26%,#b91f24_0%,#7f1017_38%,#4e090d_84%,#370507_100%)] sm:rounded-[8px]">
                <div className="absolute inset-[2px] rounded-[5px] border border-[#f0c267]/78 sm:rounded-[6px]" />
                <div className="absolute inset-[4px] rounded-[4px] border border-[#6e130f] bg-[repeating-linear-gradient(45deg,rgba(255,209,123,0.13)_0px,rgba(255,209,123,0.13)_2px,rgba(90,8,10,0.08)_2px,rgba(90,8,10,0.08)_8px)] sm:rounded-[5px]" />
                <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border border-[#e7b85d]/85 bg-[radial-gradient(circle,#7d0f15_15%,#5f0a10_100%)] shadow-[0_0_0_1px_rgba(43,4,6,0.55)] sm:h-5 sm:w-5" />
                <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e7b85d]/80 bg-[#6e0f14]" />
                <div className="absolute inset-0 opacity-35 [background:radial-gradient(circle_at_1px_1px,rgba(15,7,1,0.3)_1px,transparent_1.2px)] [background-size:5px_5px]" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
