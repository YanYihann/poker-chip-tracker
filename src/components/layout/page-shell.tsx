"use client";

import type { ReactNode } from "react";
import { AppTopBar } from "./app-top-bar";

export function PageShell({ title, children, className = "", backHref }: {
  title: string; children: ReactNode; className?: string; backHref?: string;
}) {
  return <main className={`app-shell ${className}`}>
    <AppTopBar title={title} backHref={backHref} />
    <section className="page-content">{children}</section>
  </main>;
}
