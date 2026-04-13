"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";

type CentralPotProps = {
  amountLabel: string;
  streetLabel: string;
  statusLabel: string;
};

export function CentralPot({ amountLabel, streetLabel, statusLabel }: CentralPotProps) {
  const { isZh } = useLanguage();

  return (
    <section className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-3xl border border-stitch-primary/10 bg-stitch-surfaceContainerHigh/70 px-6 py-4 text-center shadow-[var(--stitch-shadow-float)] backdrop-blur">
      <p className="font-label text-[10px] uppercase tracking-[0.28em] text-stitch-primary/70">
        {isZh ? "总底池" : "Total Pot"}
      </p>
      <p className="mt-2 font-headline text-4xl font-extrabold tracking-tight text-stitch-primary">
        {amountLabel}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <Badge variant="primary" size="sm">
          {streetLabel}
        </Badge>
        <Badge variant="mint" size="sm">
          {statusLabel}
        </Badge>
      </div>
    </section>
  );
}