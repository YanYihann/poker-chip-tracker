"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelMatch, getMatchState, heartbeatMatch, joinMatchQueue, type MatchResponse, type MatchState } from "./api";

export function useMatchmaking() {
  const router = useRouter();
  const [match, setMatch] = useState<MatchState>({ status: "idle" });
  const [settings, setSettings] = useState<MatchResponse["settings"] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const alive = useRef(false);
  const version = useRef(0);
  const latest = useRef<MatchState>({ status: "idle" });

  const apply = useCallback((response: MatchResponse) => {
    latest.current = response.match;
    setMatch(response.match);
    setSettings(response.settings);
    setError(null);
    if (response.match.status === "matched") router.replace(`/online?room=${encodeURIComponent(response.match.roomCode)}`);
  }, [router]);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const requestVersion = version.current;
    void getMatchState().then((response) => {
      if (!cancelled && requestVersion === version.current) apply(response);
    }).catch(() => { if (!cancelled) setError("unavailable"); })
      .finally(() => { if (!cancelled) setBusy(false); });
    const leave = () => {
      if (latest.current.status === "waiting") void cancelMatch(latest.current.ticketId, true).catch(() => {});
    };
    window.addEventListener("pagehide", leave);
    return () => {
      cancelled = true; alive.current = false;
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [apply]);

  const ticketId = match.status === "waiting" ? match.ticketId : null;
  const joinedAt = match.status === "waiting" ? match.joinedAt : null;
  useEffect(() => {
    if (!ticketId || busy) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const requestVersion = version.current;
    const poll = async () => {
      try {
        const response = await heartbeatMatch(ticketId);
        if (!stopped && requestVersion === version.current) {
          apply(response);
          if (response.match.status === "idle") setError("expired");
        }
      } catch {
        if (!stopped && requestVersion === version.current) setError("connection");
      } finally {
        if (!stopped) timer = setTimeout(() => { void poll(); }, 1500);
      }
    };
    timer = setTimeout(() => { void poll(); }, 1500);
    return () => { stopped = true; clearTimeout(timer); };
  }, [ticketId, busy, apply]);

  useEffect(() => {
    if (!joinedAt) return;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - Date.parse(joinedAt)) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [joinedAt]);

  const start = async () => {
    const requestVersion = ++version.current;
    setBusy(true); setError(null);
    try {
      const response = await joinMatchQueue();
      if (alive.current && requestVersion === version.current) apply(response);
      else if (!alive.current && response.match.status === "waiting") void cancelMatch(response.match.ticketId, true).catch(() => {});
    } catch { if (alive.current && requestVersion === version.current) setError("unavailable"); }
    finally { if (alive.current && requestVersion === version.current) setBusy(false); }
  };

  const cancel = async () => {
    if (!ticketId) return;
    const requestVersion = ++version.current;
    setBusy(true);
    try {
      const response = await cancelMatch(ticketId);
      if (alive.current && requestVersion === version.current) apply(response);
    } catch { if (alive.current && requestVersion === version.current) setError("cancel"); }
    finally { if (alive.current && requestVersion === version.current) setBusy(false); }
  };

  return { match, settings, busy, error, elapsed, start, cancel };
}
