import { Server } from "socket.io";

import { Game } from "../db";

const INACTIVE_GAME_MINUTES = 5;
const CLEANUP_INTERVAL_MS = 60_000;

const startInactiveGameCleanup = (io: Server) => {
  const cleanupInactiveGames = async () => {
    try {
      const inactiveGames = await Game.getInactiveGames(INACTIVE_GAME_MINUTES);

      for (const game of inactiveGames) {
        io.to(String(game.game_room_id)).emit("game:ended", {
          message: `Game \"${game.game_room_name}\" ended after 5 minutes of inactivity.`,
          redirectTo: "/lobby",
        });
        await Game.deleteGame(game.game_room_id);
      }
    } catch (error) {
      console.error("Inactive game cleanup failed:", error);
    }
  };

  const interval = setInterval(cleanupInactiveGames, CLEANUP_INTERVAL_MS);
  interval.unref();

  return interval;
};

export default startInactiveGameCleanup;
