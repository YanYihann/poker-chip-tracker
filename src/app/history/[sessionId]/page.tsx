"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { fetchSessionDetail, type SessionDetail } from "@/features/auth/api";

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

export default function SessionDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId ?? "";
  const { isZh, localeTag } = useLanguage();
  const locale: AppLocale = isZh ? "zh" : "en";

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
        setError(
          loadError instanceof Error
            ? loadError.message
            : isZh
              ? "\u65e0\u6cd5\u52a0\u8f7d\u724c\u5c40\u8be6\u60c5\u3002"
              : "Unable to load session detail."
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [isZh, sessionId]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title={isZh ? "\u724c\u5c40\u8be6\u60c5" : "Session Detail"} backHref="/history" />

      <section className="space-y-4 px-4 pt-4">
        {loading ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            {isZh ? "\u6b63\u5728\u52a0\u8f7d\u724c\u5c40\u8be6\u60c5..." : "Loading session detail..."}
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
              <h2 className="font-headline text-2xl text-stitch-onSurface">
                {isZh ? "\u623f\u95f4" : "Room"} {detail.session.roomCode}
              </h2>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                {new Date(detail.session.startedAtIso).toLocaleString(localeTag)} -&gt;{" "}
                {new Date(detail.session.endedAtIso).toLocaleString(localeTag)}
              </p>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                {isZh ? "\u603b\u624b\u6570" : "Total Hands"}: {detail.session.totalHands}
              </p>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h3 className="font-headline text-2xl text-stitch-onSurface">{isZh ? "\u6211\u7684\u7ed3\u679c" : "My Result"}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">{isZh ? "\u8d77\u59cb\u7b79\u7801" : "Start Stack"}</p>
                  <p className="mt-1 text-sm font-semibold text-stitch-onSurface">{formatMoney(detail.me.startStack, locale)}</p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">{isZh ? "\u7ed3\u675f\u7b79\u7801" : "End Stack"}</p>
                  <p className="mt-1 text-sm font-semibold text-stitch-onSurface">{formatMoney(detail.me.endStack, locale)}</p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">{isZh ? "\u76c8\u4e8f" : "Profit/Loss"}</p>
                  <p className="mt-1 text-sm font-semibold text-stitch-mint">{formatMoney(detail.me.profitLoss, locale)}</p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">{isZh ? "\u53c2\u4e0e\u624b\u6570" : "Hands Played"}</p>
                  <p className="mt-1 text-sm font-semibold text-stitch-onSurface">{detail.me.handsPlayed}</p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h3 className="font-headline text-2xl text-stitch-onSurface">{isZh ? "\u6574\u684c\u76c8\u4e8f" : "Table Results"}</h3>
              <div className="mt-3 space-y-2">
                {detail.players.map((player) => (
                  <div
                    key={player.userId}
                    className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant"
                  >
                    <p className="text-sm font-semibold text-stitch-onSurface">{player.username}</p>
                    <p className="mt-1">
                      {formatMoney(player.startStack, locale)} -&gt; {formatMoney(player.endStack, locale)} | {isZh ? "\u76c8\u4e8f" : "P/L"}{" "}
                      {formatMoney(player.profitLoss, locale)} | {isZh ? "\u624b\u6570" : "Hands"} {player.handsPlayed}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h3 className="font-headline text-2xl text-stitch-onSurface">{isZh ? "\u6bcf\u624b\u660e\u7ec6" : "Hand-by-Hand"}</h3>
              <div className="mt-3 space-y-3">
                {detail.hands.map((hand) => (
                  <div key={hand.handNumber} className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                    <p className="text-sm font-semibold text-stitch-onSurface">
                      {isZh ? "\u7b2c" : "Hand "} {hand.handNumber} {isZh ? "\u624b" : ""}
                    </p>
                    <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                      {isZh ? "\u5e95\u6c60" : "Pot"}: {formatMoney(hand.potTotal, locale)}
                    </p>
                    <div className="mt-2 space-y-1">
                      {hand.results.map((result) => (
                        <p key={`${hand.handNumber}-${result.userId}`} className="text-xs text-stitch-onSurfaceVariant">
                          {result.username}:{" "}
                          <span className={Number(result.netChange) >= 0 ? "text-stitch-mint" : "text-stitch-tertiary"}>
                            {formatMoney(result.netChange, locale)}
                          </span>{" "}
                          ({isZh ? "\u8d62\u5f97" : "Won"} {formatMoney(result.amountWon, locale)})
                        </p>
                      ))}
                    </div>
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
