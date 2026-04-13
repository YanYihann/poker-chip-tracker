import { create } from "zustand";

import type { TableMotionEvent } from "@/types/domain";

type MotionStore = {
  events: TableMotionEvent[];
  emit: (event: Omit<TableMotionEvent, "id" | "createdAt">) => string;
  consume: (id: string) => void;
  clearAll: () => void;
};

export const useMotionStore = create<MotionStore>((set, get) => ({
  events: [],
  emit: (event) => {
    const id = `${event.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    set({
      events: [
        ...get().events,
        {
          ...event,
          id,
          createdAt: Date.now()
        }
      ]
    });

    return id;
  },
  consume: (id) => {
    set({
      events: get().events.filter((event) => event.id !== id)
    });
  },
  clearAll: () => {
    set({ events: [] });
  }
}));
