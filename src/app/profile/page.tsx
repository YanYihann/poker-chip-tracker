"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import {
  fetchCurrentUser,
  fetchProfile,
  fetchRecentSessions,
  logoutAccount,
  updateProfile,
  type RecentSession
} from "@/features/auth/api";

function formatMoney(value: string, locale: AppLocale): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "$0";
  }
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

export default function ProfilePage() {
  const router = useRouter();
  const { isZh, localeTag, locale, setLocale } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [sessions, setSessions] = useState<RecentSession[]>([]);

  const [saving, setSaving] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [totals, setTotals] = useState({
    sessions: 0,
    hands: 0,
    profit: "0",
    loss: "0"
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [me, profile, recent] = await Promise.all([
          fetchCurrentUser(),
          fetchProfile(),
          fetchRecentSessions()
        ]);

        setEmail(me.email);
        setUsername(profile.username);
        setAvatarUrl(profile.avatarUrl ?? "");
        setTotals(profile.totals);
        setSessions(recent);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : isZh
              ? "\u65e0\u6cd5\u52a0\u8f7d\u4e2a\u4eba\u8d44\u6599\u3002"
              : "Unable to load profile."
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [isZh]);

  const avatarLabel = useMemo(() => {
    if (username.trim().length > 0) {
      return username.trim().slice(0, 1).toUpperCase();
    }
    if (email.trim().length > 0) {
      return email.trim().slice(0, 1).toUpperCase();
    }
    return "P";
  }, [email, username]);

  const isAuthError = error?.toLowerCase().includes("auth") || error?.toLowerCase().includes("not");

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title={isZh ? "\u4e2a\u4eba\u8d44\u6599" : "Profile"} backHref="/" />

      <section className="space-y-4 px-4 pt-4">
        {loading ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            {isZh ? "\u6b63\u5728\u52a0\u8f7d\u4e2a\u4eba\u8d44\u6599..." : "Loading profile..."}
          </article>
        ) : null}

        {!loading && error ? (
          <article className="rounded-2xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 p-4">
            <p className="text-sm text-stitch-tertiary">{error}</p>
            {isAuthError ? (
              <Link
                href="/auth?next=/profile"
                className="mt-2 inline-block rounded-xl bg-stitch-primary px-3 py-2 text-xs font-semibold text-stitch-onPrimary"
              >
                {isZh ? "\u524d\u5f80\u767b\u5f55" : "Go to Login"}
              </Link>
            ) : null}
          </article>
        ) : null}

        {!loading && !error ? (
          <>
            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full border border-stitch-mint/40 bg-stitch-surfaceContainerHigh text-lg font-semibold text-stitch-mint">
                    {avatarLabel}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stitch-onSurface">{username}</p>
                    <p className="text-xs text-stitch-onSurfaceVariant">{email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-lg bg-stitch-surfaceContainerHigh px-3 py-1 text-xs text-stitch-onSurfaceVariant disabled:opacity-40"
                  disabled={logoutLoading}
                  onClick={async () => {
                    setLogoutLoading(true);
                    try {
                      await logoutAccount();
                      router.push("/auth");
                    } finally {
                      setLogoutLoading(false);
                    }
                  }}
                >
                  {logoutLoading ? (isZh ? "\u9000\u51fa\u4e2d..." : "Logging out...") : isZh ? "\u9000\u51fa\u767b\u5f55" : "Logout"}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">{isZh ? "\u7528\u6237\u540d" : "Username"}</span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">
                    {isZh ? "\u5934\u50cf URL\uff08\u53ef\u9009\uff09" : "Avatar URL (optional placeholder)"}
                  </span>
                  <input
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50"
                  />
                </label>

                <button
                  type="button"
                  className="w-full rounded-xl bg-stitch-primary px-4 py-2 text-sm font-semibold text-stitch-onPrimary disabled:opacity-50"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    setError(null);
                    try {
                      const profile = await updateProfile({
                        username: username.trim(),
                        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null
                      });
                      setUsername(profile.username);
                      setAvatarUrl(profile.avatarUrl ?? "");
                    } catch (saveError) {
                      setError(
                        saveError instanceof Error
                          ? saveError.message
                          : isZh
                            ? "\u4fdd\u5b58\u5931\u8d25\u3002"
                            : "Save failed."
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? (isZh ? "\u4fdd\u5b58\u4e2d..." : "Saving...") : isZh ? "\u4fdd\u5b58\u8d44\u6599" : "Save Profile"}
                </button>
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h2 className="font-headline text-2xl text-stitch-onSurface">{isZh ? "\u754c\u9762\u8bed\u8a00" : "Language"}</h2>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                {isZh
                  ? "\u4e2d\u82f1\u6587\u5207\u6362\u8bbe\u7f6e\u4fdd\u5b58\u5728\u5f53\u524d\u6d4f\u89c8\u5668\u3002"
                  : "Language preference is saved in this browser."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLocale("zh")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold transition",
                    locale === "zh"
                      ? "bg-stitch-primary text-stitch-onPrimary"
                      : "bg-stitch-surfaceContainerHigh text-stitch-onSurface"
                  ].join(" ")}
                >
                  {"\u7b80\u4f53\u4e2d\u6587"}
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("en")}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold transition",
                    locale === "en"
                      ? "bg-stitch-primary text-stitch-onPrimary"
                      : "bg-stitch-surfaceContainerHigh text-stitch-onSurface"
                  ].join(" ")}
                >
                  English
                </button>
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h2 className="font-headline text-2xl text-stitch-onSurface">{isZh ? "\u724c\u5c40\u603b\u89c8" : "Session Totals"}</h2>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                {isZh ? "\u5f52\u6863\u724c\u5c40\u5df2\u4e0e\u670d\u52a1\u5668\u540c\u6b65\u3002" : "Archived game sessions are now server-synced."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">{isZh ? "\u724c\u5c40\u6570" : "Sessions"}</p>
                  <p className="mt-1 text-lg font-semibold text-stitch-onSurface">{totals.sessions}</p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">{isZh ? "\u603b\u624b\u6570" : "Hands"}</p>
                  <p className="mt-1 text-lg font-semibold text-stitch-onSurface">{totals.hands}</p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">{isZh ? "\u76c8\u5229" : "Profit"}</p>
                  <p className="mt-1 text-lg font-semibold text-stitch-mint">{formatMoney(totals.profit, locale)}</p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">{isZh ? "\u4e8f\u635f" : "Loss"}</p>
                  <p className="mt-1 text-lg font-semibold text-stitch-tertiary">{formatMoney(totals.loss, locale)}</p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-headline text-2xl text-stitch-onSurface">{isZh ? "\u4e2a\u4eba\u5386\u53f2" : "Profile History"}</h2>
                <Link
                  href="/history"
                  className="rounded-lg bg-stitch-surfaceContainerHigh px-3 py-1.5 text-xs text-stitch-onSurfaceVariant"
                >
                  {isZh ? "\u67e5\u770b\u5168\u90e8" : "View All"}
                </Link>
              </div>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                {isZh ? "\u5df2\u5b8c\u6210\u724c\u5c40\u4f1a\u5173\u8054\u5230\u4f60\u7684\u8d26\u6237\u3002" : "Completed sessions are linked to your profile."}
              </p>

              <div className="mt-3 space-y-2">
                {sessions.length === 0 ? (
                  <p className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurfaceVariant">
                    {isZh ? "\u6682\u65e0\u724c\u5c40\u8bb0\u5f55\u3002" : "No sessions yet."}
                  </p>
                ) : (
                  sessions.map((session) => (
                    <Link
                      key={session.sessionId}
                      href={`/history/${session.sessionId}`}
                      className="block rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2"
                    >
                      <p className="text-sm text-stitch-onSurface">
                        {isZh ? "\u623f\u95f4" : "Room"} {session.roomCode} | {new Date(session.endedAtIso).toLocaleString(localeTag)}
                      </p>
                      <p className="text-xs text-stitch-onSurfaceVariant">
                        {isZh ? "\u8d77\u59cb" : "Start"} {formatMoney(session.startStack, locale)} -&gt; {isZh ? "\u7ed3\u675f" : "End"}{" "}
                        {formatMoney(session.endStack, locale)}
                      </p>
                      <p className="text-xs text-stitch-onSurfaceVariant">
                        {isZh ? "\u624b\u6570" : "Hands"}: {session.handsPlayed}/{session.totalHands} · {isZh ? "\u76c8\u4e8f" : "P/L"}:{" "}
                        {formatMoney(session.profitLoss, locale)}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h2 className="font-headline text-2xl text-stitch-onSurface">{isZh ? "\u623f\u95f4" : "Rooms"}</h2>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                {isZh
                  ? "\u521b\u5efa\u6216\u52a0\u5165\u7b49\u5f85\u623f\u95f4\uff0c\u5b9e\u65f6\u540c\u6b65\u724c\u5c40\u72b6\u6001\u3002"
                  : "Create or join a waiting room with realtime sync."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href="/rooms/create"
                  className="rounded-xl bg-stitch-primary px-3 py-2 text-center text-sm font-semibold text-stitch-onPrimary"
                >
                  {isZh ? "\u521b\u5efa\u623f\u95f4" : "Create Room"}
                </Link>
                <Link
                  href="/rooms/join"
                  className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-center text-sm text-stitch-onSurface"
                >
                  {isZh ? "\u52a0\u5165\u623f\u95f4" : "Join Room"}
                </Link>
              </div>
            </article>
          </>
        ) : null}
      </section>
    </main>
  );
}
