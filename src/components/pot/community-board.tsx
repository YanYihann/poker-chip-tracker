"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";

type StreetStage = "preflop" | "flop" | "turn" | "river" | "showdown";

type CommunityBoardProps = {
  street: StreetStage;
  handKey: string;
};

type Suit = "\u2660" | "\u2665" | "\u2666" | "\u2663";

type CommunityCard = {
  rank: string;
  suit: Suit;
};

const SUITS: Suit[] = ["\u2660", "\u2665", "\u2666", "\u2663"];
const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

function toRevealCount(street: StreetStage): number {
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

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createDeck(): CommunityCard[] {
  const deck: CommunityCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function generateBoardCards(seed: string): CommunityCard[] {
  const deck = createDeck();
  let state = hashSeed(seed || "default-seed");

  const rand = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }

  return deck.slice(0, 5);
}

function isRedSuit(suit: Suit): boolean {
  return suit === "\u2665" || suit === "\u2666";
}

export function CommunityBoard({ street, handKey }: CommunityBoardProps) {
  const cards = useMemo(() => generateBoardCards(handKey), [handKey]);
  const revealCount = toRevealCount(street);
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
        "mt-2 flex items-center gap-1 rounded-xl border px-1.5 py-1.5 backdrop-blur-sm sm:gap-1.5 sm:px-2 sm:py-2",
        street === "showdown"
          ? "border-stitch-primary/40 bg-stitch-surfaceContainerHighest/70 shadow-[0_0_20px_rgba(242,202,80,0.24)]"
          : "border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh/70"
      ].join(" ")}
    >
      {cards.map((card, index) => {
        const isRevealed = index < revealCount;
        const isNewlyRevealed = isRevealed && index >= previousRevealCount;

        return (
          <div
            key={`${handKey}-${index}`}
            className="relative h-10 w-7 shrink-0 rounded-md border border-black/40 shadow-[0_4px_10px_rgba(0,0,0,0.42)] sm:h-12 sm:w-8"
          >
            {isRevealed ? (
              <motion.div
                className={[
                  "absolute inset-0 rounded-md border bg-gradient-to-b from-[#f6f0de] to-[#e6dcc4]",
                  "border-[#5d4e33] text-[9px] font-semibold sm:text-[10px]",
                  isNewlyRevealed ? "shadow-[0_0_12px_rgba(242,202,80,0.55)]" : ""
                ].join(" ")}
                initial={
                  isNewlyRevealed
                    ? {
                        rotateY: -90,
                        scale: 0.88,
                        opacity: 0.7
                      }
                    : false
                }
                animate={{
                  rotateY: 0,
                  scale: 1,
                  opacity: 1
                }}
                transition={{
                  duration: 0.32,
                  ease: [0.2, 0.8, 0.2, 1]
                }}
                style={{
                  transformStyle: "preserve-3d"
                }}
              >
                <span
                  className={[
                    "absolute left-0.5 top-0.5 leading-none sm:left-1 sm:top-1",
                    isRedSuit(card.suit) ? "text-[#b63b2f]" : "text-[#1f1f1f]"
                  ].join(" ")}
                >
                  {card.rank}
                </span>
                <span
                  className={[
                    "absolute bottom-0.5 right-0.5 text-[10px] leading-none sm:bottom-1 sm:right-1 sm:text-[11px]",
                    isRedSuit(card.suit) ? "text-[#b63b2f]" : "text-[#1f1f1f]"
                  ].join(" ")}
                >
                  {card.suit}
                </span>
              </motion.div>
            ) : (
              <div className="absolute inset-0 rounded-md border border-[#8f6d2a] bg-[radial-gradient(circle_at_28%_22%,rgba(246,208,102,0.22)_0%,rgba(66,22,10,0.85)_58%,rgba(33,12,8,0.95)_100%)]">
                <div className="absolute inset-1 rounded-[4px] border border-[#d9b14d]/50 bg-[repeating-linear-gradient(45deg,rgba(217,177,77,0.22)_0px,rgba(217,177,77,0.22)_2px,rgba(66,22,10,0.12)_2px,rgba(66,22,10,0.12)_4px)]" />
                <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d9b14d]/60 bg-black/20 sm:h-4 sm:w-4" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
