"use strict";

const GAME_LENGTH_SECONDS = 30;
const POINTS_PER_BUBBLE = 10;
const MIN_SPAWN_DELAY_MS = 260;
const MAX_SPAWN_DELAY_MS = 900;
const HIGH_SCORE_KEY = "bubble-pop-high-score";
const BUBBLE_COLORS = ["#ff6b9d", "#ffb84d", "#53c9b7", "#7c6cf2", "#54a8f5", "#f17bce"];

const playArea = document.querySelector("#play-area");
const bubblesContainer = document.querySelector("#bubbles");
const scoreDisplay = document.querySelector("#score");
const timerDisplay = document.querySelector("#timer");
const bestScoreDisplay = document.querySelector("#best-score");
const finalScoreDisplay = document.querySelector("#final-score");
const welcomeScreen = document.querySelector("#welcome-screen");
const gameOverScreen = document.querySelector("#game-over-screen");
const startButton = document.querySelector("#start-button");
const playAgainButton = document.querySelector("#play-again-button");
const soundToggle = document.querySelector("#sound-toggle");
const soundIcon = document.querySelector("#sound-icon");
const soundLabel = document.querySelector("#sound-label");

let score = 0;
let bestScore = loadBestScore();
let secondsRemaining = GAME_LENGTH_SECONDS;
let isPlaying = false;
let isMuted = false;
let countdownInterval = null;
let audioContext = null;
const scheduledTimeouts = new Set();

bestScoreDisplay.textContent = String(bestScore);

startButton.addEventListener("click", startGame);
playAgainButton.addEventListener("click", startGame);
soundToggle.addEventListener("click", toggleSound);
window.addEventListener("resize", keepBubblesInBounds);

function loadBestScore() {
  try {
    const savedScore = Number(window.localStorage.getItem(HIGH_SCORE_KEY));
    return Number.isFinite(savedScore) && savedScore >= 0 ? savedScore : 0;
  } catch (error) {
    console.warn("Could not read the high score from localStorage.", error);
    return 0;
  }
}

function saveBestScore() {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(bestScore));
  } catch (error) {
    console.warn("Could not save the high score to localStorage.", error);
  }
}

function startGame() {
  clearScheduledWork();
  bubblesContainer.replaceChildren();
  score = 0;
  secondsRemaining = GAME_LENGTH_SECONDS;
  isPlaying = true;
  updateScore();
  updateTimer();
  welcomeScreen.hidden = true;
  gameOverScreen.hidden = true;
  resumeAudio();

  spawnBubble();
  scheduleNextBubble();
  countdownInterval = window.setInterval(() => {
    secondsRemaining -= 1;
    updateTimer();

    if (secondsRemaining <= 0) {
      finishGame();
    }
  }, 1000);
}

function finishGame() {
  if (!isPlaying) {
    return;
  }

  isPlaying = false;
  clearScheduledWork();
  bubblesContainer.replaceChildren();
  finalScoreDisplay.textContent = String(score);
  gameOverScreen.hidden = false;
}

function clearScheduledWork() {
  if (countdownInterval !== null) {
    window.clearInterval(countdownInterval);
    countdownInterval = null;
  }

  for (const timeoutId of scheduledTimeouts) {
    window.clearTimeout(timeoutId);
  }
  scheduledTimeouts.clear();
}

function scheduleTimeout(callback, delay) {
  const timeoutId = window.setTimeout(() => {
    scheduledTimeouts.delete(timeoutId);
    callback();
  }, delay);
  scheduledTimeouts.add(timeoutId);
  return timeoutId;
}

function scheduleNextBubble() {
  if (!isPlaying) {
    return;
  }

  const elapsedSeconds = GAME_LENGTH_SECONDS - secondsRemaining;
  const delay = Math.max(
    MIN_SPAWN_DELAY_MS,
    MAX_SPAWN_DELAY_MS - elapsedSeconds * 21,
  );

  scheduleTimeout(() => {
    if (!isPlaying) {
      return;
    }
    spawnBubble();
    scheduleNextBubble();
  }, delay);
}

function spawnBubble() {
  if (!isPlaying) {
    return;
  }

  const areaWidth = playArea.clientWidth;
  const areaHeight = playArea.clientHeight;
  const bubbleSize = randomBetween(56, Math.min(104, Math.max(64, areaWidth * 0.17)));
  const maxLeft = Math.max(0, areaWidth - bubbleSize);
  const maxTop = Math.max(0, areaHeight - bubbleSize);
  const bubble = document.createElement("button");

  bubble.className = "bubble";
  bubble.type = "button";
  bubble.setAttribute("aria-label", `Pop bubble for ${POINTS_PER_BUBBLE} points`);
  bubble.style.width = `${bubbleSize}px`;
  bubble.style.height = `${bubbleSize}px`;
  bubble.style.left = `${randomBetween(0, maxLeft)}px`;
  bubble.style.top = `${randomBetween(0, maxTop)}px`;
  bubble.style.setProperty(
    "--bubble-color",
    BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
  );
  bubble.addEventListener("click", () => popBubble(bubble));
  bubblesContainer.append(bubble);
}

function popBubble(bubble) {
  if (!isPlaying || bubble.classList.contains("is-popping")) {
    return;
  }

  score += POINTS_PER_BUBBLE;
  updateScore();
  playPopSound();

  const bounds = bubble.getBoundingClientRect();
  const areaBounds = playArea.getBoundingClientRect();
  const points = document.createElement("span");
  points.className = "pop-points";
  points.textContent = `+${POINTS_PER_BUBBLE}`;
  points.style.left = `${bounds.left - areaBounds.left + bounds.width / 2}px`;
  points.style.top = `${bounds.top - areaBounds.top + bounds.height / 2}px`;
  bubblesContainer.append(points);

  bubble.classList.add("is-popping");
  scheduleTimeout(() => {
    bubble.remove();
    points.remove();
  }, 600);
}

function updateScore() {
  scoreDisplay.textContent = String(score);
  if (score > bestScore) {
    bestScore = score;
    bestScoreDisplay.textContent = String(bestScore);
    saveBestScore();
  }
}

function updateTimer() {
  timerDisplay.textContent = String(secondsRemaining);
  timerDisplay.setAttribute("aria-label", `${secondsRemaining} seconds`);
}

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function keepBubblesInBounds() {
  const areaWidth = playArea.clientWidth;
  const areaHeight = playArea.clientHeight;

  for (const bubble of bubblesContainer.querySelectorAll(".bubble")) {
    const size = bubble.offsetWidth;
    const left = Number.parseFloat(bubble.style.left) || 0;
    const top = Number.parseFloat(bubble.style.top) || 0;
    bubble.style.left = `${Math.min(left, Math.max(0, areaWidth - size))}px`;
    bubble.style.top = `${Math.min(top, Math.max(0, areaHeight - size))}px`;
  }
}

function toggleSound() {
  isMuted = !isMuted;
  soundToggle.setAttribute("aria-pressed", String(isMuted));
  soundToggle.setAttribute("aria-label", isMuted ? "Turn sound on" : "Mute sound");
  soundIcon.textContent = isMuted ? "🔇" : "🔊";
  soundLabel.textContent = isMuted ? "Sound off" : "Sound on";
}

function resumeAudio() {
  if (isMuted || typeof window.AudioContext !== "function") {
    return;
  }

  if (!audioContext) {
    audioContext = new window.AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch((error) => {
      console.warn("Could not resume the sound effects.", error);
    });
  }
}

function playPopSound() {
  if (isMuted || typeof window.AudioContext !== "function") {
    return;
  }

  resumeAudio();
  if (!audioContext || audioContext.state !== "running") {
    return;
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const volume = audioContext.createGain();
  const pitch = randomBetween(430, 720);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(pitch, now);
  oscillator.frequency.exponentialRampToValueAtTime(pitch * 1.55, now + 0.09);
  volume.gain.setValueAtTime(0.0001, now);
  volume.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  oscillator.connect(volume);
  volume.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.14);
}
