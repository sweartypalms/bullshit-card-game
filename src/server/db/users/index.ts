import db from "../connection";
import bcrypt from "bcrypt";

export type User = {
  user_id: number;
  username: string;
  user_password: string | null;
};

const register = async (username: string, password: string) => {
  // Encrypt password
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
  } else {
    throw new Error("Failed to login");
  }
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

export default { register, login, createGuest };
