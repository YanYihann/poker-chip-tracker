"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AppTopBar } from "@/components/layout/app-top-bar";
import {
  fetchCurrentUser,
  fetchProfile,
  fetchRecentSessions,
  logoutAccount,
  updateProfile,
  type RecentSession
} from "@/features/auth/api";

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

export default function ProfilePage() {
  const router = useRouter();
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
        setError(loadError instanceof Error ? loadError.message : "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

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
      <AppTopBar title="Profile" backHref="/" />

      <section className="space-y-4 px-4 pt-4">
        {loading ? (
          <article className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            Loading profile...
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
                Go to Login
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
                  {logoutLoading ? "Logging out..." : "Logout"}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">Username</span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">
                    Avatar URL (optional placeholder)
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
                      setError(saveError instanceof Error ? saveError.message : "Save failed.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h2 className="font-headline text-2xl text-stitch-onSurface">Session Totals</h2>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">Archived game sessions are now server-synced.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">Sessions</p>
                  <p className="mt-1 text-lg font-semibold text-stitch-onSurface">{totals.sessions}</p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">Hands</p>
                  <p className="mt-1 text-lg font-semibold text-stitch-onSurface">{totals.hands}</p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">Profit</p>
                  <p className="mt-1 text-lg font-semibold text-stitch-mint">
                    {formatMoney(totals.profit)}
                  </p>
                </div>
                <div className="rounded-xl bg-stitch-surfaceContainerHigh p-3">
                  <p className="text-[11px] text-stitch-onSurfaceVariant">Loss</p>
                  <p className="mt-1 text-lg font-semibold text-stitch-tertiary">
                    {formatMoney(totals.loss)}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-headline text-2xl text-stitch-onSurface">Profile History</h2>
                <Link
                  href="/history"
                  className="rounded-lg bg-stitch-surfaceContainerHigh px-3 py-1.5 text-xs text-stitch-onSurfaceVariant"
                >
                  View All
                </Link>
              </div>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                Completed sessions are linked to your profile.
              </p>

              <div className="mt-3 space-y-2">
                {sessions.length === 0 ? (
                  <p className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurfaceVariant">
                    No sessions yet.
                  </p>
                ) : (
                  sessions.map((session) => (
                    <Link
                      key={session.sessionId}
                      href={`/history/${session.sessionId}`}
                      className="block rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2"
                    >
                      <p className="text-sm text-stitch-onSurface">
                        Room {session.roomCode} | {new Date(session.endedAtIso).toLocaleString()}
                      </p>
                      <p className="text-xs text-stitch-onSurfaceVariant">
                        Start {formatMoney(session.startStack)} -&gt; End {formatMoney(session.endStack)}
                      </p>
                      <p className="text-xs text-stitch-onSurfaceVariant">
                        Hands: {session.handsPlayed}/{session.totalHands} · P/L: {formatMoney(session.profitLoss)}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h2 className="font-headline text-2xl text-stitch-onSurface">Rooms</h2>
              <p className="mt-1 text-xs text-stitch-onSurfaceVariant">
                Create or join a waiting room with realtime sync.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href="/rooms/create"
                  className="rounded-xl bg-stitch-primary px-3 py-2 text-center text-sm font-semibold text-stitch-onPrimary"
                >
                  Create Room
                </Link>
                <Link
                  href="/rooms/join"
                  className="rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-center text-sm text-stitch-onSurface"
                >
                  Join Room
                </Link>
              </div>
            </article>
          </>
        ) : null}
      </section>
    </main>
  );
}
