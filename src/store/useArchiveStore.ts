import { create } from "zustand";

import {
  loadArchiveSessions,
  saveArchiveSessions
} from "@/features/persistence/storage";
import type { ArchivedSessionRecord } from "@/types/domain";

type ArchiveStore = {
  entries: ArchivedSessionRecord[];
  hydrated: boolean;
  hydrate: () => void;
  addEntry: (entry: ArchivedSessionRecord) => void;
  clearEntries: () => void;
  removeLatestEntry: () => void;
};

export const useArchiveStore = create<ArchiveStore>((set, get) => ({
  entries: [],
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) {
      return;
    }

    set({
      entries: loadArchiveSessions(),
      hydrated: true
    });
  },
  addEntry: (entry) => {
    let draftCount = 0;
    const nextEntries = [entry, ...get().entries].filter((item) => Boolean(item.summary) || ++draftCount <= 200);
    saveArchiveSessions(nextEntries);
    set({ entries: nextEntries, hydrated: true });
  },
  removeLatestEntry: () => {
    const entries = get().entries.slice(1);
    saveArchiveSessions(entries);
    set({entries});
  },
  clearEntries: () => {
    saveArchiveSessions([]);
    set({ entries: [], hydrated: true });
  }
}));
