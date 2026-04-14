"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { fetchProfile } from "@/features/auth/api";
import {
  getRoom,
  setPlayerBuyIn,
  setPlayerSeat,
  setReady,
  startRoom,
  updateRoomBlinds,
  type RoomState
} from "@/features/rooms/api";
import { getRoomSocket } from "@/features/rooms/realtime";

const ROOM_STATUS_LABELS = {
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
} as const;

function formatDollar(amount: number): string {
  const abs = Math.abs(Math.trunc(amount));
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(abs);
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function WaitingRoomPageContent() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = (params.roomCode ?? "").toUpperCase();
  const { isZh } = useLanguage();

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"ready" | "start" | "blinds" | "buyin" | "seat" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [smallBlind, setSmallBlind] = useState(100);
  const [bigBlind, setBigBlind] = useState(200);
  const [totalAssets, setTotalAssets] = useState<number | null>(null);
  const [buyInInput, setBuyInInput] = useState("");
  const [buyInTouched, setBuyInTouched] = useState(false);
  const autoBuyInAppliedKeyRef = useRef<string | null>(null);

  const isHost = roomState?.me?.isHost ?? false;
  const isReady = roomState?.me?.isReady ?? false;
  const roomStatus = roomState?.room.status ?? "waiting";
  const mePlayer = useMemo(
    () =>
      roomState?.me?.userId
        ? roomState.players.find((player) => player.userId === roomState.me?.userId) ?? null
        : null,
    [roomState]
  );
  const maxBuyIn = Math.max(0, Math.floor(totalAssets ?? mePlayer?.stack ?? 0));
  const mySeatIndex = mePlayer?.seatIndex ?? null;
  const unseatedCount = useMemo(
    () => (roomState?.players ?? []).filter((player) => player.seatIndex === null).length,
    [roomState?.players]
  );

  const sortedPlayers = useMemo(
    () =>
      [...(roomState?.players ?? [])].sort((a, b) => {
        if (a.isHost && !b.isHost) {
          return -1;
        }
        if (!a.isHost && b.isHost) {
          return 1;
        }
        return a.displayName.localeCompare(b.displayName);
      }),
    [roomState?.players]
  );

  useEffect(() => {
    if (!roomState) {
      return;
    }

    setSmallBlind(roomState.room.smallBlind);
    setBigBlind(roomState.room.bigBlind);
  }, [roomState?.room.bigBlind, roomState?.room.smallBlind]);

  useEffect(() => {
    if (buyInTouched) {
      return;
    }
    setBuyInInput(maxBuyIn > 0 ? String(maxBuyIn) : "");
  }, [buyInTouched, maxBuyIn]);

  useEffect(() => {
    if (!roomState?.me || !mePlayer) {
      return;
    }

    if (roomStatus !== "waiting" || buyInTouched) {
      return;
    }

    if (!Number.isFinite(maxBuyIn) || maxBuyIn <= 0) {
      return;
    }

    if (mePlayer.stack === maxBuyIn) {
      return;
    }

    const autoKey = `${roomCode}:${roomState.me.userId}:${maxBuyIn}`;
    if (autoBuyInAppliedKeyRef.current === autoKey) {
      return;
    }

    autoBuyInAppliedKeyRef.current = autoKey;
    let active = true;

    const autoSaveBuyIn = async () => {
      setPendingAction("buyin");
      setError(null);

      try {
        const next = await setPlayerBuyIn(roomCode, maxBuyIn);
        if (!active) {
          return;
        }
        setRoomState(next);
        setBuyInInput(String(maxBuyIn));
      } catch (buyInError) {
        if (!active) {
          return;
        }
        setError(
          buyInError instanceof Error
            ? buyInError.message
            : isZh
              ? "\u65e0\u6cd5\u81ea\u52a8\u8bbe\u7f6e\u5e26\u5165\u7b79\u7801\u3002"
              : "Unable to auto save buy-in."
        );
      } finally {
        setPendingAction((current) => (current === "buyin" ? null : current));
      }
    };

    void autoSaveBuyIn();

    return () => {
      active = false;
    };
  }, [buyInTouched, isZh, maxBuyIn, mePlayer, roomCode, roomState?.me, roomStatus]);

  useEffect(() => {
    let active = true;
    const socket = getRoomSocket();

    const loadInitial = async () => {
      setLoading(true);
      setError(null);
      try {
        const [state, profile] = await Promise.all([
          getRoom(roomCode),
          fetchProfile().catch(() => null)
        ]);
        if (active) {
          setRoomState(state);
          if (profile) {
            const parsedAssets = Number(profile.totalAssets);
            if (Number.isFinite(parsedAssets)) {
              setTotalAssets(Math.max(0, Math.floor(parsedAssets)));
            } else {
              setTotalAssets(null);
            }
          } else {
            setTotalAssets(null);
          }
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isZh
                ? "\u65e0\u6cd5\u52a0\u8f7d\u623f\u95f4\u3002"
                : "Unable to load room."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const onRoomState = (next: RoomState) => {
      if (!active || next.room.code !== roomCode) {
        return;
      }
      setRoomState(next);
    };

    const onRoomError = (payload: { message?: string }) => {
      if (!active) {
        return;
      }
      setError(payload.message ?? (isZh ? "\u5b9e\u65f6\u623f\u95f4\u9519\u8bef\u3002" : "Realtime room error."));
    };

    void loadInitial();
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

  const roomStatusLabel = isZh
    ? ROOM_STATUS_LABELS.zh[roomStatus as keyof typeof ROOM_STATUS_LABELS.zh]
    : ROOM_STATUS_LABELS.en[roomStatus as keyof typeof ROOM_STATUS_LABELS.en];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title={isZh ? `\u623f\u95f4 ${roomCode}` : `Room ${roomCode}`} backHref="/profile" />

      <section className="space-y-4 px-4 pt-4">
        {loading ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            {isZh ? "\u6b63\u5728\u52a0\u8f7d\u623f\u95f4..." : "Loading room..."}
          </article>
        ) : null}

        {error ? (
          <article className="rounded-2xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 p-4">
            <p className="text-sm text-stitch-tertiary">{error}</p>
            <div className="mt-2 flex gap-2">
              <Link
                href="/auth?next=/rooms/join"
                className="rounded-lg bg-stitch-primary px-3 py-1.5 text-xs font-semibold text-stitch-onPrimary"
              >
                {isZh ? "\u767b\u5f55" : "Login"}
              </Link>
              <Link
                href="/rooms/join"
                className="rounded-lg bg-stitch-surfaceContainerHigh px-3 py-1.5 text-xs text-stitch-onSurfaceVariant"
              >
                {isZh ? "\u52a0\u5165\u5176\u4ed6\u623f\u95f4" : "Join Another Room"}
              </Link>
            </div>
          </article>
        ) : null}

        {roomState ? (
          <>
            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-stitch-onSurfaceVariant">{isZh ? "\u5927\u5385" : "Lobby"}</p>
              <h2 className="mt-1 font-headline text-3xl text-stitch-onSurface">{roomState.room.code}</h2>
              <p className="mt-1 text-sm text-stitch-onSurfaceVariant">
                {isZh ? "\u72b6\u6001" : "Status"}: <strong className="text-stitch-primary">{roomStatusLabel}</strong> |{" "}
                {isZh ? "\u4eba\u6570" : "Players"}: {roomState.players.length}/{roomState.room.maxPlayers}
              </p>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                {isZh ? "\u76f2\u6ce8" : "Blinds"}: {formatDollar(roomState.room.smallBlind)}/{formatDollar(roomState.room.bigBlind)}
              </p>

              <div className="mt-4 space-y-2">
                {sortedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-stitch-onSurface">
                        {player.displayName}
                        {player.isHost ? (isZh ? " (\u623f\u4e3b)" : " (Host)") : ""}
                      </p>
                      <p className="text-xs text-stitch-onSurfaceVariant">
                        {player.isConnected ? (isZh ? "\u5728\u7ebf" : "Online") : isZh ? "\u79bb\u7ebf" : "Offline"} |{" "}
                        {player.seatIndex === null ? (isZh ? "\u672a\u9009\u4f4d" : "No Seat") : `S${player.seatIndex + 1}`} |{" "}
                        {formatDollar(player.stack)}
                      </p>
                    </div>
                    <span
                      className={[
                        "rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em]",
                        player.isReady
                          ? "bg-stitch-mint/15 text-stitch-mint"
                          : "bg-stitch-surfaceContainerLowest text-stitch-onSurfaceVariant"
                      ].join(" ")}
                    >
                      {player.isReady ? (isZh ? "\u5df2\u51c6\u5907" : "Ready") : isZh ? "\u672a\u51c6\u5907" : "Not Ready"}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h3 className="font-headline text-2xl text-stitch-onSurface">{isZh ? "\u64cd\u4f5c" : "Actions"}</h3>

              {roomStatus === "waiting" && isHost ? (
                <div className="mt-3 rounded-2xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-xs text-stitch-onSurfaceVariant">
                    {isZh ? "\u5f00\u59cb\u524d\u8bbe\u7f6e\u76f2\u6ce8" : "Set blinds before game starts"}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-stitch-onSurfaceVariant">{isZh ? "\u5c0f\u76f2" : "SB"}</span>
                      <input
                        type="number"
                        min={1}
                        value={smallBlind}
                        onChange={(event) => setSmallBlind(Number(event.target.value))}
                        className="w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainer px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-stitch-onSurfaceVariant">{isZh ? "\u5927\u76f2" : "BB"}</span>
                      <input
                        type="number"
                        min={1}
                        value={bigBlind}
                        onChange={(event) => setBigBlind(Number(event.target.value))}
                        className="w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainer px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={
                      pendingAction !== null ||
                      smallBlind <= 0 ||
                      bigBlind <= 0 ||
                      bigBlind < smallBlind
                    }
                    className="mt-3 w-full rounded-xl bg-stitch-primary px-4 py-2 text-sm font-semibold text-stitch-onPrimary disabled:opacity-50"
                    onClick={async () => {
                      setPendingAction("blinds");
                      setError(null);
                      try {
                        const next = await updateRoomBlinds(roomCode, { smallBlind, bigBlind });
                        setRoomState(next);
                      } catch (saveBlindError) {
                        setError(
                          saveBlindError instanceof Error
                            ? saveBlindError.message
                            : isZh
                              ? "\u65e0\u6cd5\u4fdd\u5b58\u76f2\u6ce8\u8bbe\u7f6e\u3002"
                              : "Unable to update blinds."
                        );
                      } finally {
                        setPendingAction(null);
                      }
                    }}
                  >
                    {pendingAction === "blinds"
                      ? isZh
                        ? "\u4fdd\u5b58\u4e2d..."
                        : "Saving..."
                      : isZh
                        ? "\u4fdd\u5b58\u76f2\u6ce8"
                        : "Save Blinds"}
                  </button>
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-1 gap-2">
                <div className="rounded-2xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-xs text-stitch-onSurfaceVariant">
                    {isZh ? "\u5f00\u59cb\u524d\u8bf7\u5148\u9009\u5ea7\u4f4d" : "Please choose your seat before game starts"}
                  </p>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {Array.from({ length: roomState.room.maxPlayers }, (_, seatIndex) => {
                      const occupiedBy = roomState.players.find((player) => player.seatIndex === seatIndex) ?? null;
                      const occupiedByMe = occupiedBy?.userId === roomState.me?.userId;
                      const isTaken = !!occupiedBy && !occupiedByMe;
                      const isSelectedByMe = mySeatIndex === seatIndex;

                      return (
                        <button
                          key={`seat-${seatIndex}`}
                          type="button"
                          disabled={pendingAction !== null || roomStatus !== "waiting" || isTaken}
                          className={[
                            "rounded-xl border px-1 py-2 text-center text-[11px] transition",
                            isSelectedByMe
                              ? "border-stitch-primary bg-stitch-primary/20 text-stitch-primary"
                              : isTaken
                                ? "border-stitch-outlineVariant/20 bg-stitch-surfaceContainer text-stitch-onSurfaceVariant/70"
                                : "border-stitch-outlineVariant/35 bg-stitch-surfaceContainer text-stitch-onSurface hover:border-stitch-primary/50"
                          ].join(" ")}
                          onClick={async () => {
                            if (!roomCode || pendingAction !== null || roomStatus !== "waiting") {
                              return;
                            }
                            if (mySeatIndex === seatIndex) {
                              return;
                            }

                            setPendingAction("seat");
                            setError(null);
                            try {
                              const next = await setPlayerSeat(roomCode, seatIndex);
                              setRoomState(next);
                            } catch (seatError) {
                              setError(
                                seatError instanceof Error
                                  ? seatError.message
                                  : isZh
                                    ? "\u65e0\u6cd5\u9009\u62e9\u5ea7\u4f4d\u3002"
                                    : "Unable to choose seat."
                              );
                            } finally {
                              setPendingAction(null);
                            }
                          }}
                        >
                          <p className="font-semibold tracking-wide">S{seatIndex + 1}</p>
                          <p className="mt-0.5 truncate">
                            {occupiedBy
                              ? occupiedByMe
                                ? isZh
                                  ? "\u6211"
                                  : "Me"
                                : occupiedBy.displayName
                              : isZh
                                ? "\u7a7a\u4f4d"
                                : "Open"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-stitch-onSurfaceVariant">
                      {mySeatIndex === null
                        ? isZh
                          ? "\u4f60\u8fd8\u672a\u9009\u5ea7\u4f4d\u3002"
                          : "You have not selected a seat yet."
                        : isZh
                          ? `\u5df2\u9009\u5ea7\u4f4d: S${mySeatIndex + 1}`
                          : `Selected seat: S${mySeatIndex + 1}`}
                    </p>
                    {mySeatIndex !== null ? (
                      <button
                        type="button"
                        disabled={pendingAction !== null || roomStatus !== "waiting"}
                        className="rounded-lg bg-stitch-surfaceContainer px-2 py-1 text-[11px] text-stitch-onSurfaceVariant disabled:opacity-50"
                        onClick={async () => {
                          if (!roomCode || pendingAction !== null || roomStatus !== "waiting") {
                            return;
                          }

                          setPendingAction("seat");
                          setError(null);
                          try {
                            const next = await setPlayerSeat(roomCode, null);
                            setRoomState(next);
                          } catch (seatError) {
                            setError(
                              seatError instanceof Error
                                ? seatError.message
                                : isZh
                                  ? "\u65e0\u6cd5\u91cd\u7f6e\u5ea7\u4f4d\u3002"
                                  : "Unable to clear seat."
                            );
                          } finally {
                            setPendingAction(null);
                          }
                        }}
                      >
                        {isZh ? "\u91cd\u65b0\u9009\u5ea7" : "Clear Seat"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-xs text-stitch-onSurfaceVariant">
                    {isZh ? "\u5148\u8bbe\u7f6e\u4f60\u7684\u5e26\u5165\u7b79\u7801\u518d\u51c6\u5907" : "Set your buy-in chips before ready"}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={buyInInput}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/[^\d]/g, "");
                        const normalized = digits.replace(/^0+(?=\d)/, "");
                        if (!normalized) {
                          setBuyInInput("");
                          setBuyInTouched(true);
                          return;
                        }

                        const parsed = Number(normalized);
                        if (!Number.isFinite(parsed)) {
                          return;
                        }

                        const clamped = Math.min(maxBuyIn, Math.max(0, Math.floor(parsed)));
                        setBuyInInput(clamped > 0 ? String(clamped) : "");
                        setBuyInTouched(true);
                      }}
                      className="flex-1 rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainer px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50"
                    />
                    <button
                      type="button"
                      disabled={
                        pendingAction !== null ||
                        !buyInInput ||
                        Number(buyInInput) <= 0 ||
                        Number(buyInInput) > maxBuyIn
                      }
                      className="rounded-xl bg-stitch-primary px-3 py-2 text-xs font-semibold text-stitch-onPrimary disabled:opacity-50"
                      onClick={async () => {
                        const parsedBuyIn = Math.floor(Number(buyInInput));
                        const boundedBuyIn = Math.min(maxBuyIn, parsedBuyIn);

                        if (!Number.isFinite(parsedBuyIn) || boundedBuyIn <= 0) {
                          setError(isZh ? "\u5e26\u5165\u7b79\u7801\u5fc5\u987b\u5927\u4e8e 0\u3002" : "Buy-in must be greater than 0.");
                          return;
                        }

                        setPendingAction("buyin");
                        setError(null);
                        try {
                          const next = await setPlayerBuyIn(roomCode, boundedBuyIn);
                          setRoomState(next);
                          setBuyInInput(String(boundedBuyIn));
                        } catch (buyInError) {
                          setError(
                            buyInError instanceof Error
                              ? buyInError.message
                              : isZh
                                ? "\u65e0\u6cd5\u4fdd\u5b58\u7b79\u7801\u3002"
                                : "Unable to save buy-in."
                          );
                        } finally {
                          setPendingAction(null);
                        }
                      }}
                    >
                      {pendingAction === "buyin" ? (isZh ? "\u4fdd\u5b58\u4e2d..." : "Saving...") : isZh ? "\u4fdd\u5b58" : "Save"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-stitch-onSurfaceVariant">
                    {isZh ? "\u53ef\u5e26\u5165\u4e0a\u9650" : "Max Buy-in"}: {formatDollar(maxBuyIn)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={pendingAction !== null || roomStatus !== "waiting" || mySeatIndex === null}
                  className="rounded-xl bg-stitch-mint/20 px-4 py-2 text-sm font-semibold text-stitch-mint disabled:opacity-50"
                  onClick={async () => {
                    setPendingAction("ready");
                    setError(null);
                    try {
                      await setReady(roomCode, !isReady);
                    } catch (readyError) {
                      setError(
                        readyError instanceof Error
                          ? readyError.message
                          : isZh
                            ? "\u65e0\u6cd5\u66f4\u65b0\u51c6\u5907\u72b6\u6001\u3002"
                            : "Unable to set readiness."
                      );
                    } finally {
                      setPendingAction(null);
                    }
                  }}
                >
                  {pendingAction === "ready"
                    ? isZh
                      ? "\u66f4\u65b0\u4e2d..."
                      : "Updating..."
                    : isReady
                      ? isZh
                        ? "\u53d6\u6d88\u51c6\u5907"
                        : "Mark Not Ready"
                      : isZh
                        ? "\u6807\u8bb0\u51c6\u5907"
                        : "Mark Ready"}
                </button>

                {isHost ? (
                  <>
                    <button
                      type="button"
                      disabled={pendingAction !== null || !roomState.canStart}
                      className="rounded-xl bg-stitch-primary px-4 py-2 text-sm font-semibold text-stitch-onPrimary disabled:opacity-50"
                      onClick={async () => {
                        setPendingAction("start");
                        setError(null);
                        try {
                          await startRoom(roomCode);
                        } catch (startError) {
                          setError(
                            startError instanceof Error
                              ? startError.message
                              : isZh
                                ? "\u65e0\u6cd5\u5f00\u59cb\u6e38\u620f\u3002"
                                : "Unable to start room."
                          );
                        } finally {
                          setPendingAction(null);
                        }
                      }}
                    >
                      {pendingAction === "start"
                        ? isZh
                          ? "\u786e\u8ba4\u4e2d..."
                          : "Confirming..."
                        : isZh
                          ? "\u623f\u4e3b\u786e\u8ba4\u5e76\u6b63\u5f0f\u5f00\u5c40"
                          : "Host Confirm & Start"}
                    </button>
                    {!roomState.canStart ? (
                      <p className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-[11px] text-stitch-onSurfaceVariant">
                        {unseatedCount > 0
                          ? isZh
                            ? `\u8fd8\u6709 ${unseatedCount} \u540d\u73a9\u5bb6\u672a\u9009\u5ea7\u4f4d\u3002`
                            : `${unseatedCount} player(s) still need to choose seats.`
                          : isZh
                            ? "\u8bf7\u7b49\u5f85\u6240\u6709\u73a9\u5bb6\u51c6\u5907\u540e\u7531\u623f\u4e3b\u786e\u8ba4\u5f00\u5c40\u3002"
                            : "Wait for all players to be ready, then host confirms to start."}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </article>

            {roomStatus === "active" ? (
              <article className="rounded-2xl border border-stitch-primary/35 bg-stitch-primary/10 p-4">
                <p className="text-sm text-stitch-primary">
                  {isZh
                    ? "\u724c\u5c40\u8fdb\u884c\u4e2d\uff0c\u8bf7\u8fdb\u5165\u724c\u684c\u754c\u9762\u3002"
                    : "Game is active. Enter the table UI."}
                </p>
                <Link
                  href={`/${roomState.room.mode === "local" ? "local" : "online"}?room=${roomState.room.code}`}
                  className="mt-2 inline-block rounded-lg bg-stitch-primary px-3 py-1.5 text-xs font-semibold text-stitch-onPrimary"
                >
                  {isZh
                    ? roomState.room.mode === "local"
                      ? "\u8fdb\u5165\u672c\u5730\u540c\u6b65\u724c\u684c"
                      : "\u8fdb\u5165\u7ebf\u4e0a\u724c\u684c"
                    : roomState.room.mode === "local"
                      ? "Go To Local Synced Table"
                      : "Go To Online Table"}
                </Link>
              </article>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

export default function WaitingRoomPage() {
  return (
    <OnlineAuthGate title="Room Lobby" backHref="/profile">
      <WaitingRoomPageContent />
    </OnlineAuthGate>
  );
}

