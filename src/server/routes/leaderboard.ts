import express from "express";
import { Request, Response } from "express";
import User, {
  type LeaderboardSortDirection,
  type LeaderboardSortField,
} from "../db/users";

const router = express.Router();

const allowedSortFields: LeaderboardSortField[] = [
  "wins",
  "losses",
  "abandoned_games",
  "username",
];

const allowedDirections: LeaderboardSortDirection[] = ["asc", "desc"];

const parseSortField = (value: unknown): LeaderboardSortField => {
  return typeof value === "string" && allowedSortFields.includes(value as LeaderboardSortField)
    ? (value as LeaderboardSortField)
    : "wins";
};

const parseSortDirection = (value: unknown): LeaderboardSortDirection => {
  return typeof value === "string" && allowedDirections.includes(value as LeaderboardSortDirection)
    ? (value as LeaderboardSortDirection)
    : "desc";
};

router.get("/", async (request: Request, response: Response) => {
  const sortBy = parseSortField(request.query.sort);
  const direction = parseSortDirection(request.query.direction);
  const entries = await User.getLeaderboard(sortBy, direction);

  response.render("leaderboard", {
    entries,
    sortBy,
    direction,
    // @ts-ignore
    isGuest: Boolean(request.session.isGuest),
  });
});

export default router;
