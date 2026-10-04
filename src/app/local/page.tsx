"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { PageShell } from "@/components/layout/page-shell";
import { useOnlineRoomTableModeAdapter } from "@/features/table/adapters/useOnlineRoomTableModeAdapter";
import { useLocalTableModeAdapter } from "@/features/table/adapters/useLocalTableModeAdapter";
import { TableModeScreen } from "@/features/table/presentation/table-mode-screen";

function DeviceOptions({ multiple }: { multiple: boolean }) {
  const { isZh } = useLanguage();
  return <nav className="session-mode-tabs" aria-label={isZh ? "设备模式" : "Device mode"}>
    <Link href="/local" aria-current={!multiple ? "page" : undefined}>{isZh ? "单设备" : "Single device"}</Link>
    <Link href="/local?devices=multiple" aria-current={multiple ? "page" : undefined}>{isZh ? "多设备" : "Multiple devices"}</Link>
  </nav>;
}

function OfflineLocalTable() {
  const adapter = useLocalTableModeAdapter();
  const search = useSearchParams();
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const value = search?.get("players");
    const count = Number(value);
    if (value && Number.isFinite(count)) adapter.onPlayerCountChange?.(Math.max(2, Math.min(10, Math.floor(count))));
  }, [adapter.onPlayerCountChange, search]);
  return <TableModeScreen adapter={adapter} headerContent={<DeviceOptions multiple={false} />} />;
}

function SyncedLocalTable({ roomCode }: { roomCode: string }) {
  const adapter = useOnlineRoomTableModeAdapter(roomCode, { variant: "local" });
  return <OnlineAuthGate title={adapter.title} backHref={adapter.backHref}><TableModeScreen adapter={adapter} /></OnlineAuthGate>;
}

function LocalModePageContent() {
  const search = useSearchParams();
  const { isZh } = useLanguage();
  const roomCode = (search?.get("room") ?? "").toUpperCase();
  if (roomCode) return <SyncedLocalTable roomCode={roomCode} />;
  if (search?.get("devices") !== "multiple") return <OfflineLocalTable />;
  return <PageShell title={isZh ? "本地牌桌" : "Local table"} backHref="/">
    <DeviceOptions multiple />
    <article className="local-multidevice-entry rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
      <h2 className="font-headline text-2xl">{isZh ? "多设备记分" : "Shared scoring"}</h2>
      <p className="mt-3 text-sm text-stitch-onSurfaceVariant">{isZh ? "使用实体牌，每位玩家在自己的设备操作。房主设置统一筹码和盲注，用房间码加入。需要登录和联网。" : "Physical cards. Each player acts on their own device. The host sets equal starting chips and blinds; players join with a room code. Sign-in and internet required."}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link href="/rooms/create?mode=local" className="button-primary flex min-h-11 items-center justify-center">{isZh ? "创建本地房间" : "Create local room"}</Link>
        <Link href="/rooms/join" className="button-secondary flex min-h-11 items-center justify-center">{isZh ? "加入房间" : "Join room"}</Link>
      </div>
    </article>
  </PageShell>;
}

export default function LocalModePage() {
  return <Suspense fallback={<main className="app-shell" />}><LocalModePageContent /></Suspense>;
}
