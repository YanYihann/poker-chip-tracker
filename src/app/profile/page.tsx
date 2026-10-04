"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useLanguage, type AppLocale } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { HistoryResetConfirmation } from "@/components/settlement/history-reset-confirmation";
import { includeDeviceSessions } from "@/features/auth/profile-totals";
import { useArchiveStore } from "@/store/useArchiveStore";
import { useSessionStore } from "@/store/useSessionStore";
import {
  fetchCurrentUser,
  fetchProfile,
  resetAllSessions,
  logoutAccount,
  updateProfile,
  type ProfilePayload
} from "@/features/auth/api";

function formatMoney(value: string, locale: AppLocale): string {
  const amount = BigInt(value);
  const formatted = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 0
  }).format(amount < 0n ? -amount : amount);
  return amount < 0n ? `−${formatted}` : amount > 0n ? `+${formatted}` : formatted;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FILE_READ_FAILED"));
      }
    };
    reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
    img.src = src;
  });
}

async function buildAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("INVALID_FILE_TYPE");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);

  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("CANVAS_NOT_SUPPORTED");
  }

  context.drawImage(image, 0, 0, width, height);

  let quality = 0.9;
  let output = canvas.toDataURL("image/webp", quality);
  while (output.length > 350_000 && quality > 0.4) {
    quality -= 0.1;
    output = canvas.toDataURL("image/webp", quality);
  }

  return output;
}

function ProfilePageContent() {
  const router = useRouter();
  const { isZh, locale, setLocale } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [profileData, setProfileData] = useState<ProfilePayload | null>(null);
  const [userId, setUserId] = useState("");
  const archives = useArchiveStore((state) => state.entries);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const stats = useMemo(() => profileData ? includeDeviceSessions(profileData, userId, archives.flatMap((entry) => entry.summary ? [entry.summary] : [])) : null, [profileData, userId, archives]);

  const [saving, setSaving] = useState(false);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  useEffect(() => { useArchiveStore.getState().hydrate(); }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [me, profile] = await Promise.all([
          fetchCurrentUser(),
          fetchProfile()
        ]);

        if (!active) {
          return;
        }
        setEmail(me.email);
        setUsername(profile.username);
        setAvatarUrl(profile.avatarUrl ?? "");
        setAvatarDirty(false);
        setUserId(me.id);
        setProfileData(profile);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setLoadError(
          loadError instanceof Error
            ? loadError.message
            : isZh
              ? "\u65e0\u6cd5\u52a0\u8f7d\u4e2a\u4eba\u8d44\u6599\u3002"
              : "Unable to load profile."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [isZh, loadAttempt]);

  const avatarLabel = useMemo(() => {
    if (username.trim().length > 0) {
      return username.trim().slice(0, 1).toUpperCase();
    }
    if (email.trim().length > 0) {
      return email.trim().slice(0, 1).toUpperCase();
    }
    return "P";
  }, [email, username]);

  const isAuthError = loadError ? /not authenticated|authentication required|unauthorized/i.test(loadError) : false;

  return (
    <main className="app-shell profile-shell">
      <AppTopBar title={isZh ? "\u4e2a\u4eba\u8d44\u6599" : "Profile"} backHref="/" />

      <section className="page-content content-grid">
        {loading ? (
          <article role="status" className="rounded-2xl bg-stitch-surfaceContainer p-4 text-sm text-stitch-onSurfaceVariant">
            {isZh ? "\u6b63\u5728\u52a0\u8f7d\u4e2a\u4eba\u8d44\u6599..." : "Loading profile..."}
          </article>
        ) : null}

        {!loading && loadError ? (
          <article className="rounded-2xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 p-4">
            <p role="alert" className="break-words text-sm text-stitch-tertiary">{loadError}</p>
            {isAuthError ? (
              <Link
                href="/auth?next=/profile"
                className="mt-2 inline-block rounded-xl bg-stitch-primary px-3 py-2 text-xs font-semibold text-stitch-onPrimary"
              >
                {isZh ? "\u524d\u5f80\u767b\u5f55" : "Go to Login"}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="mt-2 rounded-xl bg-stitch-primary px-3 py-2 text-sm font-semibold text-stitch-onPrimary"
              >
                {isZh ? "重新加载" : "Retry loading"}
              </button>
            )}
          </article>
        ) : null}

        {!loading && !loadError ? (
          <div className="profile-layout">
            <div className="profile-column profile-results-column">
            <article className="profile-net-panel rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h2 className="font-headline text-2xl">{isZh ? "总盈亏" : "Total P/L"}</h2>
              <p className={`mt-3 break-words text-4xl font-bold tabular-nums ${Number(stats?.totals.net) < 0 ? "text-stitch-tertiary" : "text-stitch-mint"}`}>{formatMoney(stats?.totals.net ?? "0", locale)}</p>
              <p className="mt-2 text-xs text-stitch-onSurfaceVariant">{isZh ? "筹码由系统银行按牌局发放。" : "Starting chips are issued by the system bank each session."}</p>
            </article>
            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h2 className="font-headline text-2xl">{isZh ? "牌局总览" : "Session overview"}</h2>
              <div className="profile-mode-totals">
                {(["online", "local"] as const).map((mode) => <section key={mode} aria-labelledby={`profile-${mode}-title`}>
                  <h3 id={`profile-${mode}-title`}>{mode === "online" ? (isZh ? "线上" : "Online") : (isZh ? "本地" : "Local")}</h3>
                  <dl>
                    <div><dt>{isZh ? "牌局" : "Sessions"}</dt><dd>{stats?.byMode[mode].sessions ?? 0}</dd></div>
                    <div><dt>{isZh ? "手数" : "Hands"}</dt><dd>{stats?.byMode[mode].hands ?? 0}</dd></div>
                    <div className="profile-mode-net"><dt>{isZh ? "盈亏" : "P/L"}</dt><dd className={Number(stats?.byMode[mode].net) < 0 ? "text-stitch-tertiary" : "text-stitch-mint"}>{formatMoney(stats?.byMode[mode].net ?? "0", locale)}</dd></div>
                  </dl>
                </section>)}
              </div>
              <p className="mt-3 text-xs text-stitch-onSurfaceVariant">{isZh ? "单设备牌局按你选择的座位计入，此设备保存的记录也包含在内。" : "Single-device results use your selected seat and are saved on this device."}</p>
            </article>
            <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <h2 className="font-headline text-xl">{isZh ? "重置牌局" : "Reset sessions"}</h2>
              <p className="mt-2 text-sm text-stitch-onSurfaceVariant">{isZh ? "清空线上、本地盈亏和历史记录。" : "Clear online and local P/L and history."}</p>
              <button type="button" className="mt-4 min-h-11 rounded-xl border border-stitch-tertiary/50 px-4 text-sm font-semibold text-stitch-tertiary" onClick={() => { setResetError(null); setResetOpen(true); setResetDone(false); }}>{isZh ? "重置所有牌局" : "Reset all sessions"}</button>
              {resetDone && <p role="status" className="mt-3 text-sm text-stitch-mint">{isZh ? "盈亏和历史记录已清空。" : "Totals and history cleared."}</p>}
            </article>
            </div>
            <div className="profile-column profile-identity-column">
            <article className="min-w-0 rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-stitch-mint/40 bg-stitch-surfaceContainerHigh text-lg font-semibold text-stitch-mint">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={isZh ? "\u5934\u50cf" : "Avatar"} className="h-full w-full object-cover" />
                    ) : (
                      avatarLabel
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stitch-onSurface [overflow-wrap:anywhere]">{username}</p>
                    <p className="break-all text-xs text-stitch-onSurfaceVariant">{email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-stitch-surfaceContainerHigh px-3 py-1 text-xs text-stitch-onSurfaceVariant disabled:opacity-40"
                  disabled={logoutLoading || saving || avatarProcessing}
                  onClick={async () => {
                    setLogoutLoading(true);
                    setActionError(null);
                    setSaved(false);
                    try {
                      await logoutAccount();
                      router.push("/auth");
                    } catch {
                      setActionError(isZh ? "退出登录失败，请重试。" : "Unable to log out. Please try again.");
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
                    disabled={saving || logoutLoading}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setSaved(false);
                    }}
                    className="min-w-0 w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50 disabled:opacity-50"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">
                    {isZh ? "\u5934\u50cf\u56fe\u5e93\u4e0a\u4f20" : "Avatar Upload"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={saving || logoutLoading || avatarProcessing}
                    className="min-w-0 w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurface file:mr-3 file:rounded-lg file:border-0 file:bg-stitch-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-stitch-onPrimary disabled:opacity-50"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }

                      event.target.value = "";
                      setActionError(null);
                      setSaved(false);
                      setAvatarProcessing(true);
                      try {
                        const compactAvatar = await buildAvatarDataUrl(file);
                        setAvatarUrl(compactAvatar);
                        setAvatarDirty(true);
                      } catch {
                        setActionError(
                          isZh
                            ? "\u5934\u50cf\u5904\u7406\u5931\u8d25\uff0c\u8bf7\u9009\u62e9\u5c0f\u4e00\u4e9b\u7684\u56fe\u7247\u3002"
                            : "Avatar processing failed. Please choose a smaller image."
                        );
                      } finally {
                        setAvatarProcessing(false);
                      }
                    }}
                  />
                </label>

                {avatarProcessing ? (
                  <p role="status" className="text-sm text-stitch-onSurfaceVariant">
                    {isZh ? "正在处理头像…" : "Processing avatar…"}
                  </p>
                ) : null}
                {actionError ? (
                  <p role="alert" className="break-words text-sm text-stitch-tertiary">{actionError}</p>
                ) : null}
                {saved ? (
                  <p role="status" className="text-sm text-stitch-mint">
                    {isZh ? "资料已保存。" : "Profile saved."}
                  </p>
                ) : null}

                <button
                  type="button"
                  className="w-full rounded-xl bg-stitch-primary px-4 py-2 text-sm font-semibold text-stitch-onPrimary disabled:opacity-50"
                  disabled={saving || logoutLoading || avatarProcessing}
                  onClick={async () => {
                    setSaving(true);
                    setActionError(null);
                    setSaved(false);
                    try {
                      const profile = await updateProfile({
                        username: username.trim(),
                        avatarUrl: avatarDirty ? (avatarUrl.trim() ? avatarUrl.trim() : null) : undefined
                      });
                      setUsername(profile.username);
                      setAvatarUrl(profile.avatarUrl ?? "");
                      setAvatarDirty(false);
                      setSaved(true);
                    } catch (saveError) {
                      setActionError(
                        saveError instanceof Error
                          ? `${saveError.message} ${isZh ? "修改仍在，请重试保存。" : "Your edits are kept. Please try saving again."}`
                          : isZh
                            ? "保存失败，修改仍在，请重试。"
                            : "Save failed. Your edits are kept. Please try again."
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
            </div>
          </div>
        ) : null}
      </section>
      <HistoryResetConfirmation isOpen={resetOpen} busy={resetBusy} error={resetError} onCancel={() => setResetOpen(false)} onConfirm={() => {
        setResetBusy(true); setResetError(null);
        void resetAllSessions().then((profile) => {
          useArchiveStore.getState().clearEntries();
          const session = useSessionStore.getState();
          if (session.ledger?.endedAtIso) session.applySnapshot({ ...session, ledger: undefined,
            players: session.players.map((player) => ({ ...player, stack: session.ledger?.startingPlayers.find((entry) => entry.id === player.id)?.stack ?? 2000 })) });
          setProfileData(profile); setResetOpen(false); setResetDone(true);
        }).catch((error) => setResetError(error instanceof Error ? error.message : (isZh ? "重置失败，请重试。" : "Reset failed. Please try again."))).finally(() => setResetBusy(false));
      }} />
    </main>
  );
}

export default function ProfilePage() {
  return (
    <OnlineAuthGate title="Profile" backHref="/">
      <ProfilePageContent />
    </OnlineAuthGate>
  );
}
