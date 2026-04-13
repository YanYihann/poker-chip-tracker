"use client";

import { useEffect } from "react";

import { useArchiveStore } from "@/store/useArchiveStore";

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

export function HistoryPagePlaceholder() {
  const entries = useArchiveStore((state) => state.entries);
  const hydrated = useArchiveStore((state) => state.hydrated);
  const hydrate = useArchiveStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-4 pb-6 pt-4">
      <section className="rounded-3xl bg-stitch-surfaceContainer p-5 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-stitch-onSurfaceVariant">Archived Sessions</p>
        <h2 className="mt-2 font-headline text-3xl text-stitch-onSurface">历史归档</h2>
        <p className="mt-2 text-sm text-stitch-onSurfaceVariant">
          展示已结算会话的归档摘要。当前仅接本地归档，不接云端。
        </p>
      </section>

      <section className="mt-4 space-y-3">
        {!hydrated ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer/90 px-4 py-3 text-sm text-stitch-onSurfaceVariant">
            读取归档中...
          </article>
        ) : null}

        {hydrated && entries.length === 0 ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer/90 px-4 py-3 text-sm text-stitch-onSurfaceVariant">
            暂无归档会话，完成一次结算后会显示在这里。
          </article>
        ) : null}

        {entries.map((session) => (
          <article
            key={session.id}
            className="rounded-2xl bg-stitch-surfaceContainer/90 px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-label text-[11px] uppercase tracking-[0.18em] text-stitch-onSurfaceVariant">Session</p>
                <p className="mt-1 text-sm font-semibold text-stitch-onSurface">{session.sessionName}</p>
                <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                  {new Date(session.endedAtIso).toLocaleString()} · {session.playerCount} 人桌
                </p>
              </div>
              <p className="font-headline text-2xl text-stitch-primary">{formatMoney(session.totalPot)}</p>
            </div>

            {session.winners.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {session.winners.map((winner) => (
                  <span
                    key={`${session.id}-${winner.playerId}`}
                    className="rounded-full border border-stitch-mint/30 bg-stitch-mint/10 px-2 py-1 text-[11px] text-stitch-mint"
                  >
                    {winner.name}: {formatMoney(winner.amount)}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
