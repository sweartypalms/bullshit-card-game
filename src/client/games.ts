import { socket } from "./socket";

type Card = {
  card_rank: number;
};

type ChatMessage = {
  message?: string;
  sender?: { username?: string };
  timestamp?: string | Date;
  username?: string;
  message_content?: string;
};

const roomId =
  (window as any).gameId || window.location.pathname.split("/").pop();
const currentUsername = document.body.dataset.username ?? "";
let currentPlayerName: string | null =
  document.getElementById("current-player-name")?.textContent ?? null;
let lastPlayedUserName: string | null = null;

socket.emit("joinRoom", roomId);

function showGameOverlay(message: string) {
  const winnerMessageElem = document.getElementById("winner-message");
  if (winnerMessageElem) {
    winnerMessageElem.textContent = message;
  }

  const gameOverlayElem = document.getElementById("game-overlay");
  if (gameOverlayElem) {
    gameOverlayElem.style.display = "flex";
  }

  document
    .querySelectorAll("#play-cards-btn, #bs-btn, #start-btn")
    .forEach((btn) => ((btn as HTMLButtonElement).disabled = true));
}

function appendChatMessage(text: string) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) {
    return;
  }

  const li = document.createElement("li");
  li.className = "chat-message-item";
  li.textContent = text;
  chatMessages.appendChild(li);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function loadChatHistory() {
  try {
    const response = await fetch(`/chat/${roomId}/messages`);
    if (!response.ok) {
      return;
    }

    const messages: ChatMessage[] = await response.json();
    messages.forEach((msg) => {
      appendChatMessage(
        `[${new Date(msg.timestamp ?? "").toLocaleTimeString()}] ${msg.username}: ${msg.message_content}`,
      );
    });
  } catch (_error) {
    // Keep the game playable even if chat history fails to load.
  }
}

socket.on("game:update", (data) => {
  currentPlayerName = data.currentPlayer?.username ?? null;
  lastPlayedUserName = data.lastPlayedUser ?? null;

  updateGameInfo(
    data.gameInfo,
    data.players ?? [],
    currentPlayerName,
    data.hostUsername ?? null,
  );
  updatePlayersList(data.players ?? []);
  updateUserCards(data.userCards ?? []);
  updateTurnActions();
});

socket.on("game:ended", ({ message }) => {
  showGameOverlay(message || "The game has ended.");
});

socket.on("game:winner", ({ winner }) => {
  showGameOverlay(`${winner} has won the game!`);
});

socket.on("game:currentCard", function (data) {
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
  const h3 = document.getElementById("current-card");
  if (h3) {
    const rankIndex = Math.floor((data.currentRank - 1) / 4);
    h3.innerHTML = "Current Card: " + ranks[rankIndex];
  }
});

socket.on(`chat:message:${roomId}`, (data: ChatMessage) => {
  appendChatMessage(
    `[${new Date(data.timestamp ?? "").toLocaleTimeString()}] ${data.sender?.username ?? "Unknown"}: ${data.message ?? ""}`,
  );
});

function updateGameInfo(
  gameInfo: any,
  players: any[],
  activePlayerName: string | null,
  hostUsername: string | null,
) {
  const minPlayers = document.getElementById("min-players");
  const maxPlayers = document.getElementById("max-players");
  const currentPlayerLabel = document.getElementById("current-player-name");
  const hostLabel = document.getElementById("host-name");
  const currentCardLabel = document.getElementById("current-card");
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  if (minPlayers) minPlayers.textContent = String(gameInfo.min_players);
  if (maxPlayers) maxPlayers.textContent = String(gameInfo.max_players);
  if (currentPlayerLabel)
    currentPlayerLabel.textContent = activePlayerName ?? "Waiting...";
  if (hostLabel) hostLabel.textContent = hostUsername ?? "Unknown";
  if (currentCardLabel) {
    const rankIndex = Math.floor((gameInfo.current_supposed_rank - 1) / 4);
    currentCardLabel.textContent = `Current Card: ${ranks[rankIndex]}`;
  }

  const startButton = document.getElementById("start-btn") as HTMLButtonElement | null;
  if (startButton) {
    const gameStarted = Boolean(gameInfo.game_started);
    const canStart = players.length >= Number(gameInfo.min_players) && !gameStarted;
    startButton.disabled = !canStart;
    startButton.textContent = gameStarted ? "Game Started" : "Start Game";
    startButton.classList.toggle("game-started", gameStarted);
    startButton.style.backgroundColor = gameStarted
      ? "#a0a7b4"
      : canStart
        ? "#2ecc71"
        : "#e74c3c";
    startButton.title = gameStarted
      ? "The game has already started"
      : canStart
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
        (player) => `<li class="player">${player.username || player.name}</li>`,
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
    const rankDiff =
      Math.floor((a.card_rank - 1) / 4) - Math.floor((b.card_rank - 1) / 4);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return ((a.card_rank - 1) % 4) - ((b.card_rank - 1) % 4);
  });

  cardList.innerHTML = sortedCards.map(renderCardMarkup).join("");
  bindCardSelection();
}

function renderCardMarkup(card: Card) {
  const zeroBased = card.card_rank - 1;
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
  const suits = ["&spades;", "&clubs;", "&diams;", "&hearts;"];
  const rank = ranks[Math.floor(zeroBased / 4)];
  const suit = suits[zeroBased % 4];
  const colorClass = zeroBased % 4 >= 2 ? "card-red" : "card-black";

  return `
    <li>
      <label class="card-option">
        <input type="checkbox" name="selectedCards" value="${card.card_rank}" class="card-checkbox" />
        <span class="card-face ${colorClass}">
          <span class="card-corner top">
            <span class="card-rank">${rank}</span>
            <span class="card-suit-small">${suit}</span>
          </span>
          <span class="card-center">${suit}</span>
          <span class="card-corner bottom">
            <span class="card-rank">${rank}</span>
            <span class="card-suit-small">${suit}</span>
          </span>
        </span>
      </label>
    </li>
  `;
}

function updateTurnActions() {
  const playButton = document.getElementById("play-cards-btn") as HTMLButtonElement | null;
  const bsButton = document.getElementById("bs-btn") as HTMLButtonElement | null;
  const turnNotice = document.getElementById("turn-notice");
  const turnBanner = document.getElementById("turn-banner");
  const selectedCards = document.querySelectorAll(".card-checkbox:checked").length;
  const isCurrentPlayer = currentPlayerName === currentUsername;

  if (playButton) {
    playButton.disabled = !isCurrentPlayer || selectedCards === 0 || selectedCards > 4;
  }

  if (bsButton) {
    const canCallBs = currentUsername !== lastPlayedUserName;
    bsButton.disabled = !canCallBs;
    bsButton.style.backgroundColor = canCallBs ? "#e74c3c" : "#ccc";
  }

  if (turnNotice) {
    turnNotice.textContent = isCurrentPlayer
      ? "It's your turn. Select up to 4 cards to play."
      : `It's ${currentPlayerName ?? "another player's"} turn.`;
  }

  if (turnBanner) {
    turnBanner.textContent = isCurrentPlayer
      ? "It's your turn"
      : `Waiting for ${currentPlayerName ?? "another player"}`;
    turnBanner.classList.toggle("your-turn", isCurrentPlayer);
    turnBanner.classList.toggle("waiting-turn", !isCurrentPlayer);
  }
}

function bindCardSelection() {
  const checkboxes = document.querySelectorAll(".card-checkbox");

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const checked = document.querySelectorAll(".card-checkbox:checked");
      if (checked.length > 4) {
        (checkbox as HTMLInputElement).checked = false;
        alert("You can only select up to 4 cards.");
      }

      updateTurnActions();
    });
  });
}

const chatForm = document.getElementById("chat-form") as HTMLFormElement | null;
const chatInput = document.getElementById("chat-input") as HTMLInputElement | null;
if (chatForm && chatInput) {
  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) {
      return;
    }

    fetch(`/chat/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }).then((response) => {
      if (response.ok) {
        chatInput.value = "";
      }
    });
  });
}

const exitGameButton = document.getElementById("exit-game-btn");
if (exitGameButton) {
  exitGameButton.addEventListener("click", () => {
    window.location.href = "/lobby";
  });
}

loadChatHistory();
bindCardSelection();
updateTurnActions();
