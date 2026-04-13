"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { fetchRecentSessions, type RecentSession } from "@/features/auth/api";

function formatMoney(value: string, locale: AppLocale): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "$0";
  }
  const formatted = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 0
  }).format(Math.abs(amount));
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

export default function HistoryPage() {
  const { isZh, localeTag } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RecentSession[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchRecentSessions();
        setSessions(items);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : isZh ? "无法加载历史记录。" : "Unable to load history.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [isZh]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title={isZh ? "牌局历史" : "Session History"} backHref="/" />

      <section className="space-y-4 px-4 pt-4">
        {loading ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            {isZh ? "正在加载历史记录..." : "Loading history..."}
          </article>
        ) : null}

        {error ? (
          <article className="rounded-2xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 p-4 text-sm text-stitch-tertiary">
            {error}
          </article>
        ) : null}

        {!loading && !error && sessions.length === 0 ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            {isZh ? "暂无已完成牌局。" : "No completed sessions yet."}
          </article>
        ) : null}

        {!loading && !error
          ? sessions.map((session) => (
              <Link
                key={session.sessionId}
                href={`/history/${session.sessionId}`}
                className="block rounded-2xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-4"
              >
                <p className="text-sm font-semibold text-stitch-onSurface">
                  {isZh ? "房间" : "Room"} {session.roomCode} | {new Date(session.endedAtIso).toLocaleString(localeTag)}
                </p>
                <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                  {isZh ? "起始" : "Start"} {formatMoney(session.startStack, isZh ? "zh" : "en")} -&gt; {isZh ? "结束" : "End"}{" "}
                  {formatMoney(session.endStack, isZh ? "zh" : "en")}
                </p>
                <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                  {isZh ? "手数" : "Hands"}: {session.handsPlayed}/{session.totalHands}
                </p>
                <p className="mt-1 text-sm font-semibold text-stitch-mint">
                  {isZh ? "盈亏" : "P/L"}: {formatMoney(session.profitLoss, isZh ? "zh" : "en")}
                </p>
              </Link>
            ))
          : null}
      </section>
    </main>
  );
}
