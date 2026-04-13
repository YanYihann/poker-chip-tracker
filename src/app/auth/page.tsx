"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { loginAccount, registerAccount } from "@/features/auth/api";

type AuthMode = "login" | "register";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") || "/profile";
  const { isZh } = useLanguage();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () =>
      mode === "login" ? (isZh ? "登录" : "Login") : isZh ? "注册" : "Register",
    [isZh, mode]
  );

  const canSubmit =
    email.trim().length > 3 &&
    password.trim().length >= 8 &&
    (mode === "login" || username.trim().length >= 2);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
      <AppTopBar title={isZh ? "账户" : "Account"} backHref="/" />

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
              {isZh ? "登录" : "Login"}
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
              {isZh ? "注册" : "Register"}
            </button>
          </div>

          <h2 className="font-headline text-2xl text-stitch-onSurface">{title}</h2>
          <p className="mt-1 text-sm text-stitch-onSurfaceVariant">
            {isZh
              ? "账户和资料能力已接入，不影响本地牌桌玩法。"
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
                setError(submitError instanceof Error ? submitError.message : isZh ? "请求失败。" : "Request failed.");
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
                {isZh ? "密码（至少 8 位）" : "Password (min 8 chars)"}
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
                  {isZh ? "用户名" : "Username"}
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
                  ? "提交中..."
                  : "Submitting..."
                : mode === "login"
                  ? isZh
                    ? "登录"
                    : "Login"
                  : isZh
                    ? "注册并登录"
                    : "Register & Login"}
            </button>
          </form>
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