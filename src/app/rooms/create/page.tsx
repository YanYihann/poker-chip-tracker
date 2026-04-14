"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { createRoom } from "@/features/rooms/api";

type GameMode = "local" | "online";

function clampPlayers(value: number): number {
  return Math.max(2, Math.min(10, Math.floor(value)));
}

function CreateRoomPageContent() {
  const router = useRouter();
  const { isZh } = useLanguage();
  const [mode, setMode] = useState<GameMode>("local");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safePlayers = clampPlayers(maxPlayers);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title={isZh ? "创建模式" : "Create Mode"} backHref="/profile" />

      <section className="space-y-4 px-4 pt-4">
        <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
          <h2 className="font-headline text-2xl text-stitch-onSurface">
            {isZh ? "先选择对局模式" : "Choose Game Mode"}
          </h2>
          <p className="mt-1 text-sm text-stitch-onSurfaceVariant">
            {isZh
              ? "本地模式用于线下真实发牌，只记录筹码与流程；线上模式会创建可联网同步的房间。"
              : "Local mode is for offline real dealing with chip flow tracking; online mode creates a networked room."}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={[
                "rounded-xl border px-3 py-3 text-left transition",
                mode === "local"
                  ? "border-stitch-primary/50 bg-stitch-primary/10 text-stitch-primary"
                  : "border-stitch-outlineVariant/30 bg-stitch-surfaceContainerHigh text-stitch-onSurface"
              ].join(" ")}
              onClick={() => setMode("local")}
            >
              <p className="text-sm font-semibold">{isZh ? "本地模式" : "Local Mode"}</p>
              <p className="mt-1 text-[11px] opacity-80">
                {isZh ? "线下发牌，线上仅记分" : "Offline dealing, in-app chip tracking"}
              </p>
            </button>

            <button
              type="button"
              className={[
                "rounded-xl border px-3 py-3 text-left transition",
                mode === "online"
                  ? "border-stitch-primary/50 bg-stitch-primary/10 text-stitch-primary"
                  : "border-stitch-outlineVariant/30 bg-stitch-surfaceContainerHigh text-stitch-onSurface"
              ].join(" ")}
              onClick={() => setMode("online")}
            >
              <p className="text-sm font-semibold">{isZh ? "线上模式" : "Online Mode"}</p>
              <p className="mt-1 text-[11px] opacity-80">
                {isZh ? "在线同步回合与操作" : "Realtime synchronized online gameplay"}
              </p>
            </button>
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">
              {isZh ? "玩家人数" : "Player Count"}
            </span>
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

              if (mode === "local") {
                router.push(`/local?players=${safePlayers}`);
                return;
              }

              try {
                const room = await createRoom({
                  maxPlayers: safePlayers
                });
                router.push(`/rooms/${room.room.code}`);
              } catch (createError) {
                setError(createError instanceof Error ? createError.message : isZh ? "无法创建线上房间。" : "Unable to create online room.");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading
              ? isZh
                ? mode === "local"
                  ? "进入中..."
                  : "创建中..."
                : mode === "local"
                  ? "Entering..."
                  : "Creating..."
              : isZh
                ? mode === "local"
                  ? "进入本地牌桌"
                  : "创建线上房间"
                : mode === "local"
                  ? "Enter Local Table"
                  : "Create Online Room"}
          </button>
        </article>

        <Link
          href={mode === "online" ? "/rooms/join" : "/local"}
          className="block rounded-xl bg-stitch-surfaceContainerHigh px-4 py-3 text-center text-sm text-stitch-onSurfaceVariant"
        >
          {isZh
            ? mode === "online"
              ? "已有房间码？去加入线上房间"
              : "直接进入本地模式"
            : mode === "online"
              ? "Have a code? Join an online room"
              : "Go directly to local mode"}
        </Link>
      </section>
    </main>
  );
}

export default function CreateRoomPage() {
  return (
    <OnlineAuthGate title="Create Mode" backHref="/profile">
      <CreateRoomPageContent />
    </OnlineAuthGate>
  );
}
