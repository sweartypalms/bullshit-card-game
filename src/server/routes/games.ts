import express from "express";
import { Request, Response } from "express";
import { saveChatMessage } from "../db/chat";

import { Game } from "../db";
import { getAvailableGames, getCurrentPlayer } from "../db/games";

const router = express.Router();

const emitLobbyGames = async (request: Request) => {
  const io = request.app.get("io");
  const games = await getAvailableGames();
  io.to("lobby").emit("lobby:games", { games });
};

const buildGameState = async (gameId: number, userId: number) => {
  const players = await Game.getPlayersInGame(gameId);
  const gameInfo = await Game.getGameInfo(gameId);
  const userCards = await Game.getUserCards(userId, gameId);
  const currentPlayer = await Game.getCurrentPlayer(gameId);
  const gameRoom = await Game.getGameRoomFields(gameId, ["last_played_user_id"]);
  const hostUser = gameInfo?.game_room_host_user_id
    ? await Game.getUserById(gameInfo.game_room_host_user_id)
    : null;

  let lastPlayedUser = null;
  if (gameRoom.last_played_user_id) {
    const user = await Game.getUserById(gameRoom.last_played_user_id);
    lastPlayedUser = user?.username ?? null;
  }

  return {
    players,
    gameInfo,
    userCards,
    currentPlayer,
    lastPlayedUser,
    hostUsername: hostUser?.username ?? null,
  };
};

const emitGameState = async (request: Request, gameId: number) => {
  const io = request.app.get("io");
  const players = await Game.getPlayersInGame(gameId);

  await Promise.all(
    players.map(async (player) => {
      const state = await buildGameState(gameId, player.user_id);
      io.to(String(player.user_id)).emit("game:update", state);
    }),
  );
};

router.post("/create", async (request: Request, response: Response) => {
  // @ts-ignore
  const host_id = request.session?.user_id as number;
  const { game_name, minPlayers, maxPlayers } = request.body;
  const games = await getAvailableGames();
  const password = request.body.password === "" ? null : request.body.password;

  try {
    const gameId = await Game.create(
      game_name,
      minPlayers,
      maxPlayers,
      password,
      host_id,
    );
    await emitLobbyGames(request);
    response.redirect(`/games/${gameId}`);
  } catch (error: any) {
    if (error.code === "23505") {
      return response.render("lobby", {
        warning:
          "A game with that name already exists. Please choose another name.",
        game_name,
        minPlayers,
        maxPlayers,
        password,
        roomId: 0,
        // @ts-ignore
        username: request.session?.username,
        // @ts-ignore
        isGuest: Boolean(request.session?.isGuest),
        games,
      });
    }
    console.log({ error });
    response.redirect("/lobby");
  }
});

router.post("/join/:gameId", async (request: Request, response: Response) => {
  const { gameId } = request.params;
  const { password } = request.body;
  // @ts-ignore
  const user_id = request.session.user_id;

  const user = await Game.getUserById(user_id);
  if (user && user.game_room_id) {
    return response.redirect(
      "/lobby?warning=You%20are%20already%20in%20a%20game.",
    );
  }

  const gameInfo = await Game.getGameInfo(Number(gameId));
  if (!gameInfo) {
    return response.redirect("/lobby?warning=Game%20not%20found");
  }

  if (
    (gameInfo.game_room_password && gameInfo.game_room_password !== password) ||
    (gameInfo.game_room_password === null && password)
  ) {
    return response.redirect("/lobby?warning=Incorrect%20password");
  }

  const currentPlayers = await Game.getPlayerCount(Number(gameId));
  if (currentPlayers.count >= gameInfo.max_players) {
    return response.redirect("/lobby?warning=Game%20full");
  }

  try {
    const playerCount = await Game.join(user_id, Number(gameId), password);
    const io = request.app.get("io");
    // @ts-ignore
    const username = request.session.username;
    const serverMsg = `${username} has joined the game.`;

    io.to(gameId).emit(`chat:message:${gameId}`, {
      sender: { username: "Server" },
      message: serverMsg,
      timestamp: Date.now(),
    });

    await saveChatMessage(Number(gameId), "Server", serverMsg);
    await emitLobbyGames(request);
    await emitGameState(request, Number(gameId));

    console.log({ playerCount });
    response.redirect(`/games/${gameId}`);
  } catch (error: any) {
    console.log("game join error", { error });
    response.redirect("/lobby?warning=Could%20not%20join%20game");
  }
});

router.post("/abandon/:gameId", async (request: Request, response: Response) => {
  const { gameId } = request.params;
  const numericGameId = Number(gameId);
  const io = request.app.get("io");
  // @ts-ignore
  const username = request.session.username;

  io.to(gameId).emit("game:ended", {
    message: username + " abandoned the game. The game has ended.",
    redirectTo: "/lobby",
  });

  await Game.deleteGame(numericGameId);
  await emitLobbyGames(request);

  response.status(204).end();
});

router.post("/leave/:gameId", async (request: Request, response: Response) => {
  const { gameId } = request.params;
  const numericGameId = Number(gameId);

  // @ts-ignore
  const user_id = request.session.user_id;
  // @ts-ignore
  const username = request.session.username;
  const io = request.app.get("io");

  let isHost = false;
  if (user_id) {
    isHost = await Game.isHost(user_id, numericGameId);
  }

  if (isHost) {
    io.to(gameId).emit("game:ended", {
      message: `${username} was the host and left the game. The game has ended.`,
      redirectTo: "/lobby",
    });
    await Game.deleteGame(numericGameId);
    await emitLobbyGames(request);
  } else if (user_id) {
    await Game.leaveGame(user_id, numericGameId);

    const { count } = await Game.getPlayerCount(numericGameId);
    if (count === 0) {
      await Game.deleteGame(numericGameId);
    } else {
      const serverMsg = `${username} has left the game.`;
      io.to(gameId).emit(`chat:message:${gameId}`, {
        sender: { username: "Server" },
        message: serverMsg,
        timestamp: Date.now(),
      });
      await saveChatMessage(Number(gameId), "Server", serverMsg);
      await emitGameState(request, numericGameId);
    }
    await emitLobbyGames(request);
  } else {
    const { count } = await Game.getPlayerCount(numericGameId);
    if (count === 0) {
      await Game.deleteGame(numericGameId);
      await emitLobbyGames(request);
    }
  }

  if (request.headers.accept !== "application/json") {
    response.redirect("/lobby");
  } else {
    response.status(204).end();
  }
});

router.get("/:gameId", async (request: Request, response: Response) => {
  const io = request.app.get("io");
  const { gameId } = request.params;
  const numericGameId = Number(gameId);

  // @ts-ignore
  const username = request.session.username;
  // @ts-ignore
  const user_id = request.session.user_id;

  const game = await Game.getGameNameById(numericGameId);
  const players = await Game.getPlayersInGame(numericGameId);
  const gameInfo = await Game.getGameInfo(numericGameId);
  const userCards = await Game.getUserCards(user_id, numericGameId);
  const currentPlayer = await Game.getCurrentPlayer(numericGameId);
  const state = await buildGameState(numericGameId, user_id);

  if (!game || !game.game_room_name) {
    return response.redirect("/lobby");
  }

  const { game_room_name } = game;
  const isHost = user_id === gameInfo.game_room_host_user_id;

  io.to(String(user_id)).emit("game:update", state);

  if (currentPlayer && currentPlayer.username) {
    io.to(gameId).emit(`chat:message:${gameId}`, {
      sender: { username: "Server" },
      message: `It's ${currentPlayer.username}'s turn!`,
      timestamp: Date.now(),
    });
  }

  response.render("games", {
    gameId,
    username,
    game_name: game_room_name,
    isHost,
    players,
    min_players: gameInfo.min_players,
    max_players: gameInfo.max_players,
    userCards,
    currentPlayer: currentPlayer?.username,
    currentRank: gameInfo.current_supposed_rank,
    gameStarted: gameInfo.game_started,
    lastPlayedUser: state.lastPlayedUser,
    hostUsername: state.hostUsername,
  });
});

router.post("/:gameId/play", async (req, res) => {
  const io = req.app.get("io");
  const { gameId } = req.params;
  const numericGameId = Number(gameId);
  const { cards } = req.body;

  const gameInfo = await Game.getGameInfo(numericGameId);
  const currentRank = gameInfo.current_supposed_rank;

  let nextCurrentRank = currentRank + 4;
  if (nextCurrentRank > 52) nextCurrentRank = 1;

  const ranks = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  const rankName = ranks[Math.floor((currentRank - 1) / 4)];

  await Game.moveCardsToPile(cards.map(Number), numericGameId);
  // @ts-ignore
  await Game.touchUser(req.session.user_id);
  await Game.setLastPlayed(
    numericGameId,
    gameInfo.current_players_turn,
    cards.map(Number),
  );

  const players = await Game.getPlayersInGame(numericGameId);
  // @ts-ignore
  const user_id = req.session.user_id;
  const currentIndex = players.findIndex((p) => p.user_id === user_id);
  const nextIndex = (currentIndex + 1) % players.length;
  const nextPlayer = players[nextIndex];
  // @ts-ignore
  const username = req.session.username;
  const current_player = await getCurrentPlayer(numericGameId);
  const current_players_username = current_player.username;

  await Game.setCurrentPlayerTurn(numericGameId, nextPlayer.user_id);
  await Game.setSupposedRank(numericGameId, nextCurrentRank);
  io.to(gameId).emit("game:currentCard", { currentRank: nextCurrentRank });

  const playerTurnMessage = `${current_players_username} has played ${cards.length} card${cards.length > 1 ? "s" : ""} of rank ${rankName}`;
  io.to(gameId).emit(`chat:message:${gameId}`, {
    sender: { username: "Server" },
    message: playerTurnMessage,
    timestamp: Date.now(),
  });
  await saveChatMessage(numericGameId, "Server", playerTurnMessage);

  const playerTurnMessage2 = `It's ${nextPlayer.username}'s turn!`;
  io.to(gameId).emit(`chat:message:${gameId}`, {
    sender: { username: "Server" },
    message: playerTurnMessage2,
    timestamp: Date.now(),
  });
  await saveChatMessage(numericGameId, "Server", playerTurnMessage2);

  const userCards = await Game.getUserCards(user_id, numericGameId);
  console.log("current players num cards: " + userCards.length);
  if (Number(userCards.length) === 0) {
    io.to(gameId).emit("game:winner", { winner: username });
    await Game.setGameFinished(numericGameId, user_id);
  }

  await emitGameState(req, numericGameId);

  res.sendStatus(200);
});

router.get("/:gameId/start-test", async (req, res) => {
  const { gameId } = req.params;
  const numericGameId = Number(gameId);

  try {
    await Game.start(numericGameId);
    // @ts-ignore
    await Game.touchUser(req.session.user_id);
    const currentPlayer = await Game.getCurrentPlayer(numericGameId);
    const gameInfo = await Game.getGameInfo(numericGameId);

    if (!currentPlayer?.username) {
      throw new Error("Current turn could not be determined after the game started.");
    }

    const io = req.app.get("io");
    io.to(gameId).emit("game:currentCard", {
      currentRank: gameInfo.current_supposed_rank,
    });
    io.to(gameId).emit(`chat:message:${gameId}`, {
      sender: { username: "Server" },
      message: `It's ${currentPlayer.username}'s turn!`,
      timestamp: Date.now(),
    });

    await emitGameState(req, numericGameId);
    res.json({ success: true, message: "Game started and cards dealt!" });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

router.post("/:gameId/bs", (request: Request, response: Response) => {
  (async () => {
    const io = request.app.get("io");

    const { gameId } = request.params;
    const numericGameId = Number(gameId);
    // @ts-ignore
    const user_id = request.session.user_id;

    const gameInfo = await Game.getGameInfo(numericGameId);
    const currentRank = gameInfo.current_supposed_rank;

    let prevCurrentRank = currentRank - 4;
    if (prevCurrentRank < 1) prevCurrentRank += 52;
    const prevCurrentRankIndex = Math.floor((prevCurrentRank - 1) / 4);

    const {
      last_played_cards,
      last_played_user_id,
      game_card_pile_game_card_pile_id,
    } = await Game.getGameRoomFields(numericGameId, [
      "last_played_cards",
      "last_played_user_id",
      "game_card_pile_game_card_pile_id",
    ]);

    if (!last_played_cards || last_played_cards.length === 0) {
      response.status(400).json({ error: "No cards to challenge." });
      return;
    }

    const allMatch = last_played_cards.every(
      (cardRank: number) =>
        Math.floor((cardRank - 1) / 4) === prevCurrentRankIndex,
    );

    const pileCards = await Game.getPileCards(game_card_pile_game_card_pile_id);

    let loser_id;
    if (allMatch) {
      loser_id = user_id;
    } else {
      loser_id = last_played_user_id;
    }

    if (pileCards.length > 0) {
      await Game.giveCardsToUser(loser_id, pileCards);
    }

    await Game.touchUser(user_id);

    const caller = await Game.getUserById(user_id);
    const lastPlayer = await Game.getUserById(last_played_user_id);
    let message;
    if (allMatch) {
      message = `${caller?.username} called Bullshit, but ${lastPlayer?.username} told the truth! ${caller?.username} takes the pile.`;
    } else {
      message = `${caller?.username} called Bullshit and was correct! ${lastPlayer?.username} takes the pile.`;
    }

    io.to(gameId).emit(`chat:message:${gameId}`, {
      sender: { username: "Server" },
      message,
      timestamp: Date.now(),
    });
    await saveChatMessage(numericGameId, "Server", message);
    await emitGameState(request, numericGameId);

    response.sendStatus(200);
  })().catch((err) => {
    console.error(err);
    response.status(500).json({ error: "Internal server error" });
  });
});

export default router;
