import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks avant import du module
vi.mock("@/lib/collab/auth-ws", () => ({
  verifyWsToken: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    then: vi.fn().mockImplementation((cb: (rows: unknown[]) => void) => { cb([]); return Promise.resolve(); }),
    catch: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "msg-1", channelId: "ch-1", authorId: "user-1", content: "hello", createdAt: new Date() }]),
  },
}));

import { verifyWsToken } from "@/lib/collab/auth-ws";
import { ChatServer } from "@/lib/chat/chat-server";

function makeWs() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    }),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
    emit: (event: string, ...args: unknown[]) => listeners[event]?.forEach(cb => cb(...args)),
  } as unknown as import("ws").WebSocket;
}

describe("ChatServer", () => {
  let server: ChatServer;

  beforeEach(() => {
    server = new ChatServer();
    vi.clearAllMocks();
  });

  it("ferme la connexion si auth non reçue dans les 5s", async () => {
    vi.useFakeTimers();
    const ws = makeWs();
    server.handleConnection(ws);
    vi.advanceTimersByTime(5001);
    expect(ws.close).toHaveBeenCalledWith(4001, "Auth timeout");
    vi.useRealTimers();
  });

  it("rejette un token invalide", async () => {
    vi.mocked(verifyWsToken).mockResolvedValue(null);
    const ws = makeWs();
    server.handleConnection(ws);
    ws.emit("message", Buffer.from(JSON.stringify({ type: "auth", token: "bad" })));
    await vi.waitFor(() => expect(ws.close).toHaveBeenCalledWith(4003, "Unauthorized"));
  });

  it("accepte un token valide et envoie auth_ok", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(verifyWsToken).mockResolvedValue({ id: "user-1", name: "Alice", email: "a@b.com", globalRole: "editor", avatarUrl: null } as any);
    const ws = makeWs();
    server.handleConnection(ws);
    ws.emit("message", Buffer.from(JSON.stringify({ type: "auth", token: "valid" })));
    await vi.waitFor(() => {
      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const authOk = calls.find(c => JSON.parse(c[0]).type === "auth_ok");
      expect(authOk).toBeDefined();
    });
  });
});
