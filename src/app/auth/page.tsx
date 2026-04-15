"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { loginAccount, registerAccount } from "@/features/auth/api";

type AuthMode = "login" | "register";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") || "/rooms/join";
  const { isZh } = useLanguage();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === "login" ? (isZh ? "\u767b\u5f55" : "Login") : isZh ? "\u6ce8\u518c" : "Register"),
    [isZh, mode]
  );

  const canSubmit =
    email.trim().length > 3 &&
    password.trim().length >= 8 &&
    (mode === "login" || username.trim().length >= 1);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title={isZh ? "\u8d26\u6237" : "Account"} backHref="/" />

      <section className="px-4 pt-4">
        <div className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                mode === "login"
                  ? "bg-stitch-primary/20 text-stitch-primary"
                  : "bg-stitch-surfaceContainerHigh text-stitch-onSurfaceVariant"
              ].join(" ")}
              onClick={() => setMode("login")}
            >
              {isZh ? "\u767b\u5f55" : "Login"}
            </button>
            <button
              type="button"
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                mode === "register"
                  ? "bg-stitch-primary/20 text-stitch-primary"
                  : "bg-stitch-surfaceContainerHigh text-stitch-onSurfaceVariant"
              ].join(" ")}
              onClick={() => setMode("register")}
            >
              {isZh ? "\u6ce8\u518c" : "Register"}
            </button>
          </div>

          <h2 className="font-headline text-2xl text-stitch-onSurface">{title}</h2>
          <p className="mt-1 text-sm text-stitch-onSurfaceVariant">
            {isZh
              ? "\u8d26\u6237\u548c\u8d44\u6599\u80fd\u529b\u5df2\u63a5\u5165\uff0c\u4e0d\u5f71\u54cd\u672c\u5730\u724c\u684c\u73a9\u6cd5\u3002"
              : "This adds account and profile features without changing local table gameplay."}
          </p>

          <form
            className="mt-4 space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!canSubmit || loading) {
                return;
              }

              setLoading(true);
              setError(null);
              try {
                if (mode === "login") {
                  await loginAccount({
                    email: email.trim(),
                    password
                  });
                } else {
                  await registerAccount({
                    email: email.trim(),
                    password,
                    username: username.trim()
                  });
                }
                router.push(redirectTo);
              } catch (submitError) {
                setError(
                  submitError instanceof Error
                    ? submitError.message
                    : isZh
                      ? "\u8bf7\u6c42\u5931\u8d25\u3002"
                      : "Request failed."
                );
              } finally {
                setLoading(false);
              }
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">Email</span>
              <input
                type="email"
                autoComplete="email"
                className="w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">
                {isZh ? "\u5bc6\u7801\uff08\u81f3\u5c11 8 \u4f4d\uff09" : "Password (min 8 chars)"}
              </span>
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
              />
            </label>

            {mode === "register" ? (
              <label className="block">
                <span className="mb-1 block text-xs text-stitch-onSurfaceVariant">
                  {isZh ? "\u7528\u6237\u540d" : "Username"}
                </span>
                <input
                  type="text"
                  autoComplete="nickname"
                  className="w-full rounded-xl border border-stitch-outlineVariant/35 bg-stitch-surfaceContainerHigh px-3 py-2 text-sm text-stitch-onSurface outline-none focus:border-stitch-primary/50"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="player_one"
                />
              </label>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-stitch-tertiary/35 bg-stitch-tertiary/10 px-3 py-2 text-xs text-stitch-tertiary">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full rounded-xl bg-stitch-primary px-4 py-2 text-sm font-semibold text-stitch-onPrimary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? isZh
                  ? "\u63d0\u4ea4\u4e2d..."
                  : "Submitting..."
                : mode === "login"
                  ? isZh
                    ? "\u767b\u5f55"
                    : "Login"
                  : isZh
                    ? "\u6ce8\u518c\u5e76\u767b\u5f55"
                    : "Register & Login"}
            </button>
          </form>

          <div className="mt-4 rounded-2xl bg-stitch-surfaceContainerHigh px-3 py-3 text-center">
            <p className="text-xs text-stitch-onSurfaceVariant">
              {isZh
                ? "不登录也可继续使用本地模式。"
                : "You can continue in local mode without signing in."}
            </p>
            <Link
              href="/local"
              className="mt-2 inline-block rounded-xl bg-stitch-surfaceContainer px-3 py-2 text-xs text-stitch-onSurface"
            >
              {isZh ? "继续本地模式" : "Continue Local Mode"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8" />}>
      <AuthPageContent />
    </Suspense>
  );
}
