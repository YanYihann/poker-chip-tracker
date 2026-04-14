"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { createRoom } from "@/features/rooms/api";

function CreateRoomPageContent() {
  const router = useRouter();
  const { isZh } = useLanguage();
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title={isZh ? "创建房间" : "Create Room"} backHref="/profile" />

      <section className="space-y-4 px-4 pt-4">
        <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
          <h2 className="font-headline text-2xl text-stitch-onSurface">{isZh ? "新大厅" : "New Lobby"}</h2>
          <p className="mt-1 text-sm text-stitch-onSurfaceVariant">
            {isZh
              ? "创建房间后分享房间码，等待玩家加入。"
              : "Create a room, share code, and wait for players to join."}
          </p>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">{isZh ? "最大人数" : "Max Players"}</span>
            <input
              type="number"
              min={2}
              max={10}
              value={maxPlayers}
              onChange={(event) => setMaxPlayers(Number(event.target.value))}
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
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-stitch-primary px-4 py-2 text-sm font-semibold text-stitch-onPrimary disabled:opacity-50"
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                const room = await createRoom({
                  maxPlayers: Math.max(2, Math.min(10, maxPlayers))
                });
                router.push(`/rooms/${room.room.code}`);
              } catch (createError) {
                setError(createError instanceof Error ? createError.message : isZh ? "无法创建房间。" : "Unable to create room.");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? (isZh ? "创建中..." : "Creating...") : isZh ? "创建房间" : "Create Room"}
          </button>
        </article>

        <Link
          href="/rooms/join"
          className="block rounded-xl bg-stitch-surfaceContainerHigh px-4 py-3 text-center text-sm text-stitch-onSurfaceVariant"
        >
          {isZh ? "已有房间码？去加入" : "Have a code? Join a room"}
        </Link>
      </section>
    </main>
  );
}

export default function CreateRoomPage() {
  return (
    <OnlineAuthGate title="Create Room" backHref="/profile">
      <CreateRoomPageContent />
    </OnlineAuthGate>
  );
}
