"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { useOnlineRoomTableModeAdapter } from "@/features/table/adapters/useOnlineRoomTableModeAdapter";
import { TableModeScreen } from "@/features/table/presentation/table-mode-screen";

function OnlineModePageContent() {
  const searchParams = useSearchParams();
  const roomCode = (searchParams.get("room") ?? "").toUpperCase();
  const adapter = useOnlineRoomTableModeAdapter(roomCode);
  const { isZh } = useLanguage();

  if (!roomCode) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
        <AppTopBar title={isZh ? "在线模式" : "Online Mode"} backHref="/profile" />
        <section className="space-y-3 px-4 pt-4">
          <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
            <h2 className="font-headline text-2xl text-stitch-onSurface">
              {isZh ? "选择一个房间进入牌桌" : "Choose a Room to Enter Table"}
            </h2>
            <p className="mt-2 text-sm text-stitch-onSurfaceVariant">
              {isZh
                ? "在线牌桌由服务端状态驱动。先创建房间或输入房间码加入。"
                : "Online table is server-authoritative. Create a room or join by room code first."}
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/rooms/create"
                className="rounded-xl bg-stitch-primary px-3 py-2 text-xs font-semibold text-stitch-onPrimary"
              >
                {isZh ? "创建房间" : "Create Room"}
              </Link>
              <Link
                href="/rooms/join"
                className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant"
              >
                {isZh ? "加入房间" : "Join Room"}
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <TableModeScreen adapter={adapter} />
  );
}

export default function OnlineModePage() {
  return (
    <OnlineAuthGate title="Online Mode Table" backHref="/profile">
      <Suspense fallback={<main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8" />}>
        <OnlineModePageContent />
      </Suspense>
    </OnlineAuthGate>
  );
}
