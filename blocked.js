const siteName = document.getElementById("siteName");
const blockedTimer = document.getElementById("blockedTimer");
const blockedMessage = document.getElementById("blockedMessage");
const exitButton = document.getElementById("exitButton");

let state = null;

const sendMessage = (type, payload) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Request failed."));
        return;
      }

      resolve(response.state);
    });
  });

const formatRemaining = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const render = (nextState) => {
  state = nextState;
  const params = new URLSearchParams(window.location.search);
  const site = params.get("site") || "This website";
  const active = Boolean(state.session_active && state.end_time && Date.now() < state.end_time);

  siteName.textContent = site;
  blockedTimer.textContent = active ? formatRemaining(state.end_time - Date.now()) : "00:00";
  exitButton.classList.toggle("hidden", !active || state.strict_mode);
  exitButton.disabled = !active || state.strict_mode;

  if (!active) {
    blockedMessage.textContent = "The session has ended. You can go back now.";
    return;
  }

  blockedMessage.textContent = state.strict_mode
    ? "Strict mode is active. Stay with the session."
    : "You can end this session early, or return to focus.";
};

const refresh = async () => {
  render(await sendMessage("getState"));
};

exitButton.addEventListener("click", () => {
  sendMessage("stopSession")
    .then(render)
    .catch((error) => {
      blockedMessage.textContent = error.message;
    });
});

refresh().catch((error) => {
  blockedMessage.textContent = error.message;
});

window.setInterval(() => {
  if (!state?.session_active || !state.end_time) {
    return;
  }

  render(state);
  if (Date.now() >= state.end_time) {
    refresh();
  }
}, 1000);
