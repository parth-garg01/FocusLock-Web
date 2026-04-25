const elements = {
  siteInput: document.getElementById("siteInput"),
  durationSelect: document.getElementById("durationSelect"),
  strictToggle: document.getElementById("strictToggle"),
  startButton: document.getElementById("startButton"),
  stopButton: document.getElementById("stopButton"),
  statusPill: document.getElementById("statusPill"),
  timerText: document.getElementById("timerText"),
  sessionCopy: document.getElementById("sessionCopy"),
  sanityButton: document.getElementById("sanityButton"),
  sanityList: document.getElementById("sanityList")
};

const formatRemaining = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const renderPlaceholderState = () => {
  elements.statusPill.textContent = "Inactive";
  elements.statusPill.classList.remove("active");
  elements.timerText.textContent = "00:00";
  elements.sessionCopy.textContent = "No active session.";
  elements.stopButton.disabled = true;
};

renderPlaceholderState();
