"use strict";

/* ========================================================================== 
   EASY-TO-EDIT GAME SETTINGS
   Put image files in the assets folder, then change only these paths/values.
   ========================================================================== */
const CONFIG = {
  beeImage: "assets/honeybee.png",

  // Add, remove, or reorder your farm photo paths here.
  // The game still works with its simple color background if files are missing.
  farmBackgrounds: [
    // "assets/farm-1.jpg",
    // "assets/farm-2.jpg",
    // "assets/farm-3.jpg",
  ],

  startingLives: 3,
  gravity: 1350, // Higher = the bee falls faster.
  flapStrength: 475, // Higher = each flap pushes the bee farther upward.
  obstacleSpeed: 175, // Higher = obstacles move faster.
  obstacleGapSize: 165, // Smaller = a harder opening to fly through.
  obstacleSpacingSeconds: 1.65, // Smaller = obstacles appear more often.
  backgroundTransitionSeconds: 9,
  lifeLostPauseMilliseconds: 700,
};

/* ========================================================================== 
   PAGE ELEMENTS AND GAME STATE
   ========================================================================== */
const gameElement = document.querySelector("#game");
const canvas = document.querySelector("#gameCanvas");
const context = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const livesElement = document.querySelector("#lives");
const resetButton = document.querySelector("#resetButton");
const playAgainButton = document.querySelector("#playAgainButton");
const messagePanel = document.querySelector("#message");
const messageText = document.querySelector("#messageText");
const backgroundLayers = [
  document.querySelector(".layer-one"),
  document.querySelector(".layer-two"),
];

let gameWidth = 720;
let gameHeight = 480;
let score = 0;
let lives = CONFIG.startingLives;
let gameState = "ready"; // ready, playing, life-lost, or game-over
let obstacles = [];
let obstacleTimer = 0;
let lastFrameTime = performance.now();

const bee = {
  x: 0,
  y: 0,
  velocityY: 0,
  width: 58,
  height: 42,
};

const beeImage = new Image();
let beeImageReady = false;
beeImage.addEventListener("load", () => {
  beeImageReady = true;
});
beeImage.src = CONFIG.beeImage;

/* ========================================================================== 
   SETUP AND RESPONSIVE SIZING
   ========================================================================== */
function resizeGame() {
  const bounds = gameElement.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  gameWidth = bounds.width;
  gameHeight = bounds.height;
  canvas.width = Math.round(gameWidth * pixelRatio);
  canvas.height = Math.round(gameHeight * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const sizeScale = Math.min(gameWidth / 720, gameHeight / 480);
  bee.width = Math.max(44, Math.min(68, 58 * sizeScale));
  bee.height = bee.width * 0.72;
  bee.x = gameWidth * 0.27;

  if (gameState !== "playing") {
    bee.y = gameHeight * 0.5;
  } else {
    bee.y = Math.max(bee.height / 2, Math.min(gameHeight - bee.height / 2, bee.y));
  }
}

new ResizeObserver(resizeGame).observe(gameElement);

function updateHud() {
  scoreElement.textContent = score;
  livesElement.textContent = lives;
}

function setMessage(text, showButton = false) {
  messageText.textContent = text;
  playAgainButton.hidden = !showButton;
  messagePanel.classList.remove("is-hidden");
}

function hideMessage() {
  messagePanel.classList.add("is-hidden");
}

function resetBee() {
  bee.x = gameWidth * 0.27;
  bee.y = gameHeight * 0.5;
  bee.velocityY = 0;
}

function resetGame(startImmediately = false) {
  score = 0;
  lives = CONFIG.startingLives;
  obstacles = [];
  obstacleTimer = 0;
  resetBee();
  updateHud();

  if (startImmediately) {
    gameState = "playing";
    bee.velocityY = -CONFIG.flapStrength * getMotionScale();
    hideMessage();
  } else {
    gameState = "ready";
    setMessage("Click or press Space to start");
  }
}

/* ========================================================================== 
   INPUT: MOUSE, TOUCH, AND KEYBOARD
   ========================================================================== */
function flap() {
  if (gameState === "ready") {
    gameState = "playing";
    hideMessage();
  }

  if (gameState === "playing") {
    bee.velocityY = -CONFIG.flapStrength * getMotionScale();
  }
}

gameElement.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;
  event.preventDefault();
  gameElement.focus({ preventScroll: true });
  flap();
});

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLButtonElement) return;
  if (event.code !== "Space") return;
  if (gameState !== "game-over") {
    event.preventDefault();
    flap();
  }
});

resetButton.addEventListener("click", () => resetGame(false));
playAgainButton.addEventListener("click", (event) => {
  event.stopPropagation();
  resetGame(true);
  gameElement.focus({ preventScroll: true });
});

/* ========================================================================== 
   OBSTACLES, COLLISIONS, LIVES, AND SCORING
   ========================================================================== */
function getMotionScale() {
  return Math.max(0.72, Math.min(1.2, gameHeight / 480));
}

function addObstacle() {
  const gapSize = Math.min(CONFIG.obstacleGapSize, gameHeight * 0.42);
  const safeMargin = Math.max(34, gameHeight * 0.09);
  const minimumCenter = safeMargin + gapSize / 2;
  const maximumCenter = gameHeight - safeMargin - gapSize / 2;
  const gapCenter =
    minimumCenter + Math.random() * Math.max(1, maximumCenter - minimumCenter);

  obstacles.push({
    x: gameWidth + 10,
    width: Math.max(52, Math.min(82, gameWidth * 0.1)),
    gapTop: gapCenter - gapSize / 2,
    gapBottom: gapCenter + gapSize / 2,
    scored: false,
  });
}

function rectanglesOverlap(a, b) {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

function beeHitsObstacle(obstacle) {
  // Slightly smaller hit box keeps the game friendly for beginners.
  const insetX = bee.width * 0.16;
  const insetY = bee.height * 0.2;
  const beeBox = {
    left: bee.x - bee.width / 2 + insetX,
    right: bee.x + bee.width / 2 - insetX,
    top: bee.y - bee.height / 2 + insetY,
    bottom: bee.y + bee.height / 2 - insetY,
  };
  const topObstacle = {
    left: obstacle.x,
    right: obstacle.x + obstacle.width,
    top: 0,
    bottom: obstacle.gapTop,
  };
  const bottomObstacle = {
    left: obstacle.x,
    right: obstacle.x + obstacle.width,
    top: obstacle.gapBottom,
    bottom: gameHeight,
  };

  return (
    rectanglesOverlap(beeBox, topObstacle) ||
    rectanglesOverlap(beeBox, bottomObstacle)
  );
}

function loseLife() {
  if (gameState !== "playing") return;

  lives -= 1;
  updateHud();

  if (lives <= 0) {
    gameState = "game-over";
    setMessage(`Game over — score: ${score}`, true);
    return;
  }

  gameState = "life-lost";
  obstacles = [];
  obstacleTimer = 0;
  resetBee();
  setMessage(`Ouch! ${lives} ${lives === 1 ? "life" : "lives"} left`);

  window.setTimeout(() => {
    if (gameState !== "life-lost") return;
    gameState = "playing";
    hideMessage();
  }, CONFIG.lifeLostPauseMilliseconds);
}

function updateGame(deltaSeconds) {
  if (gameState !== "playing") return;

  const motionScale = getMotionScale();
  bee.velocityY += CONFIG.gravity * motionScale * deltaSeconds;
  bee.y += bee.velocityY * deltaSeconds;

  obstacleTimer += deltaSeconds;
  if (obstacleTimer >= CONFIG.obstacleSpacingSeconds) {
    obstacleTimer = 0;
    addObstacle();
  }

  for (const obstacle of obstacles) {
    obstacle.x -= CONFIG.obstacleSpeed * motionScale * deltaSeconds;

    if (!obstacle.scored && obstacle.x + obstacle.width < bee.x) {
      obstacle.scored = true;
      score += 1;
      updateHud();
    }

    if (beeHitsObstacle(obstacle)) {
      loseLife();
      return;
    }
  }

  obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -10);

  if (bee.y - bee.height / 2 <= 0 || bee.y + bee.height / 2 >= gameHeight) {
    loseLife();
  }
}

/* ========================================================================== 
   DRAWING
   ========================================================================== */
function roundedRectangle(x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawObstaclePart(x, y, width, height) {
  if (height <= 0) return;

  const gradient = context.createLinearGradient(x, 0, x + width, 0);
  gradient.addColorStop(0, "rgba(35, 57, 29, 0.94)");
  gradient.addColorStop(0.55, "rgba(73, 104, 52, 0.96)");
  gradient.addColorStop(1, "rgba(24, 43, 22, 0.96)");

  roundedRectangle(x, y, width, height, 10);
  context.fillStyle = gradient;
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = "rgba(255, 211, 91, 0.92)";
  context.stroke();
}

function drawObstacles() {
  for (const obstacle of obstacles) {
    drawObstaclePart(obstacle.x, -12, obstacle.width, obstacle.gapTop + 12);
    drawObstaclePart(
      obstacle.x,
      obstacle.gapBottom,
      obstacle.width,
      gameHeight - obstacle.gapBottom + 12,
    );
  }
}

function drawBee() {
  context.save();
  context.translate(bee.x, bee.y);
  context.rotate(Math.max(-0.35, Math.min(0.55, bee.velocityY / 900)));

  if (beeImageReady) {
    context.drawImage(
      beeImage,
      -bee.width / 2,
      -bee.height / 2,
      bee.width,
      bee.height,
    );
  } else {
    // A tiny fallback keeps the game playable while a custom image is loading.
    context.font = `${bee.width * 0.72}px system-ui`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("🐝", 0, 1);
  }

  context.restore();
}

function draw() {
  context.clearRect(0, 0, gameWidth, gameHeight);
  drawObstacles();
  drawBee();
}

function animationLoop(frameTime) {
  const deltaSeconds = Math.min((frameTime - lastFrameTime) / 1000, 0.034);
  lastFrameTime = frameTime;
  updateGame(deltaSeconds);
  draw();
  requestAnimationFrame(animationLoop);
}

/* ========================================================================== 
   FARM PHOTO CROSSFADE
   ========================================================================== */
function loadImage(path) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(path), { once: true });
    image.addEventListener("error", () => resolve(null), { once: true });
    image.src = path;
  });
}

async function startBackgroundSlideshow() {
  const loadedPaths = (
    await Promise.all(CONFIG.farmBackgrounds.map((path) => loadImage(path)))
  ).filter(Boolean);

  if (loadedPaths.length === 0) return;

  let imageIndex = 0;
  let visibleLayerIndex = 0;
  backgroundLayers[0].style.backgroundImage = `url("${loadedPaths[0]}")`;
  backgroundLayers[0].classList.add("is-visible");

  if (loadedPaths.length === 1) return;

  window.setInterval(() => {
    imageIndex = (imageIndex + 1) % loadedPaths.length;
    const nextLayerIndex = visibleLayerIndex === 0 ? 1 : 0;
    const nextLayer = backgroundLayers[nextLayerIndex];
    const oldLayer = backgroundLayers[visibleLayerIndex];

    nextLayer.style.backgroundImage = `url("${loadedPaths[imageIndex]}")`;
    nextLayer.classList.add("is-visible");
    oldLayer.classList.remove("is-visible");
    visibleLayerIndex = nextLayerIndex;
  }, CONFIG.backgroundTransitionSeconds * 1000);
}

updateHud();
resizeGame();
startBackgroundSlideshow();
requestAnimationFrame(animationLoop);
