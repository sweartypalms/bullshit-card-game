import express from "express";
import { Request, Response } from "express";
import db from "../db/connection";
import { Game } from "../db";

import User from "../db/users";

const router = express.Router();

router.get("/register", async (_request: Request, response: Response) => {
  response.render("auth/register", { error: null });
});

router.post("/register", async (request: Request, response: Response) => {
  const { username, password } = request.body;

  try {
    const user_id = await User.register(username, password);

    // @ts-ignore
    request.session.user_id = user_id;
    // @ts-ignore
    request.session.username = username;
    // @ts-ignore
    request.session.isGuest = false;

    response.redirect("/lobby");
  } catch (error) {
    console.error("Registration error: ", error);
    response.render("auth/register", {
      error: "An error occured when registering.",
    });
  }
});

router.get("/login", async (_request: Request, response: Response) => {
  response.render("auth/login", { error: null });
});

router.post("/guest", async (request: Request, response: Response) => {
  try {
    const guest = await User.createGuest();

    // @ts-ignore
    request.session.user_id = guest.user_id;
    // @ts-ignore
    request.session.username = guest.username;
    // @ts-ignore
    request.session.isGuest = true;

    response.redirect("/lobby");
  } catch (error) {
    console.error("Guest login error: ", error);
    response.redirect("/?warning=Could%20not%20start%20guest%20session");
  }
});

router.post("/login", async (request: Request, response: Response) => {
  const { username, password } = request.body;

  try {
    const user_id = await User.login(username, password);

    // @ts-ignore
    request.session.user_id = user_id;
    // @ts-ignore
    request.session.username = username;
    // @ts-ignore
    request.session.isGuest = false;
    // @ts-ignore
    const user = await db.oneOrNone(
      "SELECT game_room_id FROM users WHERE user_id = $1",
      [user_id],
    );

    if (user && user.game_room_id) {
      return response.redirect(`/games/${user.game_room_id}`);
    } else {
      return response.redirect("/lobby");
    }
  } catch (error) {
    console.error("Login error: ", error);
    response.render("auth/login", { error: "Invalid email or password" });
  }
});

router.get("/logout", async (request: Request, response: Response) => {
  // @ts-ignore
  const user_id = request.session.user_id;
  // @ts-ignore
  const username = request.session.username;
  const io = request.app.get("io");

  const game = await db.oneOrNone(
    "SELECT game_room_id FROM game_room WHERE game_room_host_user_id = $1",
    [user_id],
  );

  if (game) {
    io.to(String(game.game_room_id)).emit("game:ended", {
      message: `${username} was the host and left the game. The game has ended.`,
      redirectTo: "/lobby",
    });
    await Game.deleteGame(game.game_room_id);
  } else {
    await db.none("UPDATE users SET game_room_id = NULL WHERE user_id = $1", [
      user_id,
    ]);
  }

  request.session.destroy(() => {
    response.redirect("/");
  });
});

export default router;
