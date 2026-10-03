"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { Cards } from "@phosphor-icons/react/dist/csr/Cards";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { Globe } from "@phosphor-icons/react/dist/csr/Globe";
import { Minus } from "@phosphor-icons/react/dist/csr/Minus";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { PokerChip } from "@phosphor-icons/react/dist/csr/PokerChip";
import { Users } from "@phosphor-icons/react/dist/csr/Users";
import { useLanguage } from "@/components/i18n/language-provider";
import { fetchProfile } from "@/features/auth/api";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/table-layout";

type AppTopBarProps = { title: string; playerCount?: number; onPlayerCountChange?: (count: number) => void; backHref?: string };

export function AppTopBar({ title, playerCount, onPlayerCountChange, backHref }: AppTopBarProps) {
  const { isZh, toggleLocale } = useLanguage();
  const pathname = usePathname() ?? "";
  const [profile, setProfile] = useState<{ username: string; avatarUrl: string | null } | null>(null);
  const isAuth = pathname === "/auth";
  useEffect(() => {
    if (isAuth) return;
    let active = true;
    void fetchProfile().then((next) => { if (active) setProfile(next); }).catch(() => { if (active) setProfile(null); });
    return () => { active = false; };
  }, [isAuth]);
  const nav = [
    { href: "/online", label: isZh ? "游戏大厅" : "Lobby", icon: Users },
    { href: "/local", label: isZh ? "本地牌桌" : "Local", icon: Cards },
    { href: "/history", label: isZh ? "牌局记录" : "History", icon: ClockCounterClockwise }
  ];
  return <header className="app-top-bar">
    <div className="app-nav-row">
      <Link href="/online" className="app-brand" aria-label="PokerChip Ledger">
        <PokerChip size={30} weight="duotone" aria-hidden="true" />
        <span>PokerChip<span className="brand-ledger"> Ledger</span></span>
      </Link>
      {!isAuth && <nav className="app-nav" aria-label={isZh ? "主导航" : "Main navigation"}>
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>
          <Icon size={19} aria-hidden="true" /><span>{label}</span>
        </Link>)}
      </nav>}
      <div className="app-nav-tools">
        <button type="button" className="language-switch" onClick={toggleLocale} aria-label={isZh ? "Switch to English" : "切换中文"}>
          <Globe size={18} aria-hidden="true" /><span>{isZh ? "EN" : "中文"}</span>
        </button>
        {!isAuth && <Link href={profile ? "/profile" : "/auth?next=/online"} className={profile ? "profile-avatar" : "nav-signin"} aria-label={profile ? (isZh ? "个人资料" : "Profile") : undefined}>
          {profile ? profile.avatarUrl ? // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : profile.username.slice(0, 1).toUpperCase() : isZh ? "登录" : "Sign in"}
        </Link>}
      </div>
    </div>
    {!isAuth && <div className="workspace-heading">
      <div className="workspace-title">
        {backHref && <Link className="back-link" href={backHref} aria-label={isZh ? "返回" : "Back"}><ArrowLeft size={20} /></Link>}
        <h1>{title}</h1>
      </div>
      {typeof playerCount === "number" && onPlayerCountChange && <div className="player-count-control">
        <button type="button" disabled={playerCount <= MIN_PLAYERS} onClick={() => onPlayerCountChange(Math.max(MIN_PLAYERS, playerCount - 1))} aria-label={isZh ? "减少人数" : "Decrease players"}><Minus size={16} /></button>
        <span>{playerCount} {isZh ? "人桌" : "players"}</span>
        <button type="button" disabled={playerCount >= MAX_PLAYERS} onClick={() => onPlayerCountChange(Math.min(MAX_PLAYERS, playerCount + 1))} aria-label={isZh ? "增加人数" : "Increase players"}><Plus size={16} /></button>
      </div>}
    </div>}
  </header>;
}
