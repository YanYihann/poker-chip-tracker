"use client";

import Link from "next/link";

import { useLanguage } from "@/components/i18n/language-provider";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/table-layout";

type AppTopBarProps = {
  title: string;
  playerCount?: number;
  onPlayerCountChange?: (nextCount: number) => void;
  backHref?: string;
};

export function AppTopBar({
  title,
  playerCount,
  onPlayerCountChange,
  backHref
}: AppTopBarProps) {
  const { isZh, toggleLocale } = useLanguage();
  const hasPlayerControl =
    typeof playerCount === "number" && typeof onPlayerCountChange === "function";

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[color:var(--panel)]/95 px-4 pb-3 pt-4 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        {backHref ? (
          <Link
            href={backHref}
            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-[color:var(--text)] transition hover:bg-white/10"
          >
            {isZh ? "返回" : "Back"}
          </Link>
        ) : (
          <Link
            href="/profile"
            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-[color:var(--text)]"
          >
            {isZh ? "账户" : "Account"}
          </Link>
        )}

        <h1 className="truncate px-1 font-display text-lg tracking-[0.08em] text-[color:var(--text)]">{title}</h1>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-[color:var(--text)] transition hover:bg-white/10"
            onClick={toggleLocale}
            aria-label={isZh ? "切换到英文" : "Switch to Chinese"}
          >
            {isZh ? "EN" : "中"}
          </button>
          <Link
            href="/history"
            className="rounded-full bg-[color:var(--accent)]/20 px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-strong)] transition hover:bg-[color:var(--accent)]/30"
          >
            {isZh ? "历史" : "History"}
          </Link>
        </div>
      </div>

      {hasPlayerControl ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            className="h-8 w-8 rounded-full bg-white/5 text-sm text-[color:var(--text)] transition hover:bg-white/10"
            onClick={() => onPlayerCountChange(Math.max(MIN_PLAYERS, playerCount - 1))}
            aria-label={isZh ? "减少人数" : "Decrease players"}
          >
            -
          </button>
          <div className="rounded-full bg-[color:var(--surface)] px-4 py-1 text-xs font-semibold tracking-[0.2em] text-[color:var(--muted)]">
            {isZh ? `${playerCount} 人桌` : `${playerCount} Players`}
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-full bg-white/5 text-sm text-[color:var(--text)] transition hover:bg-white/10"
            onClick={() => onPlayerCountChange(Math.min(MAX_PLAYERS, playerCount + 1))}
            aria-label={isZh ? "增加人数" : "Increase players"}
          >
            +
          </button>
        </div>
      ) : null}
    </header>
  );
}