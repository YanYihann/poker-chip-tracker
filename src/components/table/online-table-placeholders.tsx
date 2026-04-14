"use client";

import { useMemo } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import type { RoomState } from "@/features/rooms/api";

type OnlineTablePlaceholdersProps = {
  mode: "online" | "local";
  game: RoomState["game"] | null;
  roomStatus: RoomState["room"]["status"] | null;
  myHoleCards: string[];
  boardCards: string[];
};

function getBoardRevealCount(game: RoomState["game"] | null, boardCards: string[]): number {
  if (boardCards.length > 0) {
    return Math.max(0, Math.min(5, boardCards.length));
  }

  if (!game) {
    return 0;
  }

  if (game.street === "flop") {
    return 3;
  }

  if (game.street === "turn") {
    return 4;
  }

  if (game.street === "river" || game.street === "showdown") {
    return 5;
  }

  return 0;
}

export function OnlineTablePlaceholders({
  mode,
  game,
  roomStatus,
  myHoleCards,
  boardCards
}: OnlineTablePlaceholdersProps) {
  const { isZh } = useLanguage();

  const boardRevealCount = useMemo(() => getBoardRevealCount(game, boardCards), [boardCards, game]);

  const showdownLabel = useMemo(() => {
    if (!game) {
      return isZh
        ? "等待牌局开始后同步摊牌状态。"
        : "Showdown state will sync after the hand starts.";
    }

    if (game.status === "showdown") {
      return isZh
        ? "摊牌阶段中，等待房主结算。"
        : "In showdown phase, waiting for host settlement.";
    }

    if (game.status === "settled") {
      return isZh
        ? "本手已结算，等待下一手开始。"
        : "Hand settled. Waiting for the next hand.";
    }

    return isZh ? "当前未进入摊牌。" : "Showdown has not started for this hand.";
  }, [game, isZh]);

  return (
    <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-stitch-onSurfaceVariant">
        {mode === "local"
          ? isZh
            ? "本地同步模式状态"
            : "Local Synced Mode State"
          : isZh
            ? "在线发牌状态"
            : "Online Dealing State"}
      </p>

      <div className="mt-3 grid gap-3">
        <section className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
          <p className="text-xs font-semibold text-stitch-onSurface">
            {mode === "local"
              ? isZh
                ? "底牌（本地同步模式不发牌）"
                : "Hole Cards (No Dealing in Local Synced Mode)"
              : isZh
                ? "我的底牌（仅自己可见）"
                : "My Hole Cards (Private)"}
          </p>
          <div className="mt-2 flex gap-2">
            {Array.from({ length: 2 }, (_, index) => {
              const card = myHoleCards[index] ?? null;

              return (
                <div
                  key={`hole-card-${index + 1}`}
                  className={[
                    "grid h-11 w-8 place-items-center rounded-md border text-[10px] font-semibold tracking-[0.03em]",
                    card
                      ? "border-stitch-mint/45 bg-stitch-mint/15 text-stitch-mint"
                      : "border-stitch-outlineVariant/40 bg-stitch-surfaceContainerHighest/80 text-stitch-onSurfaceVariant"
                  ].join(" ")}
                >
                  {card ?? ""}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
            {isZh
              ? mode === "local"
                ? "本地同步模式不发牌，仅记录筹码动作与位置轮换。"
                : "服务端仅向当前用户返回自己的两张底牌。"
              : mode === "local"
                ? "Local synced mode skips dealing and only tracks chips/actions/positions."
                : "Server only returns your own two private hole cards."}
          </p>
        </section>

        <section className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
          <p className="text-xs font-semibold text-stitch-onSurface">
            {mode === "local"
              ? isZh
                ? "公共牌（本地同步模式不翻牌）"
                : "Board Cards (No Board Reveal in Local Synced Mode)"
              : isZh
                ? "公共牌（按街道公开）"
                : "Board Cards (Street-Revealed)"}
          </p>
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: 5 }, (_, index) => {
              const isRevealed = index < boardRevealCount;
              const card = boardCards[index] ?? null;

              return (
                <div
                  key={`board-card-${index + 1}`}
                  className={[
                    "grid h-10 w-7 place-items-center rounded-md border text-[10px] font-semibold tracking-[0.03em]",
                    isRevealed
                      ? "border-stitch-primary/40 bg-stitch-primary/10 text-stitch-primary"
                      : "border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHighest/80 text-stitch-onSurfaceVariant"
                  ].join(" ")}
                >
                  {isRevealed ? card ?? "?" : ""}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
            {isZh
              ? mode === "local"
                ? "本地同步模式保持不发牌，只同步下注流程。"
                : "翻牌前 0 张、翻牌 3 张、转牌 4 张、河牌 5 张。"
              : mode === "local"
                ? "Local synced mode keeps board hidden and only syncs betting flow."
                : "Preflop 0, flop 3, turn 4, river 5 public cards."}
          </p>
        </section>

        <section className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
          <p className="text-xs font-semibold text-stitch-onSurface">
            {isZh ? "摊牌状态" : "Showdown State"}
          </p>
          <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">{showdownLabel}</p>
          {roomStatus && !game ? (
            <p className="mt-2 text-[11px] text-stitch-onSurfaceVariant">
              {isZh ? `当前房间状态：${roomStatus}` : `Current room status: ${roomStatus}`}
            </p>
          ) : null}
        </section>
      </div>
    </article>
  );
}
