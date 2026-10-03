"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { TableSeatPlayer } from "@/components/player/types";
import { PlayerSeat } from "@/components/player/player-seat";
import { useLanguage } from "@/components/i18n/language-provider";
import { CentralPot } from "@/components/pot/central-pot";
import { TableMotionLayer } from "@/components/table/table-motion-layer";
import { getPlayerSeatCoordinates } from "@/lib/table-layout";

type PokerTableProps = {
  centerContent?: ReactNode;
  players: TableSeatPlayer[];
  potLabel: string;
  boardCards?: string[] | null;
  streetLabel: string;
  statusLabel: string;
  showCenterStatusBadges?: boolean;
  street: "preflop" | "flop" | "turn" | "river" | "showdown";
  handKey: string;
};

export function PokerTable({
  centerContent,
  players,
  potLabel,
  boardCards,
  streetLabel,
  statusLabel,
  showCenterStatusBadges,
  street,
  handKey
}: PokerTableProps) {
  const { isZh } = useLanguage();
  const isSeatSelection = players.length > 0 && players.every((player) => player.isPlaceholder);
  const selectedCount = players.filter((player) => player.placeholderSelected).length;
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [tableSize, setTableSize] = useState({ width: 0, height: 0 });
  const seatCoordinates = useMemo(() => getPlayerSeatCoordinates(players), [players]);
  const compactSeats = (players[0]?.seatCount ?? players.length) >= 8;

  useEffect(() => {
    const node = tableRef.current;

    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setTableSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const seatPointsByPlayerId = useMemo(
    () =>
      players.reduce<Record<string, { xPercent: number; yPercent: number }>>((acc, player, index) => {
        const point = seatCoordinates[index];
        acc[player.id] = point;
        return acc;
      }, {}),
    [players, seatCoordinates]
  );

  return (
    <section className="poker-table-wrap relative mx-auto w-full">
      <div
        ref={tableRef}
        className="poker-felt relative overflow-visible"
      >
        <div className="poker-felt-inset absolute inset-[5%]" />

        {centerContent ? <div className="table-seat-prompt absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center">{centerContent}</div> : isSeatSelection ? <div className="table-seat-prompt pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center">
          <p>{isZh ? "点击 + 入座" : "Pick your seats"}</p>
          <span>{isZh ? `已选 ${selectedCount} 个座位` : `${selectedCount} seats selected`}</span>
        </div> : <CentralPot
          amountLabel={potLabel}
          boardCards={boardCards}
          streetLabel={streetLabel}
          statusLabel={statusLabel}
          showStatusBadges={showCenterStatusBadges}
          street={street}
          handKey={handKey}
        />}

        <TableMotionLayer
          width={tableSize.width}
          height={tableSize.height}
          seatPointsByPlayerId={seatPointsByPlayerId}
        />

        <div className="absolute inset-0">
          {players.map((player, index) => {
            const coordinate = seatCoordinates[index];

            return (
              <PlayerSeat
                key={player.id}
                player={player}
                xPercent={coordinate.xPercent}
                yPercent={coordinate.yPercent}
                compact={compactSeats}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
