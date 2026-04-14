"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { joinRoom } from "@/features/rooms/api";

export default function JoinRoomPage() {
  const router = useRouter();
  const { isZh } = useLanguage();
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = roomCode.trim().toUpperCase();

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title={isZh ? "加入房间" : "Join Room"} backHref="/profile" />

      <section className="space-y-4 px-4 pt-4">
        <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
          <h2 className="font-headline text-2xl text-stitch-onSurface">{isZh ? "输入房间码" : "Enter Room Code"}</h2>
          <p className="mt-1 text-sm text-stitch-onSurfaceVariant">
            {isZh
              ? "加入等待房间，与其他玩家实时同步。"
              : "Join a waiting room and sync in realtime with other players."}
          </p>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">{isZh ? "房间码" : "Room Code"}</span>
            <input
              type="text"
              maxLength={4}
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="1234"
              className="w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 py-2 text-sm uppercase tracking-[0.12em] text-stitch-onSurface outline-none focus:border-stitch-primary/50"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">
              {isZh ? "显示名称（可选）" : "Display Name (optional)"}
            </span>
            <input
              type="text"
              maxLength={24}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={isZh ? "你的牌桌昵称" : "Your table name"}
              className="w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50"
            />
          </label>

          {error ? (
            <p className="mt-3 rounded-xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 px-3 py-2 text-xs text-stitch-tertiary">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={loading || normalizedCode.length !== 4}
            className="mt-4 w-full rounded-xl bg-stitch-primary px-4 py-2 text-sm font-semibold text-stitch-onPrimary disabled:opacity-50"
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                const room = await joinRoom({
                  roomCode: normalizedCode,
                  displayName: displayName.trim() || undefined
                });
                router.push(`/rooms/${room.room.code}`);
              } catch (joinError) {
                setError(joinError instanceof Error ? joinError.message : isZh ? "无法加入房间。" : "Unable to join room.");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? (isZh ? "加入中..." : "Joining...") : isZh ? "加入房间" : "Join Room"}
          </button>
        </article>

        <Link
          href="/rooms/create"
          className="block rounded-xl bg-stitch-surfaceContainerHigh px-4 py-3 text-center text-sm text-stitch-onSurfaceVariant"
        >
          {isZh ? "没有房间？去创建" : "Need a room? Create one"}
        </Link>
      </section>
    </main>
  );
}
