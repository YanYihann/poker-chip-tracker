"use client";

import { useEffect, useRef } from "react";

import { useLocalTableModeAdapter } from "@/features/table/adapters/useLocalTableModeAdapter";
import { TableModeScreen } from "@/features/table/presentation/table-mode-screen";

function parsePlayerCountFromQuery(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.location.search;
  const value = new URLSearchParams(raw).get("players");
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(2, Math.min(10, Math.floor(parsed)));
}

export default function LocalModePage() {
  const adapter = useLocalTableModeAdapter();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const count = parsePlayerCountFromQuery();
    if (count !== null) {
      adapter.onPlayerCountChange?.(count);
    }
  }, [adapter.onPlayerCountChange]);

  return <TableModeScreen adapter={adapter} />;
}
