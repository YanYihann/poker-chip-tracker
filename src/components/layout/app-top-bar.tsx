import Link from "next/link";

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
  const hasPlayerControl =
    typeof playerCount === "number" && typeof onPlayerCountChange === "function";

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[color:var(--panel)]/95 px-4 pb-3 pt-4 backdrop-blur">
      <div className="flex items-center justify-between">
        {backHref ? (
          <Link
            href={backHref}
            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-[color:var(--text)] transition hover:bg-white/10"
          >
            返回牌桌
          </Link>
        ) : (
          <Link
            href="/profile"
            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-[color:var(--text)]"
          >
            账户
          </Link>
        )}

        <h1 className="font-display text-lg tracking-[0.08em] text-[color:var(--text)]">{title}</h1>

        <Link
          href="/history"
          className="rounded-full bg-[color:var(--accent)]/20 px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-strong)] transition hover:bg-[color:var(--accent)]/30"
        >
          历史
        </Link>
      </div>

      {hasPlayerControl ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            className="h-8 w-8 rounded-full bg-white/5 text-sm text-[color:var(--text)] transition hover:bg-white/10"
            onClick={() => onPlayerCountChange(Math.max(MIN_PLAYERS, playerCount - 1))}
            aria-label="减少人数"
          >
            -
          </button>
          <div className="rounded-full bg-[color:var(--surface)] px-4 py-1 text-xs font-semibold tracking-[0.2em] text-[color:var(--muted)]">
            {playerCount} 人桌
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-full bg-white/5 text-sm text-[color:var(--text)] transition hover:bg-white/10"
            onClick={() => onPlayerCountChange(Math.min(MAX_PLAYERS, playerCount + 1))}
            aria-label="增加人数"
          >
            +
          </button>
        </div>
      ) : null}
    </header>
  );
}
