import { Server } from "socket.io";
import type { Express, RequestHandler } from "express";

type OnlineUser = {
  userId: string;
  username: string;
  connections: number;
};

const onlineUsers = new Map<string, OnlineUser>();

const emitLobbyPresence = (io: Server) => {
  const players = [...onlineUsers.values()]
    .map(({ userId, username }) => ({ userId, username }))
    .sort((left, right) => left.username.localeCompare(right.username));

  io.to("lobby").emit("lobby:presence", {
    count: players.length,
    players,
  });
};

const configureSockets = (
  io: Server,
  app: Express,
  sessionMiddleware: RequestHandler,
) => {
  app.set("io", io);

  io.engine.use(sessionMiddleware);

  io.on("connection", (socket) => {
    // @ts-ignore
    console.log("Session data:", socket.request.session);

    // @ts-ignore
    const { user_id, username } = socket.request.session;

    if (user_id && username) {
      console.log(`User [${username}] connected with session id ${socket.id}`);
      socket.join(user_id.toString());

      const key = user_id.toString();
      const existing = onlineUsers.get(key);
      onlineUsers.set(key, {
        userId: key,
        username,
        connections: (existing?.connections ?? 0) + 1,
      });
      emitLobbyPresence(io);
    } else {
      console.warn("User session data is missing or incomplete.");
    }

    socket.on("joinLobby", () => {
      socket.join("lobby");
      console.log(`Socket ${socket.id} joined lobby updates`);
      emitLobbyPresence(io);
    });

    socket.on("joinRoom", (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on("chat:message", ({ roomId, message, username }) => {
      console.log(
        `Message received in room ${roomId} from ${username}: ${message}`,
      );

      io.to(roomId).emit(`chat:message${roomId}`, {
        message,
        sender: { username },
        timestamp: new Date(),
      });
    });

    socket.on("disconnect", () => {
      if (user_id && username) {
        console.log(`User [${username}] disconnected`);
        socket.leave(user_id.toString());

        const key = user_id.toString();
        const existing = onlineUsers.get(key);
        if (existing) {
          if (existing.connections <= 1) {
            onlineUsers.delete(key);
          } else {
            onlineUsers.set(key, {
              ...existing,
              connections: existing.connections - 1,
            });
          }
          emitLobbyPresence(io);
        }
      }

      socket.leave("lobby");
    });
  });
};
export default configureSockets;
