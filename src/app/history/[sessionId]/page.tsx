"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AppTopBar } from "@/components/layout/app-top-bar";
import { fetchSessionDetail, type SessionDetail } from "@/features/auth/api";

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

export default function SessionDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await fetchSessionDetail(sessionId);
        setDetail(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load session detail.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [sessionId]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title="Session Detail" backHref="/history" />

      <section className="space-y-4 px-4 pt-4">
        {loading ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            Loading session detail...
          </article>
        ) : null}

        {error ? (
          <article className="rounded-2xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 p-4 text-sm text-stitch-tertiary">
            {error}
          </article>
        ) : null}

        {detail ? (
          <>
            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h2 className="font-headline text-2xl text-stitch-onSurface">Room {detail.session.roomCode}</h2>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                {new Date(detail.session.startedAtIso).toLocaleString()} -&gt;{" "}
                {new Date(detail.session.endedAtIso).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                Total Hands: {detail.session.totalHands}
              </p>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h3 className="font-headline text-2xl text-stitch-onSurface">My Result</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">Start Stack</p>
                  <p className="mt-1 text-sm font-semibold text-stitch-onSurface">
                    {formatMoney(detail.me.startStack)}
                  </p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">End Stack</p>
                  <p className="mt-1 text-sm font-semibold text-stitch-onSurface">{formatMoney(detail.me.endStack)}</p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">Profit/Loss</p>
                  <p className="mt-1 text-sm font-semibold text-stitch-mint">
                    {formatMoney(detail.me.profitLoss)}
                  </p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">Hands Played</p>
                  <p className="mt-1 text-sm font-semibold text-stitch-onSurface">{detail.me.handsPlayed}</p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h3 className="font-headline text-2xl text-stitch-onSurface">Table Results</h3>
              <div className="mt-3 space-y-2">
                {detail.players.map((player) => (
                  <div
                    key={player.userId}
                    className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant"
                    >
                    <p className="text-sm font-semibold text-stitch-onSurface">{player.username}</p>
                    <p className="mt-1">
                      {formatMoney(player.startStack)} -&gt; {formatMoney(player.endStack)} | P/L{" "}
                      {formatMoney(player.profitLoss)} | Hands {player.handsPlayed}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </>
        ) : null}
      </section>
    </main>
  );
}
