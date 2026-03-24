import { socket } from "./socket";

const modalButton = document.querySelector(
  "#open-create-modal",
) as HTMLElement | null;
const modal = document.querySelector(
  "#create-game-modal",
) as HTMLElement | null;
const closeButton = modal?.querySelector(".close-button") as HTMLElement | null;
const availableGames = document.getElementById("available-games");
const warningMessage = document.getElementById("lobby-warning");
const onlinePlayerCount = document.getElementById("online-player-count");
const onlinePlayerList = document.getElementById("online-player-list");

socket.emit("joinLobby");

modalButton?.addEventListener("click", () => {
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "block";
  }
});

closeButton?.addEventListener("click", () => {
  if (modal) {
    modal.style.display = "none";
  }
});

window.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal!.style.display = "none";
  }
});

type LobbyGame = {
  game_room_id: number;
  game_room_name: string;
  max_players: number;
  current_players: number;
};

type OnlinePlayer = {
  userId: string;
  username: string;
};

const renderGames = (games: LobbyGame[]) => {
  if (!availableGames) {
    return;
  }

  if (!games.length) {
    availableGames.innerHTML = "<li>No games available.</li>";
    return;
  }

  availableGames.innerHTML = games
    .map(
      (game) => `
        <li>
          <span class="status waiting">Waiting</span>
          <span class="game-name">${game.game_room_name}</span>
          <span class="game-players">${game.current_players}/${game.max_players} players</span>
          <form method="post" action="/games/join/${game.game_room_id}">
            <input type="text" name="password" placeholder="Password?" />
            <button type="submit">Join</button>
          </form>
        </li>
      `,
    )
    .join("");
};

const renderOnlinePlayers = (players: OnlinePlayer[]) => {
  if (onlinePlayerCount) {
    onlinePlayerCount.textContent = String(players.length);
  }

  if (!onlinePlayerList) {
    return;
  }

  if (!players.length) {
    onlinePlayerList.innerHTML = "<li>No players online yet.</li>";
    return;
  }

  onlinePlayerList.innerHTML = players
    .map(
      (player) => `
        <li>
          <span class="online-indicator"></span>
          <span>${player.username}</span>
        </li>
      `,
    )
    .join("");
};

socket.on("lobby:games", ({ games, warning }) => {
  renderGames(games);

  if (warningMessage) {
    warningMessage.textContent = warning ?? "";
    warningMessage.style.display = warning ? "block" : "none";
  }
});

socket.on("lobby:presence", ({ players }) => {
  renderOnlinePlayers(players ?? []);
});
