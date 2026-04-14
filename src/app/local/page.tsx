"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { OnlineAuthGate } from "@/components/auth/online-auth-gate";
import { useOnlineRoomTableModeAdapter } from "@/features/table/adapters/useOnlineRoomTableModeAdapter";
import { useLocalTableModeAdapter } from "@/features/table/adapters/useLocalTableModeAdapter";
import { TableModeScreen } from "@/features/table/presentation/table-mode-screen";

function parsePlayerCountFromQuery(search: URLSearchParams): number | null {
  const value = search.get("players");
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(2, Math.min(10, Math.floor(parsed)));
}

function LocalModePageContent() {
  const searchParams = useSearchParams();
  const roomCode = (searchParams.get("room") ?? "").toUpperCase();

  const localAdapter = useLocalTableModeAdapter();
  const syncedAdapter = useOnlineRoomTableModeAdapter(roomCode, { variant: "local" });
  const initializedRef = useRef(false);

  useEffect(() => {
    if (roomCode) {
      return;
    }

    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const count = parsePlayerCountFromQuery(searchParams);
    if (count !== null) {
      localAdapter.onPlayerCountChange?.(count);
    }
  }, [localAdapter.onPlayerCountChange, roomCode, searchParams]);

  if (roomCode) {
    return (
      <OnlineAuthGate title={syncedAdapter.title} backHref={syncedAdapter.backHref}>
        <TableModeScreen adapter={syncedAdapter} />
      </OnlineAuthGate>
    );
  }

  return <TableModeScreen adapter={localAdapter} />;
}

export default function LocalModePage() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen w-full max-w-[480px] bg-stitch-background pb-8" />}>
      <LocalModePageContent />
    </Suspense>
  );
}
