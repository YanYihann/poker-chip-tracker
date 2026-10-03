"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { SimPokerCard } from "@/components/cards/sim-poker-card";
import { cn } from "@/lib/cn";

import type { TableSeatPlayer } from "./types";

type PlayerSeatProps = {
  player: TableSeatPlayer;
  xPercent: number;
  yPercent: number;
  compact?: boolean;
};

const POSITION_LABEL_ZH_MAP: Record<string, string> = {
  BTN: "\u5e84",
  "BTN/SB": "\u5e84/\u5c0f\u76f2",
  SB: "\u5c0f\u76f2",
  BB: "\u5927\u76f2",
  UTG: "\u67aa\u53e3",
  "UTG+1": "\u67aa\u53e3+1",
  "UTG+2": "枪口+2",
  MP: "\u4e2d\u4f4d",
  LJ: "\u4f4e\u52ab\u4f4d",
  HJ: "\u52ab\u4f4d",
  CO: "\u5173\u715e"
};

function localizePositionLabel(label: string, isZh: boolean): string {
  if (!isZh) {
    return label;
  }

  return POSITION_LABEL_ZH_MAP[label] ?? label;
}

export function PlayerSeat({ player, xPercent, yPercent, compact = false }: PlayerSeatProps) {
  const { isZh } = useLanguage();
  const avatarSize = "h-11 w-11";
  const folded = player.status === "folded";
  const heroOrActive = player.isHero || player.isActive;
  const hasRevealedHoleCards = Boolean(player.revealedCards && player.revealedCards.length > 0);
  const positionLabel = player.positionLabel ? localizePositionLabel(player.positionLabel, isZh) : "";
  const statusLabel = [positionLabel, player.isActive ? (isZh ? "行动中" : "Acting") : ""].filter(Boolean).join(" · ");

  if (player.isPlaceholder) {
    return (
      <article
        className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
        aria-label={`${player.name}${isZh ? "\u5ea7\u4f4d" : " seat"}`}
      >
        <div className="player-seat-content flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={player.onPress}
            aria-label={`${isZh ? "选择座位" : "Select seat"} ${player.name}`}
            aria-pressed={player.placeholderSelected ?? false}
            disabled={!player.onPress}
            className={cn(
              avatarSize,
              "grid place-items-center overflow-hidden rounded-full border text-base font-bold transition",
              player.placeholderSelected
                ? "border-stitch-primary bg-stitch-primary/20 text-stitch-primary"
                : "border-stitch-outlineVariant/60 bg-stitch-surfaceContainer text-stitch-onSurface hover:border-stitch-primary/50 hover:text-stitch-primary"
            )}
          >
            {player.placeholderLabel ?? "+"}
          </button>
          <p className="text-[10px] text-stitch-onSurfaceVariant">{player.name}</p>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn("player-seat absolute z-20 -translate-x-1/2 -translate-y-1/2", compact && "player-seat-compact")}
      style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
      aria-label={`${player.name}${isZh ? "\u5ea7\u4f4d" : " seat"}`}
    >
      <div className="player-seat-content flex flex-col items-center gap-1.5">
        {hasRevealedHoleCards ? (
          <div className={cn("seat-hole-cards flex items-center gap-1", folded ? "opacity-45 grayscale" : "")}>
            {Array.from({ length: 2 }, (_, index) => (
              <SimPokerCard
                key={`${player.id}-avatar-hole-${index}`}
                card={player.revealedCards?.[index] ?? null}
                size="xs"
                hidden={!player.revealedCards?.[index]}
                isZh={isZh}
              />
            ))}
          </div>
        ) : (
          <div
            className={cn(
              avatarSize,
              "seat-avatar grid place-items-center overflow-hidden rounded-full border bg-stitch-surfaceContainer text-xs font-label font-semibold text-stitch-onSurface shadow-[var(--stitch-shadow-ambient)]",
              heroOrActive
                ? "border-stitch-mint/70 "
                : "border-stitch-outlineVariant/60",
              folded ? "opacity-45 grayscale" : ""
            )}
          >
            {player.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.avatarUrl} alt={`${player.name} avatar`} className="h-full w-full object-cover" />
            ) : (
              player.name.slice(0, 1).toUpperCase()
            )}
          </div>
        )}

        <div className={cn("seat-ledger rounded-xl bg-stitch-surfaceContainerHigh px-2 py-1 text-center shadow-[0_8px_20px_rgba(0,0,0,0.35)]", compact && "seat-ledger-compact", player.isActive && "seat-ledger-active")}>
            <p title={player.name} className="truncate text-xs font-body font-semibold text-stitch-onSurface">{player.name}</p>
          <p title={player.stackLabel} className="truncate text-xs tabular-nums text-stitch-onSurfaceVariant">{player.stackLabel}</p>
          {player.betLabel ? <p className="text-[10px] tabular-nums text-stitch-mint">{player.betLabel}</p> : null}
          {player.resultDeltaLabel ? (
            <p
              className={cn(
                "mt-0.5 text-[10px] font-semibold",
                player.resultDeltaLabel.startsWith("+")
                  ? "text-stitch-mint"
                  : "text-stitch-tertiary"
              )}
            >
              {player.resultDeltaLabel}
            </p>
          ) : null}
        </div>

        {(positionLabel || player.isActive) && <div className={cn("seat-status flex items-center justify-center gap-1.5", !compact && "flex-col")}>
          {compact ? <span
            className={cn("block max-w-full truncate", player.isActive ? "active-seat-label" : "seat-position-label", folded && "opacity-45")}
            title={statusLabel}
            aria-label={statusLabel}
          >
            {[positionLabel, player.isActive ? (isZh ? "行动" : "Act") : ""].filter(Boolean).join(" · ")}
          </span> : <>
            {positionLabel && <Badge
              size="sm"
              variant={heroOrActive ? "mint" : "neutral"}
              className={folded ? "opacity-45" : ""}
            >
              {positionLabel}
            </Badge>}
            {player.isActive && <span className="active-seat-label">{isZh ? "行动中" : "Acting"}</span>}
          </>}
        </div>}
      </div>
    </article>
  );
}
