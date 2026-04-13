"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { TableSeatPlayer } from "@/components/player/types";
import { PlayerSeat } from "@/components/player/player-seat";
import { CentralPot } from "@/components/pot/central-pot";
import { TableMotionLayer } from "@/components/table/table-motion-layer";
import { getSeatCoordinates } from "@/lib/table-layout";

type PokerTableProps = {
  players: TableSeatPlayer[];
  potLabel: string;
  streetLabel: string;
  statusLabel: string;
};

export function PokerTable({ players, potLabel, streetLabel, statusLabel }: PokerTableProps) {
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [tableSize, setTableSize] = useState({ width: 0, height: 0 });
  const seatCoordinates = getSeatCoordinates(players.length);
  const compactSeats = players.length >= 8;

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
    <section className="relative mx-auto w-full max-w-[420px]">
      <div
        ref={tableRef}
        className="relative aspect-[4/5] overflow-visible rounded-[44%] bg-[radial-gradient(circle_at_45%_30%,#012517_0%,#002113_58%,#001209_100%)] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.05),inset_0_-26px_56px_rgba(0,0,0,0.55),0_16px_40px_rgba(0,0,0,0.45)]"
      >
        <div className="absolute inset-[5%] rounded-[44%] bg-[radial-gradient(circle_at_50%_44%,rgba(36,255,205,0.12)_0%,rgba(11,24,18,0.3)_68%,rgba(9,16,13,0.84)_100%)]" />

        <CentralPot
          amountLabel={potLabel}
          streetLabel={streetLabel}
          statusLabel={statusLabel}
        />

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
