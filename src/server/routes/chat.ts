import express from "express";
import { Request, Response } from "express";
import db from "../db/connection";
import { Game } from "../db";

const router = express.Router();

router.post("/:roomId", async (request: Request, response: Response) => {
  const { roomId } = request.params;
  const { message } = request.body;
  const numericRoomId = Number(roomId);

  // @ts-ignore
  const username = request.session.username;
  // @ts-ignore
  const user_id = request.session.user_id;
  const io = request.app.get("io");

  if (!io) {
    response.status(500).send("Socket.io not initialized");
    return;
  }

  if (!message) {
    response.status(400).send("Message is required");
    return;
  }

  try {
    if (numericRoomId === 0) {
      await db.none(
        "DELETE FROM message WHERE game_room_game_room_id = $1 AND timestamp < NOW() - INTERVAL '3 days'",
        [numericRoomId],
      );
    }

    await db.none(
      "INSERT INTO message (game_room_game_room_id, username, message_content, user_user_id) VALUES ($1, $2, $3, $4)",
      [numericRoomId, username, message, user_id],
    );
    await Game.touchUser(user_id);

    io.to(roomId).emit(`chat:message:${roomId}`, {
      message,
      sender: { username },
      timestamp: new Date(),
    });

    response.status(200).send();
  } catch (error) {
    console.error("Error saving message:", error);
    response.status(500).send("Internal Server Error");
  }
});

router.get(
  "/:roomId/messages",
  async (request: Request, response: Response) => {
    const { roomId } = request.params;
    const numericRoomId = Number(roomId);

    try {
      const messages = await db.any(
        numericRoomId === 0
          ? "SELECT username AS username, message_content, timestamp FROM message WHERE game_room_game_room_id = $1 AND timestamp >= NOW() - INTERVAL '3 days' ORDER BY timestamp ASC"
          : "SELECT username AS username, message_content, timestamp FROM message WHERE game_room_game_room_id = $1 ORDER BY timestamp ASC",
        [numericRoomId],
      );

      response.json(messages);
    } catch (error) {
      console.error("Error retrieving messages:", error);
      response.status(500).send("Internal Server Error");
    }
  },
);

export default router;
