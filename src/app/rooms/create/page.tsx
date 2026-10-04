"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { PageShell } from "@/components/layout/page-shell";
import { createRoom } from "@/features/rooms/api";

type GameMode = "local" | "online";

function clampPlayers(value: number): number {
  return Math.max(2, Math.min(10, Math.floor(value)));
}

function CreateRoomPageContent() {
  const router = useRouter();
  const search = useSearchParams();
  const { isZh } = useLanguage();
  const [mode, setMode] = useState<GameMode>(() => search?.get("mode") === "local" ? "local" : "online");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [startingStack, setStartingStack] = useState(10000);
  const [smallBlind, setSmallBlind] = useState(100);
  const [bigBlind, setBigBlind] = useState(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safePlayers = clampPlayers(maxPlayers);
  const settingsValid = [maxPlayers, startingStack, smallBlind, bigBlind].every((value) => Number.isSafeInteger(value) && value > 0)
    && maxPlayers >= 2 && maxPlayers <= 10 && bigBlind >= smallBlind && startingStack >= bigBlind;

  return (
    <PageShell title={isZh ? "创建房间" : "Create a room"} backHref={mode === "local" ? "/local?devices=multiple" : "/online"} className="room-form-shell">
      <div className="room-form-layout">
        <div className="room-form-fields">
        <form className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5"
            onSubmit={async (event) => {
              event.preventDefault();
              if (loading || !settingsValid) return;
              setLoading(true);
              setError(null);

              try {
                const room = await createRoom({
                  mode,
                  maxPlayers: safePlayers,
                  startingStack,
                  smallBlind,
                  bigBlind
                });
                router.push(`/rooms/${room.room.code}`);
              } catch (createError) {
                setError(
                  createError instanceof Error
                    ? createError.message
                    : isZh
                      ? mode === "local"
                        ? "无法创建本地同步房间。"
                        : "无法创建线上房间。"
                      : mode === "local"
                        ? "Unable to create local synced room."
                        : "Unable to create online room."
                );
              } finally {
                setLoading(false);
              }
            }}
        >
          <h2 className="font-headline text-2xl text-stitch-onSurface">
            {isZh ? "对局模式" : "GAME MODE"}
          </h2>
          <div className="game-mode-options" role="group" aria-label={isZh ? "对局方式" : "Game mode"}>
            <button
              type="button"
              className={[
                "rounded-xl border px-3 py-3 text-left transition",
                mode === "local"
                  ? "border-stitch-primary/50 bg-stitch-primary/10 text-stitch-primary"
                  : "border-stitch-outlineVariant/30 bg-stitch-surfaceContainerHigh text-stitch-onSurface"
              ].join(" ")}
              aria-pressed={mode === "local"}
              onClick={() => setMode("local")}
            >
              <p className="text-sm font-semibold">{isZh ? "同步记分" : "Synced scoring"}</p>
              <p className="mt-1 text-[11px] opacity-80">
                {isZh ? "实体牌，多设备记分" : "Physical cards, shared scoring"}
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
              aria-pressed={mode === "online"}
              onClick={() => setMode("online")}
            >
              <p className="text-sm font-semibold">{isZh ? "线上对战" : "Online play"}</p>
              <p className="mt-1 text-[11px] opacity-80">
                {isZh ? "系统发牌，自动结算" : "Server dealing, auto settlement"}
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

          <label className="form-field mt-5">
            <span>{isZh ? "每人起始筹码" : "Starting chips per player"}</span>
            <input type="number" min={bigBlind || 1} step={1} required value={startingStack || ""} disabled={loading} onChange={(event) => setStartingStack(Number(event.target.value))} />
          </label>
          <p className="mt-2 text-sm text-stitch-onSurfaceVariant">{isZh ? "所有玩家使用相同筹码，入座后不可单独修改。" : "Same chips for every player. Individual buy-ins are disabled."}</p>
          <fieldset className="mt-6">
            <legend className="font-semibold">{isZh ? "设置盲注" : "Set blinds"}</legend>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="form-field"><span>{isZh ? "小盲" : "Small blind"}</span><input type="number" min={1} step={1} required value={smallBlind || ""} disabled={loading} onChange={(event) => setSmallBlind(Number(event.target.value))} /></label>
              <label className="form-field"><span>{isZh ? "大盲" : "Big blind"}</span><input type="number" min={smallBlind || 1} step={1} required value={bigBlind || ""} disabled={loading} onChange={(event) => setBigBlind(Number(event.target.value))} /></label>
            </div>
          </fieldset>
          {!settingsValid && <p role="status" className="mt-3 text-sm text-stitch-tertiary">{isZh ? "人数为 2–10；筹码和盲注须为正整数，且小盲 ≤ 大盲 ≤ 起始筹码。" : "Use 2–10 players and positive whole numbers: small blind ≤ big blind ≤ starting chips."}</p>}

          {error ? (
            <p role="alert" className="mt-3 rounded-xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 px-3 py-2 text-xs text-stitch-tertiary">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !settingsValid}
            className="button-primary mt-6 w-full"

          >
            {loading
              ? isZh
                ? mode === "local"
                  ? "创建中..."
                  : "创建中..."
                : mode === "local"
                  ? "Creating..."
                  : "Creating..."
              : isZh
                ? mode === "local"
                  ? "创建本地房间"
                  : "创建线上房间"
                : mode === "local"
                  ? "Create Local Room"
                  : "Create Online Room"}
          </button>
        </form>

        <Link
          href="/rooms/join"
          className="block rounded-xl bg-stitch-surfaceContainerHigh px-4 py-3 text-center text-sm text-stitch-onSurfaceVariant"
        >
          {isZh ? "加入房间" : "Join room"}
        </Link>
        </div>
      </div>
    </PageShell>
  );
}

export default function CreateRoomPage() {
  return (
    <Suspense fallback={null}><OnlineAuthGate title="Create Mode" backHref="/online">
      <CreateRoomPageContent />
    </OnlineAuthGate></Suspense>
  );
}
