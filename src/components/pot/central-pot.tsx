"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { motion, useReducedMotion } from "framer-motion";

import { CommunityBoard } from "./community-board";

type CentralPotProps = {
  amountLabel: string;
  boardCards?: string[] | null;
  streetLabel: string;
  statusLabel: string;
  showStatusBadges?: boolean;
  street: "preflop" | "flop" | "turn" | "river" | "showdown";
  handKey: string;
  yPercent?: number;
};

export function CentralPot({
  amountLabel,
  boardCards,
  streetLabel,
  statusLabel,
  showStatusBadges = true,
  street,
  handKey,
  yPercent = 50
}: CentralPotProps) {
  const { isZh } = useLanguage();
  const reduced = useReducedMotion();
  const shouldShowStatusBadges = showStatusBadges !== false;

  return (
    <section
      style={{ top: `${yPercent}%` }}
      className={[
        "pointer-events-none absolute left-1/2 top-1/2 z-20 w-[calc(100%-2.2rem)] -translate-x-1/2 -translate-y-1/2",
        shouldShowStatusBadges ? "max-w-[228px] sm:max-w-[250px]" : "max-w-[248px] sm:max-w-[272px]"
      ].join(" ")}
    >
      <div className="central-pot-content isolate flex flex-col items-center px-2.5 py-1.5 text-center sm:px-3 sm:py-2">
        <p className="font-label text-[10px] uppercase tracking-[0.28em] text-stitch-onSurfaceVariant">
          {isZh ? "\u603b\u5e95\u6c60" : "Total Pot"}
        </p>
        <motion.p key={amountLabel} initial={reduced ? false : { scale: 0.9, y: 4 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 22 }} className="mt-1 font-label tabular-nums text-[1.7rem] font-semibold tracking-tight text-stitch-primary sm:text-3xl">
          {amountLabel}
        </motion.p>
        {shouldShowStatusBadges ? (
          <div className="relative z-10 mt-1 grid w-full grid-cols-2 gap-1.5 transform-gpu">
            <Badge
              variant="primary"
              size="sm"
              className="min-h-[1.8rem] w-full min-w-0 justify-center px-1.5 text-[10px] tracking-[0.1em]"
            >
              {streetLabel}
            </Badge>
            <Badge
              variant="mint"
              size="sm"
              className="min-h-[1.8rem] w-full min-w-0 justify-center px-1.5 text-[10px] tracking-[0.1em]"
            >
              {statusLabel}
            </Badge>
          </div>
        ) : null}

        <CommunityBoard
          street={street}
          handKey={handKey}
          boardCards={boardCards}
          cardSize={shouldShowStatusBadges ? "xs" : "sm"}
        />
      </div>
    </section>
  );
}
