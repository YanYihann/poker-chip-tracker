"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";

import { CommunityBoard } from "./community-board";

type CentralPotProps = {
  amountLabel: string;
  boardCards?: string[] | null;
  streetLabel: string;
  statusLabel: string;
  street: "preflop" | "flop" | "turn" | "river" | "showdown";
  handKey: string;
};

export function CentralPot({
  amountLabel,
  boardCards,
  streetLabel,
  statusLabel,
  street,
  handKey
}: CentralPotProps) {
  const { isZh } = useLanguage();

  return (
    <section className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[calc(100%-2.2rem)] max-w-[228px] -translate-x-1/2 -translate-y-1/2 sm:max-w-[250px]">
      <div className="isolate flex flex-col items-center rounded-2xl border border-stitch-primary/10 bg-stitch-surfaceContainerHigh/70 px-2.5 py-1.5 text-center shadow-[var(--stitch-shadow-float)] backdrop-blur sm:px-3 sm:py-2">
        <p className="font-label text-[10px] uppercase tracking-[0.28em] text-stitch-primary/70">
          {isZh ? "\u603b\u5e95\u6c60" : "Total Pot"}
        </p>
        <p className="mt-1 font-headline text-[1.7rem] font-extrabold tracking-tight text-stitch-primary sm:text-3xl">
          {amountLabel}
        </p>
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

        <CommunityBoard street={street} handKey={handKey} boardCards={boardCards} />
      </div>
    </section>
  );
}
