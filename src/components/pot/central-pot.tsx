"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";

import { CommunityBoard } from "./community-board";

type CentralPotProps = {
  amountLabel: string;
  streetLabel: string;
  statusLabel: string;
  street: "preflop" | "flop" | "turn" | "river" | "showdown";
  handKey: string;
};

export function CentralPot({ amountLabel, streetLabel, statusLabel, street, handKey }: CentralPotProps) {
  const { isZh } = useLanguage();

  return (
    <section className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex w-[calc(100%-2.2rem)] max-w-[228px] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border border-stitch-primary/10 bg-stitch-surfaceContainerHigh/70 px-2.5 py-1.5 text-center shadow-[var(--stitch-shadow-float)] backdrop-blur sm:max-w-[250px] sm:px-3 sm:py-2">
      <p className="font-label text-[10px] uppercase tracking-[0.28em] text-stitch-primary/70">
        {isZh ? "\u603b\u5e95\u6c60" : "Total Pot"}
      </p>
      <p className="mt-1 font-headline text-[1.7rem] font-extrabold tracking-tight text-stitch-primary sm:text-3xl">
        {amountLabel}
      </p>
      <div className="mt-1 flex items-center gap-1">
        <Badge variant="primary" size="sm">
          {streetLabel}
        </Badge>
        <Badge variant="mint" size="sm">
          {statusLabel}
        </Badge>
      </div>

      <CommunityBoard street={street} handKey={handKey} />
    </section>
  );
}
