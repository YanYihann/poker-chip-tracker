"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { TableSeatPlayer } from "@/components/player/types";
import { PlayerSeat } from "@/components/player/player-seat";
import { useLanguage } from "@/components/i18n/language-provider";
import { CentralPot } from "@/components/pot/central-pot";
import { TableMotionLayer } from "@/components/table/table-motion-layer";
import { fitSeatCoordinates, getMinimumTableHeight, getPlayerSeatCoordinates, getPortraitTableLayout } from "@/lib/table-layout";

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
  const [tableSize, setTableSize] = useState({ width: 0, height: 0, seatWidths: [] as number[], seatHeights: [] as number[], centerHeight: 0 });
  const seatCount = players[0]?.seatCount ?? players.length;
  const portrait = tableSize.width > 0 && tableSize.width < 640;
  const portraitLayout = getPortraitTableLayout(seatCount);
  const centerYPercent = portrait ? portraitLayout.centerYPercent : 50;
  const seatCoordinates = useMemo(() => fitSeatCoordinates(
    getPlayerSeatCoordinates(players, portrait ? portraitLayout.rotation : 0),
    tableSize.width, tableSize.seatWidths
  ), [players, portrait, portraitLayout.rotation, tableSize.width, tableSize.seatWidths]);
  const compactSeats = seatCount >= 7;
  const minimumHeight = tableSize.seatWidths.length ? getMinimumTableHeight({
    coordinates: seatCoordinates, tableWidth: tableSize.width,
    seatWidths: tableSize.seatWidths, seatHeights: tableSize.seatHeights,
    centerHeight: tableSize.centerHeight,
    centerRowGapPercent: portrait && !isSeatSelection ? portraitLayout.rowGapPercent : undefined
  }) : undefined;

  useEffect(() => {
    const node = tableRef.current;

    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      const seats = [...node.querySelectorAll<HTMLElement>(".poker-seat-anchor")];
      const center = node.querySelector<HTMLElement>(".central-pot-content, .table-seat-prompt");
      const next = {
        width: node.clientWidth,
        height: node.clientHeight,
        seatWidths: seats.map((seat) => seat.offsetWidth),
        seatHeights: seats.map((seat) => seat.offsetHeight),
        centerHeight: center?.offsetHeight ?? 0
      };
      setTableSize((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    });
    observer.observe(node);
    node.querySelectorAll(".poker-seat-anchor, .central-pot-content, .table-seat-prompt").forEach((child) => observer.observe(child));

    return () => {
      observer.disconnect();
    };
  }, [players, centerContent]);

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
        style={{ minHeight: minimumHeight ? Math.max(portrait ? 480 : 400, minimumHeight) : undefined }}
      >
        <div className="poker-felt-inset absolute inset-[5%]" />

        {centerContent ? <div style={{ top: `${centerYPercent}%` }} className="table-seat-prompt absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center">{centerContent}</div> : isSeatSelection ? <div className="table-seat-prompt pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center">
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
          yPercent={centerYPercent}
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
