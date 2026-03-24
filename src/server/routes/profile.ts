import express from "express";
import { Request, Response } from "express";
import User from "../db/users";

const router = express.Router();

const buildProfileViewModel = (
  stats: { wins: number; losses: number; abandoned_games: number },
  profileUsername: string,
  isGuest: boolean,
  isPopup: boolean,
) => {
  const totalTrackedGames = stats.wins + stats.losses + stats.abandoned_games;
  const chartSegments = [
    {
      label: "Wins",
      value: stats.wins,
      className: "wins",
      percent: totalTrackedGames
        ? Math.max((stats.wins / totalTrackedGames) * 100, 8)
        : 0,
    },
    {
      label: "Losses",
      value: stats.losses,
      className: "losses",
      percent: totalTrackedGames
        ? Math.max((stats.losses / totalTrackedGames) * 100, 8)
        : 0,
    },
    {
      label: "Abandoned",
      value: stats.abandoned_games,
      className: "abandoned",
      percent: totalTrackedGames
        ? Math.max((stats.abandoned_games / totalTrackedGames) * 100, 8)
        : 0,
    },
  ].filter((segment) => segment.value > 0);

  return {
    profileUsername,
    isGuest,
    isPopup,
    stats,
    totalTrackedGames,
    chartSegments,
  };
};

router.get("/", async (request: Request, response: Response) => {
  // @ts-ignore
  const userId = request.session.user_id;
  // @ts-ignore
  const isGuest = Boolean(request.session.isGuest);
  const popupQuery = Array.isArray(request.query.popup)
    ? request.query.popup[0]
    : request.query.popup;
  const isPopup = popupQuery === "1";

  if (isGuest) {
    return response.redirect("/lobby");
  }

  const stats = await User.getProfileStats(userId);
  if (!stats) {
    return response.redirect("/lobby");
  }

  response.render(
    "profile",
    buildProfileViewModel(stats, stats.username, isGuest, isPopup),
  );
});

router.get("/:username", async (request: Request, response: Response) => {
  const requestedUsername = Array.isArray(request.params.username)
    ? request.params.username[0]
    : request.params.username;
  const popupQuery = Array.isArray(request.query.popup)
    ? request.query.popup[0]
    : request.query.popup;
  const isPopup = popupQuery === "1";
  const stats = await User.getProfileStatsByUsername(requestedUsername);

  if (!stats) {
    response.status(404).render("profile", {
      profileUsername: requestedUsername,
      isGuest: false,
      isPopup,
      stats: { wins: 0, losses: 0, abandoned_games: 0 },
      totalTrackedGames: 0,
      chartSegments: [],
      notFound: true,
    });
    return;
  }

  response.render("profile", {
    ...buildProfileViewModel(stats, stats.username, false, isPopup),
    notFound: false,
  });
});

export default router;
