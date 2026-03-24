import { socket } from "./socket";

type Card = {
  card_rank: number;
};

const roomId =
  (window as any).gameId || window.location.pathname.split("/").pop();
const currentUsername = document.body.dataset.username ?? "";

socket.emit("joinRoom", roomId);

socket.on("game:update", (data) => {
  updateGameInfo(data.gameInfo, data.players ?? [], data.currentPlayer?.username ?? null);
  updatePlayersList(data.players ?? []);
  updateUserCards(data.userCards ?? []);
  updateTurnActions(data.currentPlayer?.username ?? null, data.lastPlayedUser ?? null);
});

socket.on("game:winner", ({ winner }) => {
  const winnerMessageElem = document.getElementById("winner-message");
  if (winnerMessageElem) {
    winnerMessageElem.textContent = `${winner} has won the game!`;
  }
  const gameOverlayElem = document.getElementById("game-overlay");
  if (gameOverlayElem) {
    gameOverlayElem.style.display = "flex";
  }
  document
    .querySelectorAll("#play-cards-btn, #bs-btn")
    .forEach((btn) => ((btn as HTMLButtonElement).disabled = true));
});

socket.on("game:supposedRank", function (data) {
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
  const h3 = document.getElementById("supposed-card");
  if (h3) {
    const rankIndex = Math.floor((data.supposedRank - 1) / 4);
    h3.innerHTML = "Supposed Card: " + ranks[rankIndex];
  }
});

function updateGameInfo(gameInfo: any, players: any[], currentPlayerName: string | null) {
  const minPlayers = document.getElementById("min-players");
  const maxPlayers = document.getElementById("max-players");
  const currentPlayerLabel = document.getElementById("current-player-name");
  if (minPlayers) minPlayers.textContent = String(gameInfo.min_players);
  if (maxPlayers) maxPlayers.textContent = String(gameInfo.max_players);
  if (currentPlayerLabel) currentPlayerLabel.textContent = currentPlayerName ?? "Waiting...";

  const startButton = document.getElementById("start-btn") as HTMLButtonElement | null;
  if (startButton) {
    const canStart = players.length >= Number(gameInfo.min_players);
    startButton.disabled = !canStart;
    startButton.style.backgroundColor = canStart ? "#2ecc71" : "#e74c3c";
    startButton.title = canStart
      ? "Enough players have joined. You can start the game."
      : `Need at least ${gameInfo.min_players} players to start`;
  }
}

function updatePlayersList(players: any[]) {
  const playersContainer = document.getElementById("players-list");
  const playerCount = document.getElementById("player-count");
  const maxPlayers = document.getElementById("max-players");

  if (playersContainer) {
    playersContainer.innerHTML = players
      .map(
        (player) =>
          `<li class="player">${player.username || player.name}</li>`,
      )
      .join("");
  }

  if (playerCount && maxPlayers) {
    playerCount.textContent = `${players.length}/${maxPlayers.textContent ?? "?"}`;
  }
}

function updateUserCards(cards: Card[]) {
  const cardList = document.getElementById("my-cards");
  if (!cardList) {
    return;
  }

  const sortedCards = [...cards].sort((a, b) => {
    const rankDiff = Math.floor((a.card_rank - 1) / 4) - Math.floor((b.card_rank - 1) / 4);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return ((a.card_rank - 1) % 4) - ((b.card_rank - 1) % 4);
  });

  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suits = ["s", "c", "d", "h"];

  cardList.innerHTML = sortedCards
    .map((card) => {
      const zeroBased = card.card_rank - 1;
      const cardName = `${ranks[Math.floor(zeroBased / 4)]}${suits[zeroBased % 4]}`;
      return `
        <li>
          <label>
            <input type="checkbox" name="selectedCards" value="${card.card_rank}" class="card-checkbox" />
            ${cardName} (${card.card_rank})
          </label>
        </li>
      `;
    })
    .join("");

  bindCardSelection();
}

function updateTurnActions(currentPlayerName: string | null, lastPlayedUser: string | null) {
  const playButton = document.getElementById("play-cards-btn") as HTMLButtonElement | null;
  const bsButton = document.getElementById("bs-btn") as HTMLButtonElement | null;
  const turnNotice = document.getElementById("turn-notice");
  const selectedCards = document.querySelectorAll('.card-checkbox:checked').length;
  const isCurrentPlayer = currentPlayerName === currentUsername;

  if (playButton) {
    playButton.disabled = !isCurrentPlayer || selectedCards === 0 || selectedCards > 4;
  }

  if (bsButton) {
    const canCallBs = currentUsername !== lastPlayedUser;
    bsButton.disabled = !canCallBs;
    bsButton.style.backgroundColor = canCallBs ? "#e74c3c" : "#ccc";
  }

  if (turnNotice) {
    turnNotice.textContent = isCurrentPlayer
      ? "It's your turn."
      : `It's ${currentPlayerName ?? "another player's"} turn.`;
  }
}

function bindCardSelection() {
  const checkboxes = document.querySelectorAll('.card-checkbox');
  const playBtn = document.getElementById('play-cards-btn') as HTMLButtonElement | null;

  checkboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const checked = document.querySelectorAll('.card-checkbox:checked');
      if (checked.length > 4) {
        (cb as HTMLInputElement).checked = false;
        alert("You can only select up to 4 cards.");
      }

      updateTurnActions(
        document.getElementById("current-player-name")?.textContent ?? null,
        null,
      );

      if (playBtn) {
        playBtn.disabled = checked.length === 0 || checked.length > 4 || document.getElementById("turn-notice")?.textContent !== "It's your turn.";
      }
    });
  });
}

bindCardSelection();
