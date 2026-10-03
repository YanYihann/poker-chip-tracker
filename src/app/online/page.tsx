"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage } from "@/components/i18n/language-provider";
import { PageShell } from "@/components/layout/page-shell";
import { EntryArt } from "@/components/layout/entry-art";
import { useOnlineRoomTableModeAdapter } from "@/features/table/adapters/useOnlineRoomTableModeAdapter";
import { TableModeScreen } from "@/features/table/presentation/table-mode-screen";

function OnlineTable({ roomCode }: { roomCode: string }) {
  const adapter = useOnlineRoomTableModeAdapter(roomCode);
  return <TableModeScreen adapter={adapter} />;
}
function OnlineModePageContent() {
  const searchParams = useSearchParams();
  const roomCode = (searchParams?.get("room") ?? "").toUpperCase();
  const { isZh } = useLanguage();
  if (roomCode) return <OnlineAuthGate title={isZh ? "线上牌桌" : "Online table"} backHref="/online"><OnlineTable roomCode={roomCode} /></OnlineAuthGate>;
  return <PageShell title={isZh ? "游戏大厅" : "Game lobby"} className="lobby-shell">
    <section className="game-menu" aria-label={isZh ? "游戏模式" : "Game modes"}>
      <div className="game-menu-title"><h2>TEXAS<br /><span>HOLD’EM</span></h2><p>{isZh ? "德州扑克 · 2–10 人" : "Texas Hold’em · 2–10 players"}</p></div>
      <EntryArt />
      <div className="game-menu-actions">
        <Link href="/rooms/create" className="game-menu-button menu-host"><span>{isZh ? "创建房间" : "CREATE ROOM"}<small>{isZh ? "线上发牌 / 多人同步记分" : "Online play / synced scoring"}</small></span><ArrowRight size={24} aria-hidden="true" /></Link>
        <Link href="/rooms/join" className="game-menu-button menu-join"><span>{isZh ? "加入房间" : "JOIN ROOM"}<small>{isZh ? "输入 4 位房间码" : "Enter a 4-digit room code"}</small></span><ArrowRight size={24} aria-hidden="true" /></Link>
        <Link href="/local" className="game-menu-button menu-local"><span>{isZh ? "本地记分" : "LOCAL GAME"}<small>{isZh ? "实体牌 · 单设备 · 无需登录" : "Physical cards · One device · No account"}</small></span><ArrowRight size={24} aria-hidden="true" /></Link>
      </div>
    </section>
  </PageShell>;
}
export default function OnlineModePage() {
  return <Suspense fallback={<main className="app-shell"><div className="loading-skeleton" /></main>}><OnlineModePageContent /></Suspense>;
}
