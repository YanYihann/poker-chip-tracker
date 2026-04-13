import { create } from "zustand";

type AppState = {
  sessionName: string;
  setSessionName: (name: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  sessionName: "Tonight Session",
  setSessionName: (name) => set({ sessionName: name })
}));

