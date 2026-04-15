"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { SimPokerCard } from "@/components/cards/sim-poker-card";

type StreetStage = "preflop" | "flop" | "turn" | "river" | "showdown";

type CommunityBoardProps = {
  street: StreetStage;
  handKey: string;
  boardCards?: string[] | null;
};

const FLIP_DURATION_SECONDS = 0.62;
const FLIP_STAGGER_SECONDS = 0.2;

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
        const revealOrder = Math.max(0, index - previousRevealCount);
        const cardLabel = isRevealed ? (boardCards?.[index] ?? null) : null;

        return (
          <motion.div
            key={`${handKey}-${index}`}
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
              duration: FLIP_DURATION_SECONDS,
              delay: isNewlyRevealed ? revealOrder * FLIP_STAGGER_SECONDS : 0,
              ease: [0.16, 0.84, 0.24, 1]
            }}
            style={{
              transformStyle: "preserve-3d"
            }}
          >
            <SimPokerCard
              card={cardLabel}
              size="xs"
              hidden={!isRevealed}
              faceBlank={isRevealed && !cardLabel}
              className={isNewlyRevealed ? "shadow-[0_0_12px_rgba(56,189,248,0.45)]" : ""}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
