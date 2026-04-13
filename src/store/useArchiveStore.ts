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
    const nextEntries = [entry, ...get().entries].slice(0, 200);
    saveArchiveSessions(nextEntries);
    set({ entries: nextEntries, hydrated: true });
  },
  clearEntries: () => {
    saveArchiveSessions([]);
    set({ entries: [], hydrated: true });
  }
}));
