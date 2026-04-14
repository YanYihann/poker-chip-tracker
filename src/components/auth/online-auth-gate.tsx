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

export function OnlineAuthGate({ children, title, backHref }: OnlineAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isZh } = useLanguage();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") {
      return pathname;
    }

    const query = window.location.search;
    return query ? `${pathname}${query}` : pathname;
  }, [pathname]);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      setChecking(true);
      try {
        await fetchCurrentUser();
        if (!active) {
          return;
        }
        setAllowed(true);
      } catch {
        if (!active) {
          return;
        }
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
                ? "在线模式需要登录，本地模式可继续免登录使用。"
                : "Online mode requires sign-in. Local mode can still be used without sign-in."}
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
