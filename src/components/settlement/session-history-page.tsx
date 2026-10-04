"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { SessionSettlementModal } from "./session-settlement-modal";
import { fetchCurrentUser, fetchProfile, fetchRecentSessions, type RecentSession } from "@/features/auth/api";
import type { SessionSummary } from "@/features/settlement/session-summary";
import { useArchiveStore } from "@/store/useArchiveStore";

export function SessionHistoryPage({ mode }: { mode: "local" | "online" }) {
  const { isZh, localeTag } = useLanguage();
  const entries = useArchiveStore((state) => state.entries);
  const hydrated = useArchiveStore((state) => state.hydrated);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { useArchiveStore.getState().hydrate(); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setSessions([]);
    void (async () => {
      try { await fetchCurrentUser(); } catch { if (active) setSignedIn(false); return; }
      if (!active) return;
      setSignedIn(true);
      try {
        const [items, profile] = await Promise.all([fetchRecentSessions(mode), fetchProfile()]);
        if (active) { setSessions(items); setResetAt(profile.historyResetAtIso); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Unable to load history."); }
    })().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, attempt]);
  const summaries = mode === "local" ? entries.flatMap((entry) => entry.summary && (!resetAt || entry.summary.endedAtIso > resetAt) ? [entry.summary] : []) : [];
  const formatNet = (value: string) => { const amount = BigInt(value); return `${amount > 0n ? "+" : amount < 0n ? "−" : ""}${(amount < 0n ? -amount : amount).toLocaleString(localeTag)}`; };
  return <main className="app-shell history-shell">
    <AppTopBar title={isZh ? "牌局历史" : "Session history"} backHref="/" />
    <section className="page-content local-session-history">
      <nav className="session-mode-tabs" aria-label={isZh ? "历史类型" : "History type"}>
        <Link href="/history/local" aria-current={mode === "local" ? "page" : undefined}>{isZh ? "本地历史" : "Local history"}</Link>
        <Link href="/history/online" aria-current={mode === "online" ? "page" : undefined}>{isZh ? "线上历史" : "Online history"}</Link>
      </nav>
      {loading && <p role="status" className="session-empty">{isZh ? "正在加载…" : "Loading…"}</p>}
      {!loading && !signedIn && <p className="session-empty"><Link className="text-link" href={`/auth?next=${encodeURIComponent(`/history/${mode}`)}`}>{isZh ? "登录查看房间历史" : "Sign in for room history"}</Link></p>}
      {error && <div role="alert" className="session-empty"><p>{error}</p><button type="button" className="button-secondary mt-3" onClick={() => setAttempt((value) => value + 1)}>{isZh ? "重试" : "Retry"}</button></div>}
      {sessions.map((session) => <Link key={session.sessionId} href={`/history/${session.sessionId}`} className="local-session-history-row">
        <span><strong>{isZh ? "房间" : "Room"} {session.roomCode}</strong><small>{new Date(session.endedAtIso).toLocaleString(localeTag)} · {session.handsPlayed} {isZh ? "手" : "hands"} · {isZh ? "多设备" : "Room"}</small></span>
        <span className={BigInt(session.profitLoss) < 0n ? "text-stitch-tertiary" : "text-stitch-mint"}>{isZh ? "盈亏" : "P/L"} {formatNet(session.profitLoss)} <span aria-hidden="true">→</span></span>
      </Link>)}
      {hydrated && summaries.map((summary) => <button type="button" key={summary.id} onClick={() => setSelected(summary)} className="local-session-history-row">
        <span><strong>{summary.name}</strong><small>{new Date(summary.endedAtIso).toLocaleString(localeTag)} · {summary.hands.length} {isZh ? "手" : "hands"} · {isZh ? "此设备" : "This device"}</small></span>
        <span>{isZh ? "查看结算" : "View settlement"} <span aria-hidden="true">→</span></span>
      </button>)}
      {!loading && hydrated && !error && !sessions.length && !summaries.length && <p className="session-empty">{isZh ? "暂无已完成牌局。" : "No completed sessions yet."}</p>}
    </section>
    <SessionSettlementModal isOpen={Boolean(selected)} summary={selected} onClose={() => setSelected(null)} />
  </main>;
}
