"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { SimPokerCard } from "@/components/cards/sim-poker-card";

type StreetStage = "preflop" | "flop" | "turn" | "river" | "showdown";

type CommunityBoardProps = {
  street: StreetStage;
  handKey: string;
  boardCards?: string[] | null;
  cardSize?: "xs" | "sm" | "md";
};

const FLIP_DURATION_SECONDS = 0.28;
const FLIP_STAGGER_SECONDS = 0.06;

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

export function CommunityBoard({ street, handKey, boardCards, cardSize = "xs" }: CommunityBoardProps) {
  const reduceMotion = useReducedMotion();
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
    <div className="community-board mt-3 flex items-center gap-1.5 py-1 sm:gap-2">
      {Array.from({ length: 5 }, (_, index) => {
        const isRevealed = index < revealCount;
        const isNewlyRevealed = isRevealed && index >= previousRevealCount;
        const revealOrder = Math.max(0, index - previousRevealCount);
        const cardLabel = isRevealed ? (boardCards?.[index] ?? null) : null;
        const revealToken = isRevealed ? "revealed" : "hidden";

        return (
          <motion.div
            key={`${handKey}-${index}-${revealToken}`}
            initial={
              isNewlyRevealed && !reduceMotion
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
              duration: reduceMotion ? 0.1 : FLIP_DURATION_SECONDS,
              delay: isNewlyRevealed && !reduceMotion ? revealOrder * FLIP_STAGGER_SECONDS : 0,
              ease: [0.16, 0.84, 0.24, 1]
            }}
            style={{
              transformStyle: "preserve-3d"
            }}
          >
            <SimPokerCard
              card={cardLabel}
              size={cardSize}
              hidden={!isRevealed}
              faceBlank={isRevealed && !cardLabel}

            />
          </motion.div>
        );
      })}
    </div>
  );
}
