import type { ArchivedSessionRecord, PersistedLiveSession } from "@/types/domain";

export type PersistenceEngine = "localStorage" | "indexedDB";

export const defaultPersistenceEngine: PersistenceEngine = "localStorage";

export const STORAGE_KEY = "poker-chip-ledger/live-session";
export const ARCHIVE_STORAGE_KEY = "poker-chip-ledger/archive-sessions";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function saveLiveSession(payload: PersistedLiveSession): void {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadLiveSession(): PersistedLiveSession | null {
  if (!hasWindow()) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedLiveSession;

    if (!parsed?.snapshot || parsed.version !== 1) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearLiveSession(): void {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function loadArchiveSessions(): ArchivedSessionRecord[] {
  if (!hasWindow()) {
    return [];
  }

  const raw = window.localStorage.getItem(ARCHIVE_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ArchivedSessionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveArchiveSessions(entries: ArchivedSessionRecord[]): void {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(entries));
}
