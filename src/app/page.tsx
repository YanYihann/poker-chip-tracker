"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { BottomActionPanel } from "@/components/actions/bottom-action-panel";
import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import type { TableSeatPlayer } from "@/components/player/types";
import { PokerTable } from "@/components/table/poker-table";
import { fetchCurrentUser } from "@/features/auth/api";
import {
  decideNextHand,
  getRoom,
  settleHand,
  submitRoomAction,
  type RoomState
} from "@/features/rooms/api";
import { getRoomSocket } from "@/features/rooms/realtime";

const STREET_LABEL_MAP: Record<AppLocale, Record<NonNullable<RoomState["game"]>["street"], string>> = {
  zh: {
    preflop: "\u7ffb\u724c\u524d",
    flop: "\u7ffb\u724c",
    turn: "\u8f6c\u724c",
    river: "\u6cb3\u724c",
    showdown: "\u644a\u724c"
  },
  en: {
    preflop: "Pre-flop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown"
  }
};

const STATUS_LABEL_MAP: Record<AppLocale, Record<NonNullable<RoomState["game"]>["status"], string>> = {
  zh: {
    "in-progress": "\u8fdb\u884c\u4e2d",
    showdown: "\u5f85\u7ed3\u7b97",
    settled: "\u5df2\u7ed3\u7b97"
  },
  en: {
    "in-progress": "In Progress",
    showdown: "Awaiting Settlement",
    settled: "Settled"
  }
};

const ROOM_STATUS_LABEL_MAP: Record<AppLocale, Record<RoomState["room"]["status"], string>> = {
  zh: {
    waiting: "\u7b49\u5f85\u4e2d",
    active: "\u8fdb\u884c\u4e2d",
    finished: "\u5df2\u7ed3\u675f",
    cancelled: "\u5df2\u53d6\u6d88"
  },
  en: {
    waiting: "Waiting",
    active: "Active",
    finished: "Finished",
    cancelled: "Cancelled"
  }
};

const ACTION_COPY: Record<
  AppLocale,
  Record<
    "fold" | "check" | "call" | "bet" | "raise" | "all-in",
    { topLabel: string; mainLabel: string }
  >
> = {
  zh: {
    fold: { topLabel: "\u5f03\u724c", mainLabel: "\u5f03\u724c" },
    check: { topLabel: "\u8fc7\u724c", mainLabel: "\u8fc7\u724c" },
    call: { topLabel: "\u8ddf\u6ce8", mainLabel: "\u8ddf\u6ce8" },
    bet: { topLabel: "\u4e0b\u6ce8", mainLabel: "\u4e0b\u6ce8" },
    raise: { topLabel: "\u52a0\u6ce8", mainLabel: "\u52a0\u6ce8" },
    "all-in": { topLabel: "\u5168\u4e0b", mainLabel: "\u5168\u4e0b" }
  },
  en: {
    fold: { topLabel: "Fold", mainLabel: "Fold" },
    check: { topLabel: "Check", mainLabel: "Check" },
    call: { topLabel: "Call", mainLabel: "Call" },
    bet: { topLabel: "Bet", mainLabel: "Bet" },
    raise: { topLabel: "Raise", mainLabel: "Raise" },
    "all-in": { topLabel: "All-in", mainLabel: "All-in" }
  }
};

function formatCurrency(amount: number, locale: AppLocale): string {
  const formatted = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 0
  }).format(Math.abs(amount));
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCode = (searchParams.get("room") ?? "").toUpperCase();
  const { locale, isZh } = useLanguage();

  const [entryResolving, setEntryResolving] = useState(true);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionAmountInput, setActionAmountInput] = useState("");
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);

  useEffect(() => {
    if (roomCode) {
      setEntryResolving(false);
      return;
    }

    let active = true;

    const resolveEntry = async () => {
      try {
        await fetchCurrentUser();
        if (active) {
          router.replace("/rooms/join");
        }
      } catch {
        if (active) {
          router.replace("/auth?next=/rooms/join");
        }
      } finally {
        if (active) {
          setEntryResolving(false);
        }
      }
    };

    void resolveEntry();

    return () => {
      active = false;
    };
  }, [roomCode, router]);

  useEffect(() => {
    if (!roomCode) {
      setLoading(false);
      setRoomState(null);
      return;
    }

    let active = true;
    const socket = getRoomSocket();

    const loadRoom = async () => {
      setLoading(true);
      setError(null);
      try {
        const state = await getRoom(roomCode);
        if (active) {
          setRoomState(state);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isZh
                ? "\u65e0\u6cd5\u52a0\u8f7d\u623f\u95f4\u72b6\u6001\u3002"
                : "Unable to load room state."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const onRoomState = (nextState: RoomState) => {
      if (!active || nextState.room.code !== roomCode) {
        return;
      }
      setRoomState(nextState);
    };

    const onRoomError = (payload: { message?: string }) => {
      if (!active) {
        return;
      }
      setError(payload.message ?? (isZh ? "\u5b9e\u65f6\u540c\u6b65\u9519\u8bef\u3002" : "Realtime error."));
    };

    void loadRoom();
    socket.on("room:state", onRoomState);
    socket.on("room:error", onRoomError);
    socket.emit("room:subscribe", { roomCode });

    return () => {
      active = false;
      socket.emit("room:unsubscribe", { roomCode });
      socket.off("room:state", onRoomState);
      socket.off("room:error", onRoomError);
    };
  }, [isZh, roomCode]);

  const game = roomState?.game ?? null;
  const streetLabels = STREET_LABEL_MAP[locale];
  const statusLabels = STATUS_LABEL_MAP[locale];
  const roomStatusLabels = ROOM_STATUS_LABEL_MAP[locale];
  const actionCopy = ACTION_COPY[locale];

  useEffect(() => {
    if (!game) {
      return;
    }

    if (game.status === "in-progress") {
      const defaultAmount =
        game.legalActions.includes("raise") && game.currentBet > 0
          ? game.currentBet + game.minRaiseDelta
          : game.minBet;
      setActionAmountInput(String(defaultAmount));
    }
  }, [game?.currentBet, game?.handId, game?.legalActions, game?.minBet, game?.minRaiseDelta, game?.status]);

  useEffect(() => {
    if (!game || game.status !== "showdown") {
      setSelectedWinners([]);
      return;
    }

    const first = game.eligibleWinnerUserIds[0];
    if (first) {
      setSelectedWinners([first]);
    }
  }, [game?.eligibleWinnerUserIds, game?.status]);

  const tablePlayers = useMemo<TableSeatPlayer[]>(() => {
    if (!roomState) {
      return [];
    }

    const ordered = [...roomState.players].sort((a, b) => {
      const aSeat = a.seatIndex ?? 999;
      const bSeat = b.seatIndex ?? 999;
      return aSeat - bSeat;
    });

    return ordered.map((player) => ({
      id: player.userId,
      name: player.displayName,
      avatarUrl: player.avatarUrl,
      stackLabel: formatCurrency(player.stack, locale),
      positionLabel: player.positionLabel ?? (player.seatIndex !== null ? `S${player.seatIndex + 1}` : undefined),
      isHero: roomState.me?.userId === player.userId,
      isActive: game?.activePlayerUserId === player.userId,
      status: player.status
    }));
  }, [game?.activePlayerUserId, locale, roomState]);

  const mainActions = useMemo(
    () =>
      (game?.legalActions ?? []).map((actionType) => ({
        id: actionType,
        topLabel: actionCopy[actionType].topLabel,
        mainLabel: actionCopy[actionType].mainLabel,
        onPress: async () => {
          if (!roomCode || pendingAction) {
            return;
          }

          const currentGame = game;
          if (!currentGame) {
            return;
          }

          const parsedAmount = Number(actionAmountInput);
          const normalizedAmount =
            Number.isFinite(parsedAmount) && parsedAmount > 0 ? Math.floor(parsedAmount) : 0;

          if (actionType === "bet" && normalizedAmount < currentGame.minBet) {
            setError(
              isZh
                ? `\u4e0b\u6ce8\u91d1\u989d\u81f3\u5c11\u4e3a ${currentGame.minBet}`
                : `Bet amount must be at least ${currentGame.minBet}`
            );
            return;
          }

          if (actionType === "raise" && normalizedAmount < currentGame.currentBet + currentGame.minRaiseDelta) {
            setError(
              isZh
                ? `\u52a0\u6ce8\u5230\u5c11\u81f3 ${currentGame.currentBet + currentGame.minRaiseDelta}`
                : `Raise-to amount must be at least ${currentGame.currentBet + currentGame.minRaiseDelta}`
            );
            return;
          }

          setPendingAction(actionType);
          setError(null);
          try {
            const next = await submitRoomAction(
              roomCode,
              actionType,
              actionType === "bet" || actionType === "raise" ? normalizedAmount : undefined
            );
            setRoomState(next);
          } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : isZh ? "\u64cd\u4f5c\u5931\u8d25\u3002" : "Action failed.");
          } finally {
            setPendingAction(null);
          }
        }
      })),
    [actionAmountInput, actionCopy, game, isZh, pendingAction, roomCode]
  );

  const settlementCandidates = useMemo(() => {
    if (!roomState || !game) {
      return [];
    }

    const winnerSet = new Set(game.eligibleWinnerUserIds);
    return roomState.players.filter((player) => winnerSet.has(player.userId));
  }, [game, roomState]);

  if (!roomCode) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
        <AppTopBar title={isZh ? "\u6251\u514b\u7b79\u7801\u8d26\u672c" : "PokerChip Ledger"} />
        <section className="px-4 pt-4">
          <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5 text-center">
            <h2 className="font-headline text-2xl text-stitch-onSurface">
              {isZh ? "\u6b63\u5728\u8df3\u8f6c..." : "Redirecting..."}
            </h2>
            <p className="mt-2 text-sm text-stitch-onSurfaceVariant">
              {entryResolving
                ? isZh
                  ? "\u6b63\u5728\u68c0\u67e5\u767b\u5f55\u72b6\u6001\u3002"
                  : "Checking your sign-in status."
                : isZh
                  ? "\u5373\u5c06\u8fdb\u5165\u76ee\u6807\u9875\u9762\u3002"
                  : "Taking you to the right page."}
            </p>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-stitch-background pb-44">
      <AppTopBar title={isZh ? `\u724c\u684c ${roomCode}` : `Table ${roomCode}`} backHref={`/rooms/${roomCode}`} />

      <section className="flex-1 space-y-3 px-4 pb-4 pt-4">
        {loading ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-3 text-xs text-stitch-onSurfaceVariant">
            {isZh ? "\u6b63\u5728\u52a0\u8f7d\u670d\u52a1\u5668\u724c\u5c40\u72b6\u6001..." : "Loading server game state..."}
          </article>
        ) : null}

        {error ? (
          <article className="rounded-2xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 p-3 text-xs text-stitch-tertiary">
            {error}
          </article>
        ) : null}

        {roomState && game ? (
          <>
            <PokerTable
              players={tablePlayers}
              potLabel={formatCurrency(game.potTotal, locale)}
              boardCards={game.boardCards}
              streetLabel={streetLabels[game.street]}
              statusLabel={statusLabels[game.status]}
              street={game.street}
              handKey={game.handId ?? `h-${game.handNumber}`}
            />

            {game.status === "showdown" ? (
              <article className="rounded-2xl border border-stitch-primary/35 bg-stitch-primary/10 p-4">
                <h3 className="text-sm font-semibold text-stitch-primary">
                  {isZh ? "\u624b\u724c\u7ed3\u675f\uff0c\u8bf7\u9009\u62e9\u5e95\u6c60\u5f52\u5c5e" : "Hand complete. Select pot winner(s)."}
                </h3>
                {game.canSettle ? (
                  <>
                    <div className="mt-3 space-y-2">
                      {settlementCandidates.map((player) => {
                        const selected = selectedWinners.includes(player.userId);
                        return (
                          <button
                            key={player.userId}
                            type="button"
                            className={[
                              "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                              selected
                                ? "border-stitch-mint/50 bg-stitch-mint/15 text-stitch-mint"
                                : "border-stitch-outlineVariant/30 bg-stitch-surfaceContainer text-stitch-onSurface"
                            ].join(" ")}
                            onClick={() => {
                              setSelectedWinners((prev) =>
                                prev.includes(player.userId)
                                  ? prev.filter((id) => id !== player.userId)
                                  : [...prev, player.userId]
                              );
                            }}
                          >
                            <span>{player.displayName}</span>
                            <span>{formatCurrency(player.stack, locale)}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={pendingAction !== null || selectedWinners.length < 1}
                        className="rounded-xl bg-stitch-primary px-3 py-2 text-sm font-semibold text-stitch-onPrimary disabled:opacity-50"
                        onClick={async () => {
                          setPendingAction("settle-win");
                          setError(null);
                          try {
                            const next = await settleHand(roomCode, [selectedWinners[0]]);
                            setRoomState(next);
                          } catch (settleError) {
                            setError(settleError instanceof Error ? settleError.message : isZh ? "\u7ed3\u7b97\u5931\u8d25\u3002" : "Settlement failed.");
                          } finally {
                            setPendingAction(null);
                          }
                        }}
                      >
                        {isZh ? "\u5355\u4eba\u8d62\u6c60" : "Single Winner"}
                      </button>
                      <button
                        type="button"
                        disabled={pendingAction !== null || selectedWinners.length < 2}
                        className="rounded-xl bg-stitch-mint/20 px-3 py-2 text-sm font-semibold text-stitch-mint disabled:opacity-50"
                        onClick={async () => {
                          setPendingAction("settle-split");
                          setError(null);
                          try {
                            const next = await settleHand(roomCode, selectedWinners);
                            setRoomState(next);
                          } catch (settleError) {
                            setError(settleError instanceof Error ? settleError.message : isZh ? "\u7ed3\u7b97\u5931\u8d25\u3002" : "Settlement failed.");
                          } finally {
                            setPendingAction(null);
                          }
                        }}
                      >
                        {isZh ? "\u5e73\u5206\u5e95\u6c60" : "Split Pot"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-stitch-onSurfaceVariant">
                    {isZh ? "\u7b49\u5f85\u623f\u4e3b\u7ed3\u7b97..." : "Waiting for host settlement..."}
                  </p>
                )}
              </article>
            ) : null}

            {game.status === "settled" ? (
              <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4">
                <h3 className="text-sm font-semibold text-stitch-onSurface">
                  {isZh ? "\u672c\u624b\u7ed3\u679c" : "Hand Result"}
                </h3>
                <div className="mt-2 space-y-1">
                  {(game.lastSettlement?.entries ?? []).map((entry) => (
                    <p key={entry.userId} className="text-xs text-stitch-onSurfaceVariant">
                      {entry.displayName}:{" "}
                      <span className={entry.netChange >= 0 ? "text-stitch-mint" : "text-stitch-tertiary"}>
                        {formatCurrency(entry.netChange, locale)}
                      </span>
                    </p>
                  ))}
                </div>

                {game.canDecideNextHand ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      className="rounded-xl bg-stitch-primary px-3 py-2 text-sm font-semibold text-stitch-onPrimary disabled:opacity-50"
                      onClick={async () => {
                        setPendingAction("next-hand");
                        setError(null);
                        try {
                          const next = await decideNextHand(roomCode, true);
                          setRoomState(next);
                        } catch (nextError) {
                          setError(nextError instanceof Error ? nextError.message : isZh ? "\u65e0\u6cd5\u5f00\u59cb\u4e0b\u4e00\u624b\u3002" : "Unable to continue.");
                        } finally {
                          setPendingAction(null);
                        }
                      }}
                    >
                      {isZh ? "\u7ee7\u7eed\u4e0b\u4e00\u624b" : "Next Hand"}
                    </button>
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      className="rounded-xl bg-stitch-tertiary/20 px-3 py-2 text-sm font-semibold text-stitch-tertiary disabled:opacity-50"
                      onClick={async () => {
                        setPendingAction("finish-session");
                        setError(null);
                        try {
                          const next = await decideNextHand(roomCode, false);
                          setRoomState(next);
                        } catch (finishError) {
                          setError(finishError instanceof Error ? finishError.message : isZh ? "\u65e0\u6cd5\u7ed3\u675f\u724c\u5c40\u3002" : "Unable to finish session.");
                        } finally {
                          setPendingAction(null);
                        }
                      }}
                    >
                      {isZh ? "\u7ed3\u675f\u6574\u5c40" : "Finish Session"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-stitch-onSurfaceVariant">
                    {isZh ? "\u7b49\u5f85\u623f\u4e3b\u9009\u62e9\u662f\u5426\u7ee7\u7eed..." : "Waiting for host decision..."}
                  </p>
                )}
              </article>
            ) : null}

            {!game.isMyTurn && game.status === "in-progress" ? (
              <article className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant">
                {isZh
                  ? "\u672a\u5230\u4f60\u7684\u56de\u5408\u3002"
                  : "Not your turn."}
              </article>
            ) : null}
          </>
        ) : null}

        {roomState && !game ? (
          <article className="rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            {isZh ? "\u623f\u95f4\u72b6\u6001\u4e3a" : "Room status is"}{" "}
            <strong className="text-stitch-onSurface">{roomStatusLabels[roomState.room.status]}</strong>
            {isZh
              ? "\u3002\u82e5\u724c\u5c40\u5df2\u7ed3\u675f\uff0c\u53ef\u5728\u5386\u53f2\u4e2d\u67e5\u770b\u624b\u724c\u660e\u7ec6\u3002"
              : ". If this game has finished, open history for detailed hand records."}
            <Link
              href="/history"
              className="mt-2 inline-block rounded-lg bg-stitch-primary px-3 py-1.5 text-xs font-semibold text-stitch-onPrimary"
            >
              {isZh ? "\u6253\u5f00\u5386\u53f2\u8bb0\u5f55" : "Open Session History"}
            </Link>
          </article>
        ) : null}
      </section>

      {roomState?.game?.isMyTurn && roomState.game.status === "in-progress" ? (
        <BottomActionPanel
          mainActions={mainActions}
          utilityActions={[]}
          canOpenSettlement={false}
          onOpenSettlement={() => undefined}
          amountControl={
            roomState.game.legalActions.includes("bet") || roomState.game.legalActions.includes("raise")
              ? {
                  value: actionAmountInput,
                  onValueChange: (next) => {
                    const digitsOnly = next.replace(/[^\d]/g, "");
                    const normalized = digitsOnly.replace(/^0+(?=\d)/, "");
                    setActionAmountInput(normalized);
                  },
                  onStep: (delta) => {
                    const current = Number(actionAmountInput || "0");
                    const base = Number.isFinite(current) ? current : 0;
                    const next = Math.max(0, base + delta);
                    setActionAmountInput(next === 0 ? "" : String(next));
                  },
                  helperText: `${isZh ? "\u6700\u5c0f\u4e0b\u6ce8" : "Min Bet"}: ${roomState.game.minBet} | ${
                    isZh ? "\u6700\u5c0f\u52a0\u6ce8\u589e\u91cf" : "Min Raise Delta"
                  }: ${roomState.game.minRaiseDelta}`
                }
              : null
          }
        />
      ) : null}

      {pendingAction ? (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-stitch-surfaceContainerHigh px-3 py-1 text-xs text-stitch-onSurfaceVariant">
          {isZh ? "\u5904\u7406\u4e2d..." : "Processing..."}
        </div>
      ) : null}
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8" />}>
      <OnlineAuthGate title="PokerChip Ledger" backHref="/local">
        <HomePageContent />
      </OnlineAuthGate>
    </Suspense>
  );
}
