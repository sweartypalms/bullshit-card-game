import db from "../connection";
import bcrypt from "bcrypt";

export type User = {
  user_id: number;
  username: string;
  user_password: string | null;
};

export type UserProfileStats = {
  user_id: number;
  username: string;
  wins: number;
  losses: number;
  abandoned_games: number;
};

export type LeaderboardSortField =
  | "wins"
  | "losses"
  | "abandoned_games"
  | "username";

export type LeaderboardSortDirection = "asc" | "desc";

export type LeaderboardEntry = UserProfileStats;

let profileStatsColumnsSupported: boolean | null = null;

const hasProfileStatsColumns = async () => {
  if (profileStatsColumnsSupported !== null) {
    return profileStatsColumnsSupported;
  }

  const result = await db.one<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM information_schema.columns
     WHERE table_name = 'users'
       AND column_name IN ('wins', 'losses', 'abandoned_games')`,
  );

  profileStatsColumnsSupported = result.count === 3;
  return profileStatsColumnsSupported;
};

const register = async (username: string, password: string) => {
  const encryptedPassword = await bcrypt.hash(password, 10);

  const { user_id } = await db.one(
    "INSERT INTO users (username, user_password) VALUES ($1, $2) RETURNING user_id",
    [username, encryptedPassword],
  );
  console.log(user_id);
  return user_id;
};

const login = async (username: string, password: string) => {
  const user = await db.one<User>(
    "SELECT * FROM users WHERE username = $1 AND user_password IS NOT NULL",
    [username],
  );

  const hashedPassword = user.user_password;
  if (!hashedPassword) {
    throw new Error("Failed to login");
  }

  const passwordsMatch = await bcrypt.compare(password, hashedPassword);

  if (passwordsMatch) {
    return user.user_id;
  }

  throw new Error("Failed to login");
};

const createGuest = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = `Guest${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const { user_id } = await db.one(
        "INSERT INTO users (username, user_password) VALUES ($1, NULL) RETURNING user_id",
        [username],
      );

      return { user_id, username };
    } catch (error: any) {
      if (error.code !== "23505") {
        throw error;
      }
    }
  }

  throw new Error("Failed to create guest account");
};

const registeredUsersFilter = "user_password IS NOT NULL";

const selectProfileStats = async (whereClause: string, value: string | number) => {
  if (await hasProfileStatsColumns()) {
    return db.oneOrNone<UserProfileStats>(
      `SELECT user_id, username, wins, losses, abandoned_games
       FROM users
       WHERE ${whereClause}
         AND ${registeredUsersFilter}`,
      [value],
    );
  }

  return db.oneOrNone<UserProfileStats>(
    `SELECT user_id, username,
            0::int AS wins,
            0::int AS losses,
            0::int AS abandoned_games
     FROM users
     WHERE ${whereClause}
       AND ${registeredUsersFilter}`,
    [value],
  );
};

const getProfileStats = async (userId: number) => {
  return selectProfileStats("user_id = $1", userId);
};

const getProfileStatsByUsername = async (username: string) => {
  return selectProfileStats("username = $1", username);
};

const incrementWins = async (userId: number) => {
  if (!(await hasProfileStatsColumns())) {
    return;
  }

  await db.none(
    `UPDATE users
     SET wins = wins + 1,
         updated_at = NOW()
     WHERE user_id = $1
       AND ${registeredUsersFilter}`,
    [userId],
  );
};

const incrementLossesForUsers = async (userIds: number[]) => {
  if (!userIds.length || !(await hasProfileStatsColumns())) {
    return;
  }

  await db.none(
    `UPDATE users
     SET losses = losses + 1,
         updated_at = NOW()
     WHERE user_id = ANY($1)
       AND ${registeredUsersFilter}`,
    [userIds],
  );
};

const incrementAbandonedGames = async (userId: number) => {
  if (!(await hasProfileStatsColumns())) {
    return;
  }

  await db.none(
    `UPDATE users
     SET abandoned_games = abandoned_games + 1,
         updated_at = NOW()
     WHERE user_id = $1
       AND ${registeredUsersFilter}`,
    [userId],
  );
};

const getLeaderboard = async (
  sortBy: LeaderboardSortField = "wins",
  direction: LeaderboardSortDirection = "desc",
) => {
  const sortColumnMap: Record<LeaderboardSortField, string> = {
    wins: "wins",
    losses: "losses",
    abandoned_games: "abandoned_games",
    username: "username",
  };

  const orderColumn = sortColumnMap[sortBy] ?? "wins";
  const orderDirection = direction === "asc" ? "ASC" : "DESC";

  if (await hasProfileStatsColumns()) {
    return db.any<LeaderboardEntry>(
      `SELECT user_id, username, wins, losses, abandoned_games
       FROM users
       WHERE ${registeredUsersFilter}
       ORDER BY ${orderColumn} ${orderDirection}, username ASC`,
    );
  }

  return db.any<LeaderboardEntry>(
    `SELECT user_id, username,
            0::int AS wins,
            0::int AS losses,
            0::int AS abandoned_games
     FROM users
     WHERE ${registeredUsersFilter}
     ORDER BY ${orderColumn} ${orderDirection}, username ASC`,
  );
};

export default {
  register,
  login,
  createGuest,
  getProfileStats,
  getProfileStatsByUsername,
  incrementWins,
  incrementLossesForUsers,
  incrementAbandonedGames,
  getLeaderboard,
};
