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
              className={`chip-flight ${isToPot ? "chip-bet" : "chip-win"}`}
              initial={{
                x: (prefersReducedMotion ? points.end.x : points.start.x) - 10,
                y: (prefersReducedMotion ? points.end.y : points.start.y) - 10,
                scale: 1,
                opacity: 0.95
              }}
              animate={{
                x: points.end.x - 10,
                y: points.end.y - 10,
                scale: prefersReducedMotion ? 1 : [1, 1.15, 0.85],
                opacity: [1, 1, 0]
              }}
              transition={{
                duration: prefersReducedMotion ? 0.1 : 0.48,
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
