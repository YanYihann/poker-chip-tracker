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
  S: { symbol: "\u2660", isRed: false },
  H: { symbol: "\u2665", isRed: true },
  D: { symbol: "\u2666", isRed: true },
  C: { symbol: "\u2663", isRed: false }
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
        "mt-2 flex items-center gap-1 rounded-xl border px-1 py-1 backdrop-blur-sm sm:mt-2.5 sm:gap-1.5 sm:px-1.5 sm:py-1.5",
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
          <motion.div
            key={`${handKey}-${index}`}
            className={[
              "relative h-10 w-7 shrink-0 overflow-hidden rounded-md border shadow-[0_5px_12px_rgba(2,6,23,0.32)] sm:h-12 sm:w-8",
              isRevealed
                ? "border-white/80 bg-gradient-to-b from-white to-slate-100"
                : "border-sky-300/45 bg-[linear-gradient(135deg,#0f766e_0%,#075985_100%)]",
              isNewlyRevealed ? "shadow-[0_0_12px_rgba(56,189,248,0.45)]" : ""
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
            {!isRevealed ? (
              <div className="grid h-full w-full place-items-center text-[10px] font-black text-white/90">
                {"\u2605"}
              </div>
            ) : parsed ? (
              <>
                <span
                  className={[
                    "absolute left-1 top-0.5 text-[8px] font-bold leading-none sm:text-[9px]",
                    toneClass
                  ].join(" ")}
                >
                  {parsed.displayRank}
                </span>
                <span
                  className={[
                    "grid h-full w-full place-items-center text-sm font-black sm:text-base",
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
          </motion.div>
        );
      })}
    </div>
  );
}
