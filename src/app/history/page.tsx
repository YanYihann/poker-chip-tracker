"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AppTopBar } from "@/components/layout/app-top-bar";
import { fetchRecentSessions, type RecentSession } from "@/features/auth/api";

function formatMoney(value: string): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "$0";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

export default function HistoryPage() {
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
        setError(loadError instanceof Error ? loadError.message : "Unable to load history.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title="Session History" backHref="/" />

      <section className="space-y-4 px-4 pt-4">
        {loading ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            Loading history...
          </article>
        ) : null}

        {error ? (
          <article className="rounded-2xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 p-4 text-sm text-stitch-tertiary">
            {error}
          </article>
        ) : null}

        {!loading && !error && sessions.length === 0 ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            No completed sessions yet.
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
                  Room {session.roomCode} | {new Date(session.endedAtIso).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                  Start {formatMoney(session.startStack)} -&gt; End {formatMoney(session.endStack)}
                </p>
                <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                  Hands: {session.handsPlayed}/{session.totalHands}
                </p>
                <p className="mt-1 text-sm font-semibold text-stitch-mint">
                  P/L: {formatMoney(session.profitLoss)}
                </p>
              </Link>
            ))
          : null}
      </section>
    </main>
  );
}
