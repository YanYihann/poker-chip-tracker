import { io, type Socket } from "socket.io-client";

import { getApiBaseUrl } from "@/lib/api-base-url";

let roomSocket: Socket | null = null;

export function getRoomSocket(): Socket {
  if (!roomSocket) {
    roomSocket = io(getApiBaseUrl(), {
      withCredentials: true,
      transports: ["websocket"]
    });
  }

  return roomSocket;
}
