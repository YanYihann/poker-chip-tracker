import assert from "node:assert/strict";
import { test } from "node:test";
import { submitRoomAction, type RoomState } from "../src/features/rooms/api";
import { getRoomSocket } from "../src/features/rooms/realtime";

test("a refresh started before an action cannot replace the completed action with stale state", async () => {
  const originalFetch = globalThis.fetch;
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalTransport = process.env.NEXT_PUBLIC_API_TRANSPORT;
  process.env.NEXT_PUBLIC_API_TRANSPORT = "polling";
  Object.defineProperty(globalThis, "document", { configurable: true, value: { visibilityState: "visible" } });
  const state = (pot: number) => ({ room: { code: "1234" }, game: { potTotal: pot } }) as RoomState;
  let releaseRefresh: ((response: Response) => void) | undefined;
  let releaseAction: ((response: Response) => void) | undefined;
  let reads = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "POST") return new Promise<Response>((resolve) => { releaseAction = resolve; });
    if (++reads === 1) return new Promise<Response>((resolve) => { releaseRefresh = resolve; });
    return Response.json({ room: state(600) });
  };
  const received: RoomState[] = [];
  let freshReceived: (() => void) | undefined;
  const onState = (value: RoomState) => { received.push(value); freshReceived?.(); };
  const transport = getRoomSocket();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    transport.on("room:state", onState);
    transport.emit("room:subscribe", { roomCode: "1234" });
    const action = submitRoomAction("1234", "raise", 400);
    assert.ok(releaseRefresh && releaseAction);
    releaseAction(Response.json({ room: state(600) }));
    assert.equal((await action)?.game?.potTotal, 600);
    releaseRefresh(Response.json({ room: state(300) }));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(received.length, 0);
    await new Promise<void>((resolve, reject) => {
      freshReceived = resolve;
      deadline = setTimeout(() => reject(new Error("Fresh room state was not delivered")), 4000);
    });
    assert.deepEqual(received.map((value) => value.game?.potTotal), [600]);
  } finally {
    clearTimeout(deadline);
    transport.emit("room:unsubscribe", { roomCode: "1234" });
    transport.off("room:state", onState);
    globalThis.fetch = originalFetch;
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else Reflect.deleteProperty(globalThis, "document");
    if (originalTransport === undefined) delete process.env.NEXT_PUBLIC_API_TRANSPORT;
    else process.env.NEXT_PUBLIC_API_TRANSPORT = originalTransport;
  }
});
