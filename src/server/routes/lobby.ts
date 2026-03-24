import express from "express";
import { Request, Response } from "express";
import { getAvailableGames } from "../db/games";

const router = express.Router();

router.get("/", async (request: Request, response: Response) => {
  try {
    const games = await getAvailableGames();

    // Get warning from query string if present
    const warning = request.query.warning;
    // Render the lobby view with the username
    response.render("lobby", {
      // @ts-ignore
      username: request.session?.username,
      // @ts-ignore
      isGuest: Boolean(request.session?.isGuest),
      games,
      warning,
    });
  } catch (error) {
    console.error("Error fetching lobby:", error);
    response.status(500).send("Internal Server Error");
  }
});

export default router;
