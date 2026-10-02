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
  boardCards?: string[] | null;
  streetLabel: string;
  statusLabel: string;
  showCenterStatusBadges?: boolean;
  street: "preflop" | "flop" | "turn" | "river" | "showdown";
  handKey: string;
};

export function PokerTable({
  players,
  potLabel,
  boardCards,
  streetLabel,
  statusLabel,
  showCenterStatusBadges,
  street,
  handKey
}: PokerTableProps) {
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [tableSize, setTableSize] = useState({ width: 0, height: 0 });
  const seatCoordinates = useMemo(() => getSeatCoordinates(players.length), [players.length]);
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
    <section className="poker-table-wrap relative mx-auto w-full">
      <div
        ref={tableRef}
        className="poker-felt relative overflow-visible"
      >
        <div className="poker-felt-inset absolute inset-[5%]" />

        <CentralPot
          amountLabel={potLabel}
          boardCards={boardCards}
          streetLabel={streetLabel}
          statusLabel={statusLabel}
          showStatusBadges={showCenterStatusBadges}
          street={street}
          handKey={handKey}
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
