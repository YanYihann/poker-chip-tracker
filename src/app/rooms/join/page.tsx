"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { PageShell } from "@/components/layout/page-shell";
import { joinRoom } from "@/features/rooms/api";

function JoinRoomPageContent() {
  const router = useRouter();
  const { isZh } = useLanguage();
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = roomCode.trim().toUpperCase();

  return (
    <PageShell title={isZh ? "加入房间" : "Join a room"} backHref="/online" className="room-form-shell">
      <div className="room-form-layout">
        <div className="room-form-fields">
        <form className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5"
            onSubmit={async (event) => {
              event.preventDefault();
              if (loading) return;
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
          <label className="mt-4 block">
            <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">{isZh ? "房间码" : "Room Code"}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              minLength={4}
              maxLength={4}
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="1234"
              className="room-code-input"
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
            <p role="alert" className="mt-3 rounded-xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 px-3 py-2 text-xs text-stitch-tertiary">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || normalizedCode.length !== 4}
            className="button-primary mt-6 w-full"

          >
            {loading ? (isZh ? "加入中..." : "Joining...") : isZh ? "加入房间" : "Join Room"}
          </button>
        </form>

        <Link
          href="/rooms/create"
          className="block rounded-xl bg-stitch-surfaceContainerHigh px-4 py-3 text-center text-sm text-stitch-onSurfaceVariant"
        >
          {isZh ? "创建房间" : "Create room"}
        </Link>
        </div>
      </div>
    </PageShell>
  );
}

export default function JoinRoomPage() {
  return (
    <OnlineAuthGate title="Join Room" backHref="/online">
      <JoinRoomPageContent />
    </OnlineAuthGate>
  );
}
