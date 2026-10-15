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
import { getRoom, getRoomSyncEpoch, setPlayerSeat, setReady, startRoom, type RoomState } from "@/features/rooms/api";
import { getRoomSocket } from "@/features/rooms/realtime";
import { cancelMatch, getMatchState, heartbeatMatch } from "@/features/matchmaking/api";
import { MATCH_TIER_LABELS } from "@/features/matchmaking/settings";

function WaitingRoomPageContent() {
  const params = useParams<{ roomCode: string }>();
  const router = useRouter();
  const roomCode = (params?.roomCode ?? "").toUpperCase();
  const { isZh } = useLanguage();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"seat" | "start" | "ready" | "cancel" | null>(null);
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

  const matchTier = roomState?.room.matchmakingTier;
  const roomStatus = roomState?.room.status;
  useEffect(() => {
    if (!matchTier || roomStatus !== "waiting") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const renew = async () => {
      try {
        const response = await getMatchState();
        if (stopped) return;
        if (response.match.status !== "matched" || response.match.roomCode !== roomCode) {
          router.replace("/online/match"); return;
        }
        const renewed = await heartbeatMatch(response.match.ticketId);
        if (!stopped && renewed.match.status === "idle") { router.replace("/online/match"); return; }
      } catch {
        if (!stopped) setError(isZh ? "准备桌连接中断，正在重试…" : "Table connection interrupted. Retrying…");
      }
      if (!stopped) timer = setTimeout(() => void renew(), 8000);
    };
    void renew();
    return () => { stopped = true; clearTimeout(timer); };
  }, [matchTier, roomStatus, roomCode, router, isZh]);

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
      positionLabel: matchTier ? (player.isReady ? (isZh ? "已准备" : "Ready") : (isZh ? "未准备" : "Not ready")) : [isMe ? (isZh ? "你" : "You") : "", player.isHost ? (isZh ? "房主" : "Host") : (isZh ? "已准备" : "Ready")].filter(Boolean).join(" · ")
    };
  }) : [];

  return <main className="app-shell waiting-shell">
    <AppTopBar title={matchTier ? (isZh ? "匹配准备" : "Prepare to play") : (isZh ? "等待开局" : "Waiting room")} backHref="/online" />
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
          <p className="waiting-seat-help">{matchTier ? (isZh ? "选择位置后点击准备 · 可与未准备玩家换位" : "Choose your position, then ready up · Swap with an unready player") : (isZh ? "点击空座换位 · 入座后自动准备" : "Select an empty seat to move · Ready automatically")}</p>
        </div>
        <aside className="waiting-settings">
          <h2>{isZh ? "牌局设置" : "Game settings"}</h2>
          <dl>
            <div><dt>{isZh ? "模式" : "Mode"}</dt><dd>{roomState.room.mode === "online" ? (isZh ? "线上对战" : "Online play") : (isZh ? "同步记分" : "Synced scoring")}</dd></div>
            {matchTier && <div><dt>{isZh ? "场次" : "Stakes"}</dt><dd>{MATCH_TIER_LABELS[matchTier][isZh ? "zh" : "en"]}</dd></div>}
            <div><dt>{isZh ? "每人筹码" : "Chips per player"}</dt><dd>{roomState.room.startingStack.toLocaleString()}</dd></div>
            <div><dt>{isZh ? "小盲 / 大盲" : "Small / big blind"}</dt><dd>{roomState.room.smallBlind.toLocaleString()} / {roomState.room.bigBlind.toLocaleString()}</dd></div>
          </dl>
          {waiting && matchTier ? <>
            <label className="waiting-seat-label" htmlFor="prepare-seat">{isZh ? "我的位置" : "My seat"}</label>
            <select id="prepare-seat" className="waiting-seat-select" value={roomState.me?.seatIndex ?? ""} disabled={!!pending} onChange={(event) => void selectSeat(Number(event.target.value))}>
              {Array.from({ length: roomState.room.maxPlayers }, (_, seat) => {
                const occupant = roomState.players.find((p) => p.seatIndex === seat);
                const mine = occupant?.userId === roomState.me?.userId;
                return <option key={seat} value={seat} disabled={!!occupant?.isReady && !mine}>{isZh ? "位置" : "Seat"} {seat + 1}{occupant && !mine ? ` · ${occupant.displayName}${occupant.isReady ? (isZh ? "（已准备）" : " (ready)") : ""}` : ""}</option>;
              })}
            </select>
            <p className="waiting-status" role="status">{isZh ? `已进入 ${roomState.players.length} / ${roomState.room.maxPlayers} 人，已准备 ${roomState.players.filter((p) => p.isReady).length} / ${roomState.room.maxPlayers} 人。满员且全员准备后自动开局。` : `${roomState.players.length} / ${roomState.room.maxPlayers} joined · ${roomState.players.filter((p) => p.isReady).length} / ${roomState.room.maxPlayers} ready. Starts automatically when full and everyone is ready.`}</p>
            <button type="button" className={roomState.me?.isReady ? "button-secondary w-full" : "button-primary w-full"} disabled={!!pending || !roomState.me} onClick={async () => {
              setPending("ready"); setError(null);
              try { void requestTableFullscreen(); setRoomState(await setReady(roomCode, !roomState.me?.isReady)); }
              catch (cause) { setError(cause instanceof Error ? cause.message : isZh ? "准备失败，请重试。" : "Unable to ready up. Try again."); }
              finally { setPending(null); }
            }}>{pending === "ready" ? (isZh ? "正在更新…" : "Updating…") : roomState.me?.isReady ? (isZh ? "取消准备" : "Unready") : (isZh ? "准备" : "Ready")}</button>
            <button type="button" className="button-secondary waiting-cancel" disabled={!!pending} onClick={async () => {
              setPending("cancel"); setError(null);
              try {
                const response = await getMatchState();
                const result = response.match.status === "matched" && response.match.roomCode === roomCode ? await cancelMatch(response.match.ticketId) : response;
                if (result.match.status === "matched") setRoomState(await getRoom(result.match.roomCode));
                else { releaseTableFullscreen(); router.replace("/online/match"); }
              } catch (cause) { setError(cause instanceof Error ? cause.message : isZh ? "取消失败，请重试。" : "Unable to cancel. Try again."); }
              finally { setPending(null); }
            }}>{pending === "cancel" ? (isZh ? "正在退出…" : "Leaving…") : (isZh ? "退出匹配" : "Leave match")}</button>
          </> : waiting ? <>
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
