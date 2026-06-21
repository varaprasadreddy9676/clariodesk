import "dotenv/config";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { loadConfig } from "@clariodesk/config";
import { createLogger } from "@clariodesk/logger";
import { getDb } from "@clariodesk/db";
import { createEventSubscriber, type RealtimeEvent } from "@clariodesk/events";
import { accessibleChannelIds, type Role } from "./access.js";

type JwtPayload = { sub: string; ws: string; role: Role };

type SocketState = {
  userId: string;
  workspaceId: string;
  role: Role;
  channels: Set<string> | "all";
};

/**
 * Realtime runtime (TDD §5.3, §13). Authenticates each socket with the same JWT
 * the API issues, joins it only to rooms it is permitted to see, and relays
 * domain events from the Redis bus into those rooms. Permission is enforced at
 * the room boundary — a socket never receives events for channels it can't access.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const db = getDb(config.DATABASE_URL);

  const http = createServer();
  const io = new Server(http, { cors: { origin: true } });
  const states = new WeakMap<Socket, SocketState>();

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      socket.handshake.headers.authorization?.replace("Bearer ", "");
    if (!token) return next(new Error("missing token"));
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
      socket.data.payload = payload;
      next();
    } catch {
      next(new Error("invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const payload = socket.data.payload as JwtPayload;
    const allowed = await accessibleChannelIds(
      db,
      payload.ws,
      payload.sub,
      payload.role,
    );
    const state: SocketState = {
      userId: payload.sub,
      workspaceId: payload.ws,
      role: payload.role,
      channels: allowed === "all" ? "all" : new Set(allowed),
    };
    states.set(socket, state);

    await socket.join(`workspace:${payload.ws}`);
    await socket.join(`user:${payload.sub}`);
    if (allowed === "all") {
      // Admins receive every channel event via a dedicated admin room rather
      // than joining thousands of channel rooms individually.
      await socket.join(`admin:${payload.ws}`);
    } else {
      for (const channelId of allowed)
        await socket.join(`channel:${channelId}`);
    }
    logger.debug(
      { workspace_id: payload.ws, channel_id: undefined },
      `socket connected (${allowed === "all" ? "all channels" : `${allowed.length} channels`})`,
    );
  });

  // Bridge: Redis bus → permission-scoped Socket.io rooms.
  const sub = createEventSubscriber(
    config.REDIS_URL,
    (event: RealtimeEvent) => {
      relay(io, event);
    },
  );

  const port = config.API_PORT + 1; // realtime on api_port+1 by convention
  http.listen(port, () => {
    logger.info(`clariodesk realtime listening on :${port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down realtime");
    await sub.quit().catch(() => undefined);
    io.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

/** Emit an event to the narrowest room that satisfies its permission scope. */
function relay(io: Server, event: RealtimeEvent): void {
  if (event.channelId) {
    // Channel-scoped: assigned users via their channel room, admins via the
    // workspace admin room. Non-permitted sockets are in neither.
    io.to(`channel:${event.channelId}`)
      .to(`admin:${event.workspaceId}`)
      .emit(event.type, event);
    return;
  }
  if (event.userId) {
    io.to(`user:${event.userId}`).emit(event.type, event);
    return;
  }
  // Workspace-wide, non-channel events (e.g. phone status) → workspace room.
  io.to(`workspace:${event.workspaceId}`).emit(event.type, event);
}

main().catch((err) => {
  console.error("realtime failed to start", err);
  process.exit(1);
});
