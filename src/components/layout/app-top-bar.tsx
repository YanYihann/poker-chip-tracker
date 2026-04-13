"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useLanguage } from "@/components/i18n/language-provider";
import { fetchProfile } from "@/features/auth/api";
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
  const { isZh } = useLanguage();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("P");
  const hasPlayerControl =
    typeof playerCount === "number" && typeof onPlayerCountChange === "function";

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const profile = await fetchProfile();
        if (!active) {
          return;
        }
        setAvatarUrl(profile.avatarUrl);
        setUsername(profile.username);
      } catch {
        if (!active) {
          return;
        }
        setAvatarUrl(null);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  const avatarLabel = useMemo(() => {
    const first = username.trim().slice(0, 1).toUpperCase();
    return first || "P";
  }, [username]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[color:var(--panel)]/95 px-4 pb-3 pt-4 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        {backHref ? (
          <Link
            href={backHref}
            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-[color:var(--text)] transition hover:bg-white/10"
          >
            {isZh ? "\u8fd4\u56de" : "Back"}
          </Link>
        ) : (
          <Link
            href="/profile"
            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-[color:var(--text)]"
          >
            {isZh ? "\u8d26\u6237" : "Account"}
          </Link>
        )}

        <h1 className="truncate px-1 font-display text-lg tracking-[0.08em] text-[color:var(--text)]">{title}</h1>

        <Link
          href="/profile"
          aria-label={isZh ? "\u4e2a\u4eba\u8d44\u6599" : "Profile"}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/20 text-xs font-semibold text-[color:var(--accent-strong)] transition hover:brightness-110"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={isZh ? "\u5934\u50cf" : "Avatar"} className="h-full w-full object-cover" />
          ) : (
            <span>{avatarLabel}</span>
          )}
        </Link>
      </div>

      {hasPlayerControl ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            className="h-8 w-8 rounded-full bg-white/5 text-sm text-[color:var(--text)] transition hover:bg-white/10"
            onClick={() => onPlayerCountChange(Math.max(MIN_PLAYERS, playerCount - 1))}
            aria-label={isZh ? "\u51cf\u5c11\u4eba\u6570" : "Decrease players"}
          >
            -
          </button>
          <div className="rounded-full bg-[color:var(--surface)] px-4 py-1 text-xs font-semibold tracking-[0.2em] text-[color:var(--muted)]">
            {isZh ? `${playerCount} \u4eba\u684c` : `${playerCount} Players`}
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-full bg-white/5 text-sm text-[color:var(--text)] transition hover:bg-white/10"
            onClick={() => onPlayerCountChange(Math.min(MAX_PLAYERS, playerCount + 1))}
            aria-label={isZh ? "\u589e\u52a0\u4eba\u6570" : "Increase players"}
          >
            +
          </button>
        </div>
      ) : null}
    </header>
  );
}
