"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AppTopBar } from "@/components/layout/app-top-bar";
import { getRoom, setReady, startRoom, type RoomState } from "@/features/rooms/api";
import { getRoomSocket } from "@/features/rooms/realtime";

export default function WaitingRoomPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = (params.roomCode ?? "").toUpperCase();

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"ready" | "start" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHost = roomState?.me?.isHost ?? false;
  const isReady = roomState?.me?.isReady ?? false;
  const roomStatus = roomState?.room.status ?? "waiting";

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
    let active = true;
    const socket = getRoomSocket();

    const loadInitial = async () => {
      setLoading(true);
      setError(null);
      try {
        const state = await getRoom(roomCode);
        if (active) {
          setRoomState(state);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load room.");
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
      setError(payload.message ?? "Realtime room error.");
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
  }, [roomCode]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title={`Room ${roomCode}`} backHref="/profile" />

      <section className="space-y-4 px-4 pt-4">
        {loading ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            Loading room...
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
                Login
              </Link>
              <Link
                href="/rooms/join"
                className="rounded-lg bg-stitch-surfaceContainerHigh px-3 py-1.5 text-xs text-stitch-onSurfaceVariant"
              >
                Join Another Room
              </Link>
            </div>
          </article>
        ) : null}

        {roomState ? (
          <>
            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-stitch-onSurfaceVariant">Lobby</p>
              <h2 className="mt-1 font-headline text-3xl text-stitch-onSurface">{roomState.room.code}</h2>
              <p className="mt-1 text-sm text-stitch-onSurfaceVariant">
                Status: <strong className="text-stitch-primary">{roomStatus}</strong> - Players:{" "}
                {roomState.players.length}/{roomState.room.maxPlayers}
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
                        {player.isHost ? " (Host)" : ""}
                      </p>
                      <p className="text-xs text-stitch-onSurfaceVariant">
                        {player.isConnected ? "Online" : "Offline"}
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
                      {player.isReady ? "Ready" : "Not Ready"}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h3 className="font-headline text-2xl text-stitch-onSurface">Actions</h3>
              <p className="mt-1 text-sm text-stitch-onSurfaceVariant">
                Room membership and readiness are server-authoritative and synced via WebSocket.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={pendingAction !== null || roomStatus !== "waiting"}
                  className="rounded-xl bg-stitch-mint/20 px-4 py-2 text-sm font-semibold text-stitch-mint disabled:opacity-50"
                  onClick={async () => {
                    setPendingAction("ready");
                    setError(null);
                    try {
                      await setReady(roomCode, !isReady);
                    } catch (readyError) {
                      setError(readyError instanceof Error ? readyError.message : "Unable to set readiness.");
                    } finally {
                      setPendingAction(null);
                    }
                  }}
                >
                  {pendingAction === "ready" ? "Updating..." : isReady ? "Mark Not Ready" : "Mark Ready"}
                </button>

                {isHost ? (
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
                        setError(startError instanceof Error ? startError.message : "Unable to start room.");
                      } finally {
                        setPendingAction(null);
                      }
                    }}
                  >
                    {pendingAction === "start" ? "Starting..." : "Host Start Game"}
                  </button>
                ) : null}
              </div>
            </article>

            {roomStatus === "active" ? (
              <article className="rounded-2xl border border-stitch-primary/35 bg-stitch-primary/10 p-4">
                <p className="text-sm text-stitch-primary">
                  Game has started. Table actions are now server-authoritative and synced in realtime.
                </p>
                <Link
                  href={`/?room=${roomState.room.code}`}
                  className="mt-2 inline-block rounded-lg bg-stitch-primary px-3 py-1.5 text-xs font-semibold text-stitch-onPrimary"
                >
                  Go To Table UI
                </Link>
              </article>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

