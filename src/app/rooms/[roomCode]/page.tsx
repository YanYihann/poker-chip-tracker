"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Copy } from "@phosphor-icons/react/dist/csr/Copy";
import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { PokerTable } from "@/components/table/poker-table";
import type { TableSeatPlayer } from "@/components/player/types";
import { releaseTableFullscreen, requestTableFullscreen } from "@/lib/table-fullscreen";
import { getRoom, getRoomSyncEpoch, setPlayerSeat, startRoom, type RoomState } from "@/features/rooms/api";
import { getRoomSocket } from "@/features/rooms/realtime";

function WaitingRoomPageContent() {
  const params = useParams<{ roomCode: string }>();
  const router = useRouter();
  const roomCode = (params?.roomCode ?? "").toUpperCase();
  const { isZh } = useLanguage();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"seat" | "start" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const socket = getRoomSocket();
    const epoch = getRoomSyncEpoch();
    setLoading(true);
    setError(null);
    void getRoom(roomCode).then((state) => {
      if (active && getRoomSyncEpoch() === epoch) setRoomState(state);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load room.");
    }).finally(() => { if (active) setLoading(false); });
    const onState = (state: RoomState) => {
      if (active && state.room.code === roomCode) { setRoomState(state); setLoading(false); }
    };
    const onError = (cause: { message?: string }) => {
      if (active) setError(cause.message ?? "Room connection failed.");
    };
    socket.on("room:state", onState);
    socket.on("room:error", onError);
    socket.emit("room:subscribe", { roomCode });
    return () => {
      active = false;
      socket.emit("room:unsubscribe", { roomCode });
      socket.off("room:state", onState);
      socket.off("room:error", onError);
    };
  }, [roomCode, attempt]);

  useEffect(() => {
    if (roomState?.room.status === "active" || roomState?.room.status === "finished") router.replace(`/${roomState.room.mode === "local" ? "local" : "online"}?room=${encodeURIComponent(roomCode)}`);
  }, [roomState?.room.status, roomState?.room.mode, roomCode, router]);

  async function selectSeat(seatIndex: number) {
    if (pending) return;
    setPending("seat"); setError(null);
    try { setRoomState(await setPlayerSeat(roomCode, seatIndex)); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : isZh ? "换座失败，请重试。" : "Unable to change seat. Try again.");
      void getRoom(roomCode).then(setRoomState).catch(() => undefined);
    } finally { setPending(null); }
  }

  const waiting = roomState?.room.status === "waiting";
  const seats: TableSeatPlayer[] = roomState ? Array.from({ length: roomState.room.maxPlayers }, (_, seatIndex) => {
    const player = roomState.players.find((item) => item.seatIndex === seatIndex);
    if (!player) return {
      id: `empty-${seatIndex}`, name: `S${seatIndex + 1}`, stackLabel: "", status: "waiting",
      seatIndex, seatCount: roomState.room.maxPlayers, isPlaceholder: true,
      onPress: waiting && !pending ? () => void selectSeat(seatIndex) : undefined
    };
    const isMe = player.userId === roomState.me?.userId;
    return {
      id: player.userId, name: player.displayName, avatarUrl: player.avatarUrl,
      stackLabel: roomState.room.startingStack.toLocaleString(), status: "waiting", isHero: isMe,
      seatIndex, seatCount: roomState.room.maxPlayers,
      positionLabel: [isMe ? (isZh ? "你" : "You") : "", player.isHost ? (isZh ? "房主" : "Host") : (isZh ? "已准备" : "Ready")].filter(Boolean).join(" · ")
    };
  }) : [];

  return <main className="app-shell waiting-shell">
    <AppTopBar title={isZh ? "等待开局" : "Waiting room"} backHref="/online" />
    <section className="page-content">
      {loading && !roomState && <p role="status" className="py-8 text-stitch-onSurfaceVariant">{isZh ? "正在加载房间…" : "Loading room…"}</p>}
      {error && <div className="form-error mb-5" role="alert"><p>{error}</p>{!roomState && <button className="text-link" onClick={() => setAttempt((value) => value + 1)}>{isZh ? "重试" : "Retry"}</button>}</div>}
      {roomState && <div className="waiting-layout">
        <div className="waiting-table">
          <PokerTable players={seats} potLabel="" streetLabel="" statusLabel="" street="preflop" handKey={`waiting-${roomCode}`} centerContent={<>
            <span>{isZh ? "房间码" : "Room code"}</span>
            <h2 className="waiting-code">{roomCode}</h2>
            <button type="button" className="waiting-copy" onClick={async () => {
              try { await navigator.clipboard.writeText(roomCode); setCopied(true); }
              catch { setError(isZh ? "复制失败，请手动输入房间码。" : "Copy failed. Enter the room code manually."); }
            }}><Copy size={16} aria-hidden="true" />{copied ? (isZh ? "已复制" : "Copied") : (isZh ? "复制" : "Copy")}</button>
            <span aria-live="polite">{roomState.players.length} / {roomState.room.maxPlayers} {isZh ? "人已入座" : "seated"}</span>
          </>} />
          <p className="waiting-seat-help">{isZh ? "点击空座换位 · 入座后自动准备" : "Select an empty seat to move · Ready automatically"}</p>
        </div>
        <aside className="waiting-settings">
          <h2>{isZh ? "牌局设置" : "Game settings"}</h2>
          <dl>
            <div><dt>{isZh ? "模式" : "Mode"}</dt><dd>{roomState.room.mode === "online" ? (isZh ? "线上对战" : "Online play") : (isZh ? "同步记分" : "Synced scoring")}</dd></div>
            <div><dt>{isZh ? "每人筹码" : "Chips per player"}</dt><dd>{roomState.room.startingStack.toLocaleString()}</dd></div>
            <div><dt>{isZh ? "小盲 / 大盲" : "Small / big blind"}</dt><dd>{roomState.room.smallBlind.toLocaleString()} / {roomState.room.bigBlind.toLocaleString()}</dd></div>
          </dl>
          {waiting ? <>
            <p className="waiting-status" role="status">{roomState.players.length < 2 ? (isZh ? "至少 2 人即可开始" : "At least 2 players required") : (isZh ? "所有玩家已准备" : "All players ready")}</p>
            {roomState.me?.isHost ? <button className="button-primary w-full" disabled={!roomState.canStart || !!pending} onClick={async () => {
              setPending("start"); setError(null);
              try { void requestTableFullscreen(); setRoomState(await startRoom(roomCode)); }
              catch (cause) { releaseTableFullscreen(); setError(cause instanceof Error ? cause.message : isZh ? "开局失败，请重试。" : "Unable to start. Try again."); }
              finally { setPending(null); }
            }}>{pending === "start" ? (isZh ? "正在开局…" : "Starting…") : (isZh ? "开始游戏" : "Start game")}</button> : <p className="waiting-host-note">{isZh ? "等待房主开始，开局后自动进入牌桌。" : "Waiting for the host. The table opens automatically."}</p>}
          </> : roomState.room.status === "active" ? <p role="status">{isZh ? "正在进入牌桌…" : "Opening table…"}</p> : <><p>{isZh ? "房间已结束" : "Room closed"}</p><Link className="text-link" href="/online">{isZh ? "返回大厅" : "Back to lobby"}</Link></>}
        </aside>
      </div>}
    </section>
  </main>;
}

export default function WaitingRoomPage() {
  return <OnlineAuthGate title="Waiting room" backHref="/online"><WaitingRoomPageContent /></OnlineAuthGate>;
}
