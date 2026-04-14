"use client";

import { useMemo } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import type { RoomState } from "@/features/rooms/api";

type OnlineTablePlaceholdersProps = {
  game: RoomState["game"] | null;
  roomStatus: RoomState["room"]["status"] | null;
};

function getBoardRevealCount(street: NonNullable<RoomState["game"]>["street"]): number {
  if (street === "flop") {
    return 3;
  }

  if (street === "turn") {
    return 4;
  }

  if (street === "river" || street === "showdown") {
    return 5;
  }

  return 0;
}

export function OnlineTablePlaceholders({ game, roomStatus }: OnlineTablePlaceholdersProps) {
  const { isZh } = useLanguage();

  const boardRevealCount = useMemo(() => {
    if (!game) {
      return 0;
    }

    return getBoardRevealCount(game.street);
  }, [game]);

  const showdownLabel = useMemo(() => {
    if (!game) {
      return isZh ? "等待牌局开始后同步摊牌状态" : "Showdown state will sync after the hand begins.";
    }

    if (game.status === "showdown") {
      return isZh
        ? "摊牌占位：等待服务端结算确认。"
        : "Showdown placeholder: waiting for server settlement confirmation.";
    }

    if (game.status === "settled") {
      return isZh
        ? "本手已结算，下一手将继续由服务端广播。"
        : "Hand settled. The next hand state will be broadcast by the server.";
    }

    return isZh ? "当前未进入摊牌阶段。" : "Showdown has not started for this hand.";
  }, [game, isZh]);

  return (
    <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-stitch-onSurfaceVariant">
        {isZh ? "在线占位信息" : "Online Placeholders"}
      </p>

      <div className="mt-3 grid gap-3">
        <section className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
          <p className="text-xs font-semibold text-stitch-onSurface">
            {isZh ? "私有手牌（占位）" : "Private Hole Cards (Placeholder)"}
          </p>
          <div className="mt-2 flex gap-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={`hole-card-${index + 1}`}
                className="h-11 w-8 rounded-md border border-stitch-outlineVariant/40 bg-stitch-surfaceContainerHighest/80"
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
            {isZh
              ? "当前仅显示占位，后续阶段会接入服务端私有牌数据。"
              : "Currently placeholders only. A future phase will hydrate server private-card data."}
          </p>
        </section>

        <section className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
          <p className="text-xs font-semibold text-stitch-onSurface">
            {isZh ? "公共牌（占位）" : "Board Cards (Placeholder)"}
          </p>
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: 5 }, (_, index) => {
              const isRevealed = index < boardRevealCount;

              return (
                <div
                  key={`board-card-${index + 1}`}
                  className={[
                    "grid h-10 w-7 place-items-center rounded-md border text-[10px]",
                    isRevealed
                      ? "border-stitch-primary/40 bg-stitch-primary/10 text-stitch-primary"
                      : "border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHighest/80 text-stitch-onSurfaceVariant"
                  ].join(" ")}
                >
                  {isRevealed ? "?" : ""}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
            {isZh
              ? "翻牌/转牌/河牌推进由服务端街道状态控制。"
              : "Flop/turn/river progression is driven by server street state."}
          </p>
        </section>

        <section className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
          <p className="text-xs font-semibold text-stitch-onSurface">
            {isZh ? "摊牌状态（占位）" : "Showdown State (Placeholder)"}
          </p>
          <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">{showdownLabel}</p>
          {roomStatus && !game ? (
            <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
              {isZh
                ? `当前房间状态：${roomStatus}`
                : `Current room status: ${roomStatus}`}
            </p>
          ) : null}
        </section>
      </div>
    </article>
  );
}

