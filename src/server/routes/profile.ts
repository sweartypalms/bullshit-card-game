import express from "express";
import { Request, Response } from "express";
import User from "../db/users";

const router = express.Router();

router.get("/", async (request: Request, response: Response) => {
  // @ts-ignore
  const userId = request.session.user_id;
  // @ts-ignore
  const username = request.session.username;
  // @ts-ignore
  const isGuest = Boolean(request.session.isGuest);

  const stats = await User.getProfileStats(userId);
  if (!stats) {
    return response.redirect("/lobby");
  }

  const totalTrackedGames = stats.wins + stats.losses + stats.abandoned_games;
  const chartSegments = [
    {
      label: "Wins",
      value: stats.wins,
      className: "wins",
      percent: totalTrackedGames ? Math.max((stats.wins / totalTrackedGames) * 100, 8) : 0,
    },
    {
      label: "Losses",
      value: stats.losses,
      className: "losses",
      percent: totalTrackedGames ? Math.max((stats.losses / totalTrackedGames) * 100, 8) : 0,
    },
    {
      label: "Abandoned",
      value: stats.abandoned_games,
      className: "abandoned",
      percent: totalTrackedGames ? Math.max((stats.abandoned_games / totalTrackedGames) * 100, 8) : 0,
    },
  ].filter((segment) => segment.value > 0);

  response.render("profile", {
    username,
    isGuest,
    stats,
    totalTrackedGames,
    chartSegments,
  });
});

export default router;
