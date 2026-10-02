import { io, type Socket } from "socket.io-client";
import { getRoom, getRoomSyncEpoch, type RoomState, type RoomActionPatch } from "@/features/rooms/api";
import { getApiBaseUrl } from "@/lib/api-base-url";

type Events = { "room:state": RoomState; "room:patch": RoomActionPatch; "room:error": { message?: string } };
type Listener<K extends keyof Events> = (value: Events[K]) => void;
type RoomTransport = {
  on<K extends keyof Events>(event: K, listener: Listener<K>): void;
  off<K extends keyof Events>(event: K, listener: Listener<K>): void;
  emit(event: "room:subscribe" | "room:unsubscribe", payload: { roomCode: string }): void;
};

/** Same-origin serverless deployment: refresh only subscribed, visible rooms. */
class PollingRoomTransport implements RoomTransport {
  private listeners = new Map<string, Set<(value: never) => void>>();
  private rooms = new Map<string, { count: number; timer?: ReturnType<typeof setTimeout>; previous?: string; stopped: boolean }>();
  on<K extends keyof Events>(event: K, listener: Listener<K>) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener as (value: never) => void);
    this.listeners.set(event, listeners);
  }
  off<K extends keyof Events>(event: K, listener: Listener<K>) { this.listeners.get(event)?.delete(listener as (value: never) => void); }
  emit(event: "room:subscribe" | "room:unsubscribe", { roomCode }: { roomCode: string }) {
    const existing = this.rooms.get(roomCode);
    if (event === "room:unsubscribe") {
      if (!existing || --existing.count > 0) return;
      existing.stopped = true; clearTimeout(existing.timer); this.rooms.delete(roomCode); return;
    }
    if (existing) { existing.count++; return; }
    const room = { count: 1, stopped: false, timer: undefined as ReturnType<typeof setTimeout> | undefined, previous: "" };
    this.rooms.set(roomCode, room);
    const refresh = async () => {
      let retryMs = 1500;
      try {
        if (document.visibilityState === "visible") {
          const epoch = getRoomSyncEpoch();
          if (epoch === null) return;
          const state = await getRoom(roomCode);
          if (room.stopped || getRoomSyncEpoch() !== epoch) return;
          const serialized = JSON.stringify(state);
          if (room.previous !== serialized) {
            room.previous = serialized;
            this.listeners.get("room:state")?.forEach((listener) => listener(state as never));
          }
        }
      } catch { retryMs = 5000; }
      finally { if (!room.stopped) room.timer = setTimeout(refresh, retryMs); }
    };
    void refresh();
  }
}

let roomSocket: Socket | null = null;
let polling: PollingRoomTransport | null = null;
export function getRoomSocket(): RoomTransport {
  if (process.env.NEXT_PUBLIC_API_TRANSPORT === "polling") return polling ??= new PollingRoomTransport();
  if (!roomSocket) roomSocket = io(getApiBaseUrl(), { withCredentials: true, transports: ["websocket"] });
  return roomSocket as unknown as RoomTransport;
}
