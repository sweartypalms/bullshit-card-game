import { ChatMessage } from "global";
import { socket } from "./socket";
import { cloneTemplate, getRoomId } from "./utils";

const messageContainer =
  document.querySelector<HTMLDivElement>("#chat #messages");

const chatForm = document.querySelector<HTMLFormElement>("#chat form");
const chatInput = document.querySelector<HTMLInputElement>("#chat input");

const scrollChatToLatest = (behavior: ScrollBehavior = "smooth") => {
  messageContainer?.scrollTo({
    top: messageContainer.scrollHeight,
    behavior,
  });
};

const openProfilePopup = (username: string) => {
  window.open(
    `/profile/${encodeURIComponent(username)}?popup=1`,
    `profile-${username}`,
    "popup=yes,width=560,height=720,resizable=yes,scrollbars=yes",
  );
};

const renderChatMessage = (
  container: HTMLDivElement,
  username: string,
  message: string,
  timestamp: string,
) => {
  const textRow = container.querySelector<HTMLSpanElement>("div span:first-of-type");
  const timeRow = container.querySelector<HTMLSpanElement>("div span:last-of-type");

  if (!textRow || !timeRow) {
    return;
  }

  textRow.textContent = "";

  if (username && username !== "Server" && username !== "Unknown") {
    const profileButton = document.createElement("button");
    profileButton.type = "button";
    profileButton.className = "chat-username-button";
    profileButton.textContent = username;
    profileButton.addEventListener("click", () => openProfilePopup(username));
    textRow.appendChild(profileButton);
    textRow.append(`: ${message}`);
  } else {
    textRow.innerText = `${username}: ${message}`;
  }

  timeRow.innerText = new Date(timestamp).toLocaleTimeString();
};

const loadMessages = async () => {
  try {
    const roomId = getRoomId();

    socket.emit("joinRoom", roomId);
    const response = await fetch(`/chat/${roomId}/messages`);
    const messages = await response.json();

    messages.forEach(
      ({
        username,
        message_content,
        timestamp,
      }: {
        username: string;
        message_content: string;
        timestamp: string;
      }) => {
        const container = cloneTemplate<HTMLDivElement>(
          "#chat-message-template",
        );

        renderChatMessage(container, username, message_content, timestamp);
        messageContainer!.appendChild(container);
      },
    );

    scrollChatToLatest("auto");
  } catch (error) {
    console.error("Error loading messages:", error);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  loadMessages();
});

socket.on(
  `chat:message:${getRoomId()}`,
  ({ message, sender, timestamp }: ChatMessage) => {
    const container = cloneTemplate<HTMLDivElement>("#chat-message-template");

    renderChatMessage(
      container,
      sender.username,
      message,
      String(timestamp),
    );

    messageContainer!.appendChild(container);
    scrollChatToLatest();
  },
);

chatForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = chatInput?.value;

  if (!message) {
    return;
  }

  chatInput.value = "";

  fetch(`/chat/${getRoomId()}`, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
    }),
  }).catch((error) => {
    console.error("Error sending message:", error);
  });
});
