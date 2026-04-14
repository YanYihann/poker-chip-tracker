"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { fetchCurrentUser } from "@/features/auth/api";

type OnlineAuthGateProps = {
  children: ReactNode;
  title: string;
  backHref?: string;
};

type AuthCacheState = {
  checkedAt: number;
};

const AUTH_CACHE_KEY = "poker_online_auth_ok_at";
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
let inMemoryAuthCache: AuthCacheState | null = null;

function readAuthCache(): AuthCacheState | null {
  const now = Date.now();
  if (inMemoryAuthCache && now - inMemoryAuthCache.checkedAt <= AUTH_CACHE_TTL_MS) {
    return inMemoryAuthCache;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(AUTH_CACHE_KEY);
  if (!raw) {
    return null;
  }

  const parsedAt = Number(raw);
  if (!Number.isFinite(parsedAt) || now - parsedAt > AUTH_CACHE_TTL_MS) {
    window.sessionStorage.removeItem(AUTH_CACHE_KEY);
    return null;
  }

  inMemoryAuthCache = {
    checkedAt: parsedAt
  };
  return inMemoryAuthCache;
}

function writeAuthCache(timestampMs: number): void {
  inMemoryAuthCache = { checkedAt: timestampMs };
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(AUTH_CACHE_KEY, String(timestampMs));
  }
}

function clearAuthCache(): void {
  inMemoryAuthCache = null;
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(AUTH_CACHE_KEY);
  }
}

export function OnlineAuthGate({ children, title, backHref }: OnlineAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isZh } = useLanguage();

  const [allowed, setAllowed] = useState(() => !!readAuthCache());
  const [checking, setChecking] = useState(() => !readAuthCache());

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") {
      return pathname;
    }

    const query = window.location.search;
    return query ? `${pathname}${query}` : pathname;
  }, [pathname]);

  useEffect(() => {
    let active = true;
    const cached = readAuthCache();

    const verify = async () => {
      if (!cached) {
        setChecking(true);
      }

      try {
        await fetchCurrentUser();
        if (!active) {
          return;
        }
        writeAuthCache(Date.now());
        setAllowed(true);
      } catch {
        if (!active) {
          return;
        }
        clearAuthCache();
        setAllowed(false);
        router.replace(`/auth?next=${encodeURIComponent(nextPath)}`);
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [nextPath, router]);

  if (!allowed) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8">
        <AppTopBar title={title} backHref={backHref} />
        <section className="px-4 pt-4">
          <article className="rounded-3xl border border-stitch-outlineVariant/30 bg-stitch-surfaceContainer p-5">
            <h2 className="font-headline text-2xl text-stitch-onSurface">
              {checking
                ? isZh
                  ? "正在验证账号"
                  : "Verifying account"
                : isZh
                  ? "正在跳转登录"
                  : "Redirecting to login"}
            </h2>
            <p className="mt-2 text-sm text-stitch-onSurfaceVariant">
              {isZh
                ? "在线模式与联机房间需要登录；本地离线模式可继续免登录使用。"
                : "Online mode and synced rooms require sign-in. Offline local mode can still be used without sign-in."}
            </p>
            <Link
              href="/local"
              className="mt-3 inline-block rounded-xl bg-stitch-surfaceContainerHigh px-3 py-2 text-xs text-stitch-onSurfaceVariant"
            >
              {isZh ? "继续本地模式" : "Continue Local Mode"}
            </Link>
          </article>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
