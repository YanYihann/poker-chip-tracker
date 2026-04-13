"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo } from "react";

import { useMotionStore } from "@/store/useMotionStore";
import type { TableMotionEvent } from "@/types/domain";

type SeatPoint = {
  xPercent: number;
  yPercent: number;
};

type TableMotionLayerProps = {
  width: number;
  height: number;
  seatPointsByPlayerId: Record<string, SeatPoint>;
};

type PixelPoint = { x: number; y: number };

function resolvePoints(
  event: TableMotionEvent,
  seatPointsByPlayerId: Record<string, SeatPoint>,
  width: number,
  height: number
): { start: PixelPoint; end: PixelPoint } | null {
  const potPoint = { x: width * 0.5, y: height * 0.5 };

  if (event.kind === "chip-to-pot") {
    const source = event.sourcePlayerId ? seatPointsByPlayerId[event.sourcePlayerId] : undefined;

    if (!source) {
      return null;
    }

    return {
      start: {
        x: (source.xPercent / 100) * width,
        y: (source.yPercent / 100) * height
      },
      end: potPoint
    };
  }

  const target = event.targetPlayerId ? seatPointsByPlayerId[event.targetPlayerId] : undefined;

  if (!target) {
    return null;
  }

  return {
    start: potPoint,
    end: {
      x: (target.xPercent / 100) * width,
      y: (target.yPercent / 100) * height
    }
  };
}

export function TableMotionLayer({ width, height, seatPointsByPlayerId }: TableMotionLayerProps) {
  const events = useMotionStore((state) => state.events);
  const consume = useMotionStore((state) => state.consume);
  const prefersReducedMotion = useReducedMotion();

  const eventPoints = useMemo(
    () =>
      events
        .map((event) => ({
          event,
          points: resolvePoints(event, seatPointsByPlayerId, width, height)
        }))
        .filter((item) => item.points),
    [events, seatPointsByPlayerId, width, height]
  );

  useEffect(() => {
    events.forEach((event) => {
      const points = resolvePoints(event, seatPointsByPlayerId, width, height);
      if (!points) {
        consume(event.id);
      }
    });
  }, [events, seatPointsByPlayerId, width, height, consume]);

  if (width <= 0 || height <= 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      <AnimatePresence initial={false}>
        {eventPoints.map(({ event, points }) => {
          if (!points) {
            return null;
          }

          const isToPot = event.kind === "chip-to-pot";

          return (
            <motion.span
              key={event.id}
              className={
                isToPot
                  ? "absolute block h-3 w-3 rounded-full border border-stitch-primary/70 bg-stitch-primaryContainer shadow-[0_0_10px_rgba(242,202,80,0.4)] will-change-transform"
                  : "absolute block h-3 w-3 rounded-full border border-stitch-mint/70 bg-stitch-mint shadow-[0_0_10px_rgba(36,255,205,0.45)] will-change-transform"
              }
              initial={{
                x: points.start.x - 6,
                y: points.start.y - 6,
                scale: 1,
                opacity: 0.95
              }}
              animate={{
                x: points.end.x - 6,
                y: points.end.y - 6,
                scale: prefersReducedMotion ? 1 : 0.72,
                opacity: 0
              }}
              transition={{
                duration: prefersReducedMotion ? 0.14 : 0.42,
                delay: (event.delayMs ?? 0) / 1000,
                ease: [0.18, 0.8, 0.24, 1]
              }}
              onAnimationComplete={() => consume(event.id)}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
