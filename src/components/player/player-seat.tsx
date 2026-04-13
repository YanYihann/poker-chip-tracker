"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

import type { TableSeatPlayer } from "./types";

type PlayerSeatProps = {
  player: TableSeatPlayer;
  xPercent: number;
  yPercent: number;
  compact?: boolean;
};

export function PlayerSeat({ player, xPercent, yPercent, compact = false }: PlayerSeatProps) {
  const { isZh } = useLanguage();
  const avatarSize = compact ? "h-9 w-9" : "h-11 w-11";
  const folded = player.status === "folded";
  const heroOrActive = player.isHero || player.isActive;

  return (
    <article
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
      aria-label={`${player.name}${isZh ? "座位" : " seat"}`}
    >
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={cn(
            avatarSize,
            "grid place-items-center rounded-full border bg-stitch-surfaceContainer text-xs font-label font-semibold text-stitch-onSurface shadow-[var(--stitch-shadow-ambient)]",
            heroOrActive
              ? "border-stitch-mint/70 shadow-[0_0_18px_rgba(36,255,205,0.3)]"
              : "border-stitch-outlineVariant/60",
            folded ? "opacity-45 grayscale" : ""
          )}
        >
          {player.name.slice(0, 1).toUpperCase()}
        </div>

        <div className="min-w-[64px] rounded-xl bg-stitch-surfaceContainerHigh px-2 py-1 text-center shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
          {!compact || player.isHero ? (
            <p className="truncate text-[10px] font-body font-semibold text-stitch-onSurface">{player.name}</p>
          ) : null}
          <p className="text-[10px] text-stitch-onSurfaceVariant">{player.stackLabel}</p>
        </div>

        {player.positionLabel ? (
          <Badge
            size="sm"
            variant={heroOrActive ? "mint" : "neutral"}
            className={folded ? "opacity-45" : ""}
          >
            {player.positionLabel}
          </Badge>
        ) : null}

        {player.isActive ? (
          <span className="h-1.5 w-1.5 rounded-full bg-stitch-mint shadow-[0_0_10px_rgba(36,255,205,0.8)]" />
        ) : null}
      </div>
    </article>
  );
}