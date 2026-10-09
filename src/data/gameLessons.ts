import type { Lesson } from './curriculum';

// Lessons keep a runnable game around the one small idea being practised.
// Checks use game state and simulated input, never the spelling of the answer.
type Check = {
  label: string;
  expression: string;
  actions?: {
    keys?: Record<string, boolean>;
    pointer?: { x: number; y: number; down?: boolean; clicked?: boolean };
    click?: boolean;
    frames?: number;
    dt?: number;
  }[];
};
type Remix = {
  task: string;
  starter: string;
  solution: string;
  tests: Check[];
  hints: string[];
};
type Spec = {
  id: string;
  unit: string;
  title: string;
  subtitle: string;
  concept: string;
  explanation: string;
  analogy: string;
  example: string;
  question: string;
  choices: string[];
  correct: number;
  answer: string;
  task: string;
  solution: string;
  replace?: [string, string];
  starter?: string;
  tests: Check[];
  hints: string[];
  takeaway: string;
  keywords: string[];
  project: string;
  controls?: 'pointer' | 'arrows' | 'platformer';
  minutes?: number;
  challenge?: Remix;
  snippets?: { label: string; code: string }[];
};

function unfinished(code: string, correct: string, incomplete: string) {
  if (!code.includes(correct)) throw new Error(`Missing curriculum scaffold: ${correct}`);
  return code.replace(correct, incomplete);
}

function lesson(spec: Spec): Lesson {
  return {
    id: spec.id,
    track: 'games',
    kind: 'game',
    unit: spec.unit,
    title: spec.title,
    subtitle: spec.subtitle,
    minutes: spec.minutes ?? 4,
    concept: spec.concept,
    explanation: spec.explanation,
    analogy: spec.analogy,
    example: spec.example,
    prediction: {
      question: spec.question,
      choices: spec.choices,
      correct: spec.correct,
      explanation: spec.answer,
    },
    task: spec.task,
    starter:
      spec.starter ?? (spec.replace ? unfinished(spec.solution, ...spec.replace) : spec.solution),
    solution: spec.solution,
    hints: spec.hints,
    takeaway: spec.takeaway,
    keywords: spec.keywords,
    game: {
      project: spec.project,
      controls: spec.controls ?? 'arrows',
      tests: spec.tests,
      challenge: spec.challenge,
      patch: spec.replace ? { before: spec.replace[1], after: spec.replace[0] } : undefined,
      snippets: spec.snippets ?? [{ label: 'The small idea', code: spec.example }],
    },
  };
}

const frames = (count: number, keys: Record<string, boolean> = {}, dt = 0.05) => ({
  keys,
  frames: count,
  dt,
});
const tap = (x: number, y: number) => ({ pointer: { x, y }, click: true, frames: 1, dt: 0.05 });
const reset = { keys: { space: true }, frames: 1, dt: 0.05 };
const release = {
  keys: { space: false, left: false, right: false, up: false, down: false },
  frames: 1,
  dt: 0.05,
};

const tileGame = (x = 140, y = 100) => `const tile = { x: ${x}, y: ${y}, w: 32, h: 32 };
function start() {}
function update(dt) {}
function draw() {
  game.text("Your first game piece", 18, 32);
  game.rect(tile.x, tile.y, tile.w, tile.h, "#a8ef95");
  game.text("x: " + tile.x + "  y: " + tile.y, 18, 218);
}`;

const hitTarget = `game.pointer.x >= target.x &&
      game.pointer.x < target.x + target.w &&
      game.pointer.y >= target.y &&
      game.pointer.y < target.y + target.h`;

const clicker = (useHelper = false) => `let score = 0;
const target = { x: 120, y: 80, w: 120, h: 70 };
function start() { score = 0; }
${useHelper ? 'function award(points) { score += points; }\n' : ''}function update(dt) {
  if (game.keys.space) { start(); return; }
  if (game.pointer.clicked && ${hitTarget}) {
    ${useHelper ? 'award(1);' : 'score += 1;'}
  }
}
function draw() {
  game.text("Stars: " + score, 18, 32);
  game.rect(target.x, target.y, target.w, target.h, "#a8ef95");
  game.text("Tap me", target.x + 22, target.y + 42, "#102a32");
  game.text("Restart with ↻ or Space", 18, 220, "#aabec5", 14);
}`;

const simpleClicks = clicker().replace(
  `game.pointer.clicked && ${hitTarget}`,
  'game.pointer.clicked'
);

const twoPointClicker = `let score = 0;
const target = { x: 40, y: 70, w: 80, h: 80 };
function start() { score = 0; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (game.pointer.clicked && ${hitTarget}) { score += 2; }
}
function draw() {
  game.rect(target.x, target.y, target.w, target.h, "#efcd79");
  game.text("Two-star treasure", 18, 32);
  game.text("Stars: " + score, 18, 200);
}`;

const targetGame = (goal = 3, timed = true) => `let score = 0;
let state = "playing";
let timeLeft = 10;
const target = { x: 150, y: 100, w: 40, h: 40 };
function moveTarget() {
  target.x = game.random(20, 300);
  target.y = game.random(60, 180);
}
function start() {
  score = 0;
  state = "playing";
  timeLeft = 10;
  target.x = 150;
  target.y = 100;
}
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (state !== "playing") return;
  ${timed ? 'timeLeft = Math.max(0, timeLeft - dt);\n  if (timeLeft <= 0) { state = "lost"; return; }' : ''}
  if (game.pointer.clicked && ${hitTarget}) {
    score += 1;
    moveTarget();
    if (score >= ${goal}) state = "won";
  }
}
function draw() {
  game.text("Catch ${goal} stars", 18, 28);
  game.text("Stars: " + score${timed ? ' + "   Time: " + Math.ceil(timeLeft)' : ''}, 18, 55, "#aabec5", 16);
  if (state === "playing") game.rect(target.x, target.y, target.w, target.h, "#efcd79");
  if (state === "won") game.text("You did it!", 105, 126, "#a8ef95", 24);
  if (state === "lost") game.text("Try again. You can do this.", 30, 126, "#efcd79", 18);
  game.text("Restart with ↻ or Space", 18, 222, "#aabec5", 14);
}`;

const threeHits = [tap(160, 110), tap(170, 130), tap(170, 130)];

const bonusTarget = `let score = 0;
let state = "playing";
const target = { x: 100, y: 100, w: 50, h: 50 };
function start() { score = 0; state = "playing"; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (state !== "playing") return;
  if (game.pointer.clicked && ${hitTarget}) {
    score += game.pointer.y < target.y + target.h / 2 ? 2 : 1;
    if (score >= 4) state = "won";
  }
}
function draw() {
  game.rect(100, 100, 50, 25, "#efcd79");
  game.rect(100, 125, 50, 25, "#a8ef95");
  game.text("Top: 2 stars. Bottom: 1.", 18, 32);
  game.text("Stars: " + score + "  " + state, 18, 205);
}`;

const pauseTarget = `let timeLeft = 8;
let paused = false;
function start() { timeLeft = 8; paused = false; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  paused = game.keys.down;
  if (!paused) timeLeft = Math.max(0, timeLeft - dt);
}
function draw() {
  game.text("Time: " + timeLeft.toFixed(1), 18, 70, "#efcd79", 26);
  game.text(paused ? "Paused" : "Counting down", 18, 110);
  game.text("Hold ↓ to pause. Restart with ↻.", 18, 190, "#aabec5", 16);
}`;

const movingBall = (timeBased = true) => `const ball = { x: 180, y: 115, w: 10, h: 10, vx: 100 };
function start() { ball.x = 180; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  ball.x += ${timeBased ? 'ball.vx * dt' : '1'};
}
function draw() {
  game.rect(ball.x, ball.y, ball.w, ball.h, "#efcd79");
  game.text("A ball moves a little each frame", 18, 32, "#aabec5", 16);
}`;

const wallBall = `const ball = { x: 175, y: 110, w: 10, h: 10, vy: 80 };
function start() { ball.y = 110; ball.vy = 80; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  ball.y += ball.vy * dt;
  if (ball.y < 0) { ball.y = 0; ball.vy = Math.abs(ball.vy); }
  if (ball.y + ball.h > game.height) {
    ball.y = game.height - ball.h;
    ball.vy = -Math.abs(ball.vy);
  }
}
function draw() {
  game.rect(ball.x, ball.y, ball.w, ball.h, "#efcd79");
  game.text("Watch the top and bottom", 18, 32, "#aabec5", 16);
}`;

const paddleGame = `const paddle = { x: 20, y: 90, w: 12, h: 60 };
function start() { paddle.y = 90; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (game.keys.up) paddle.y -= 160 * dt;
  if (game.keys.down) paddle.y += 160 * dt;
  paddle.y = game.clamp(paddle.y, 0, game.height - paddle.h);
}
function draw() {
  game.rect(paddle.x, paddle.y, paddle.w, paddle.h, "#a8ef95");
  game.text("Move with ↑ and ↓", 65, 120);
}`;

const horizontalPaddle = `const paddle = { x: 140, y: 210, w: 80, h: 12 };
function start() { paddle.x = 140; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (game.keys.left) paddle.x -= 140 * dt;
  if (game.keys.right) paddle.x += 140 * dt;
  paddle.x = game.clamp(paddle.x, 0, game.width - paddle.w);
}
function draw() {
  game.rect(paddle.x, paddle.y, paddle.w, paddle.h, "#a8ef95");
  game.text("A paddle for a brick game", 18, 35);
  game.text("Move with ← and →", 18, 65, "#aabec5", 16);
}`;

const bouncePaddle = `const paddle = { x: 20, y: 90, w: 12, h: 60 };
const ball = { x: 100, y: 115, w: 10, h: 10, vx: -100 };
function start() { paddle.y = 90; ball.x = 100; ball.vx = -100; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (game.keys.up) paddle.y -= 160 * dt;
  if (game.keys.down) paddle.y += 160 * dt;
  paddle.y = game.clamp(paddle.y, 0, game.height - paddle.h);
  ball.x += ball.vx * dt;
  if (ball.vx < 0 && game.overlap(ball, paddle)) {
    ball.x = paddle.x + paddle.w;
    ball.vx = Math.abs(ball.vx);
  }
}
function draw() {
  game.rect(paddle.x, paddle.y, paddle.w, paddle.h, "#a8ef95");
  game.rect(ball.x, ball.y, ball.w, ball.h, "#efcd79");
  game.text("Meet the ball with your paddle", 50, 30, "#aabec5", 16);
}`;

const pong = `let score = 0;
let state = "playing";
const paddle = { x: 20, y: 90, w: 12, h: 60 };
const ball = { x: 100, y: 115, w: 10, h: 10, vx: -120, vy: 0 };
function start() {
  score = 0;
  state = "playing";
  paddle.y = 90;
  ball.x = 100; ball.y = 115; ball.vx = -120; ball.vy = 0;
}
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (state !== "playing") return;
  if (game.keys.up) paddle.y -= 160 * dt;
  if (game.keys.down) paddle.y += 160 * dt;
  paddle.y = game.clamp(paddle.y, 0, game.height - paddle.h);
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.y < 0) { ball.y = 0; ball.vy = Math.abs(ball.vy); }
  if (ball.y + ball.h > game.height) { ball.y = game.height - ball.h; ball.vy = -Math.abs(ball.vy); }
  if (ball.x + ball.w > game.width) { ball.x = game.width - ball.w; ball.vx = -Math.abs(ball.vx); }
  if (ball.vx < 0 && game.overlap(ball, paddle)) {
    ball.x = paddle.x + paddle.w;
    ball.vx = Math.abs(ball.vx);
    ball.vy = (ball.y + ball.h / 2 - (paddle.y + paddle.h / 2)) * 2;
    score += 1;
    if (score >= 5) state = "won";
  }
  if (ball.x + ball.w < 0) state = "lost";
}
function draw() {
  game.text("Rally: " + score + " / 5", 115, 28);
  game.rect(paddle.x, paddle.y, paddle.w, paddle.h, "#a8ef95");
  game.rect(ball.x, ball.y, ball.w, ball.h, "#efcd79");
  if (state === "won") game.text("Five returns! You win.", 70, 120, "#a8ef95", 20);
  if (state === "lost") game.text("Missed. Restart and try again.", 45, 120, "#efcd79", 18);
  game.text("↑ ↓ move · ↻ restart", 90, 224, "#aabec5", 14);
}`;

const livesPong = pong
  .replace('let score = 0;', 'let score = 0;\nlet lives = 3;')
  .replace('score = 0;\n  state', 'score = 0;\n  lives = 3;\n  state')
  .replace(
    'if (ball.x + ball.w < 0) state = "lost";',
    `if (ball.x + ball.w < 0) {
    lives -= 1;
    if (lives <= 0) state = "lost";
    else { ball.x = 100; ball.y = 115; ball.vx = -120; ball.vy = 0; }
  }`
  )
  .replace('"Rally: " + score + " / 5"', '"Lives: " + lives + "  Rally: " + score');

const mazeObject = `const player = { x: 60, y: 110, w: 18, h: 18 };
const goal = { x: 300, y: 100, w: 24, h: 40 };
function start() {}
function update(dt) {}
function draw() {
  game.rect(goal.x, goal.y, goal.w, goal.h, "#efcd79");
  game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text("A player is a little bundle of facts", 18, 30, "#aabec5", 16);
}`;

const mazeMovement = `const player = { x: 40, y: 110, w: 18, h: 18 };
function start() { player.x = 40; player.y = 110; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (game.keys.left) player.x -= 80 * dt;
  if (game.keys.right) player.x += 80 * dt;
  if (game.keys.up) player.y -= 80 * dt;
  if (game.keys.down) player.y += 80 * dt;
  player.x = game.clamp(player.x, 0, game.width - player.w);
  player.y = game.clamp(player.y, 0, game.height - player.h);
}
function draw() {
  game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text("Move with the four arrows", 18, 30, "#aabec5", 16);
}`;

const mazeOneWall = `let state = "playing";
const player = { x: 40, y: 110, w: 18, h: 18 };
const wall = { x: 150, y: 70, w: 20, h: 120 };
const goal = { x: 300, y: 100, w: 24, h: 40 };
function start() { player.x = 40; player.y = 110; state = "playing"; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (state !== "playing") return;
  const oldX = player.x;
  const oldY = player.y;
  if (game.keys.left) player.x -= 80 * dt;
  if (game.keys.right) player.x += 80 * dt;
  if (game.keys.up) player.y -= 80 * dt;
  if (game.keys.down) player.y += 80 * dt;
  player.x = game.clamp(player.x, 0, game.width - player.w);
  player.y = game.clamp(player.y, 0, game.height - player.h);
  if (game.overlap(player, wall)) { player.x = oldX; player.y = oldY; }
  if (game.overlap(player, goal)) state = "won";
}
function draw() {
  game.rect(wall.x, wall.y, wall.w, wall.h, "#718995");
  game.rect(goal.x, goal.y, goal.w, goal.h, "#efcd79");
  game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text(state === "won" ? "You found the exit!" : "Find a way around the wall", 18, 28, "#aabec5", 16);
}`;

const maze = (needsKey = false) => `let state = "playing";
${needsKey ? 'let hasKey = false;\nconst key = { x: 60, y: 216, w: 14, h: 14 };\n' : ''}const player = { x: 40, y: 110, w: 18, h: 18 };
const walls = [
  { x: 150, y: 60, w: 20, h: 120 },
  { x: 240, y: 0, w: 20, h: 90 }
];
const goal = { x: 310, y: 200, w: 28, h: 28 };
function start() {
  player.x = 40; player.y = 110;
  state = "playing";
  ${needsKey ? 'hasKey = false;' : ''}
}
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (state !== "playing") return;
  const oldX = player.x;
  const oldY = player.y;
  if (game.keys.left) player.x -= 80 * dt;
  if (game.keys.right) player.x += 80 * dt;
  if (game.keys.up) player.y -= 80 * dt;
  if (game.keys.down) player.y += 80 * dt;
  player.x = game.clamp(player.x, 0, game.width - player.w);
  player.y = game.clamp(player.y, 0, game.height - player.h);
  for (const wall of walls) {
    if (game.overlap(player, wall)) { player.x = oldX; player.y = oldY; }
  }
  ${needsKey ? 'if (game.overlap(player, key)) hasKey = true;\n  ' : ''}if (${needsKey ? 'hasKey && ' : ''}game.overlap(player, goal)) state = "won";
}
function draw() {
  for (const wall of walls) game.rect(wall.x, wall.y, wall.w, wall.h, "#718995");
  game.rect(goal.x, goal.y, goal.w, goal.h, "#efcd79");
  ${needsKey ? 'if (!hasKey) game.rect(key.x, key.y, key.w, key.h, "#86c8f7");\n  ' : ''}game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text(state === "won" ? "You escaped!" : "${needsKey ? 'Blue key, then gold exit' : 'Find the gold exit'}", 18, 28, "#aabec5", 16);
  game.text("Arrows move · ↻ restart", 18, 50, "#aabec5", 12);
}`;

const mazeRoute = [
  frames(40, { up: true }),
  frames(66, { up: false, right: true }),
  frames(30, { right: false, down: true }),
];
const lowRoute = [frames(28, { down: true }), frames(70, { down: false, right: true })];

const fallingPlayer = `const player = { x: 40, y: 40, w: 20, h: 26, vy: 0 };
function start() { player.y = 40; player.vy = 0; }
function update(dt) {
  if (game.keys.space) { start(); return; }
  player.vy += 500 * dt;
  player.y += player.vy * dt;
}
function draw() {
  game.rect(0, 210, 360, 30, "#718995");
  game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text("Gravity pulls down a little every frame", 18, 28, "#aabec5", 15);
}`;

const jumpingPlayer = `const player = { x: 40, y: 184, w: 20, h: 26, vy: 0, onGround: true };
function start() { player.y = 184; player.vy = 0; player.onGround = true; }
function update(dt) {
  if (game.keys.space && player.onGround) { player.vy = -280; player.onGround = false; }
  player.vy += 500 * dt;
  player.y += player.vy * dt;
  if (player.y + player.h >= 210) {
    player.y = 210 - player.h; player.vy = 0; player.onGround = true;
  }
}
function draw() {
  game.rect(0, 210, 360, 30, "#718995");
  game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text("Jump with the Jump button or Space", 18, 28, "#aabec5", 15);
}`;

const landingPlayer = `const player = { x: 165, y: 40, w: 20, h: 26, vy: 0, onGround: false };
const platforms = [
  { x: 0, y: 210, w: 360, h: 30 },
  { x: 150, y: 145, w: 80, h: 12 }
];
function start() { player.x = 165; player.y = 40; player.vy = 0; player.onGround = false; }
function update(dt) {
  if (game.keys.left) player.x -= 100 * dt;
  if (game.keys.right) player.x += 100 * dt;
  player.x = game.clamp(player.x, 0, game.width - player.w);
  if (game.keys.space && player.onGround) { player.vy = -280; player.onGround = false; }
  const oldBottom = player.y + player.h;
  player.vy += 500 * dt;
  player.y += player.vy * dt;
  player.onGround = false;
  for (const platform of platforms) {
    if (player.vy >= 0 && oldBottom <= platform.y &&
        player.y + player.h >= platform.y &&
        player.x < platform.x + platform.w && player.x + player.w > platform.x) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }
}
function draw() {
  for (const platform of platforms) game.rect(platform.x, platform.y, platform.w, platform.h, "#718995");
  game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text("Land on a platform, then jump", 18, 28, "#aabec5", 16);
}`;

const solidPlatformer = `const player = { x: 40, y: 184, w: 20, h: 26, vy: 0, onGround: true };
const platforms = [
  { x: 0, y: 210, w: 360, h: 30 },
  { x: 150, y: 160, w: 70, h: 14 },
  { x: 260, y: 165, w: 20, h: 45 }
];
function start() { player.x = 40; player.y = 184; player.vy = 0; player.onGround = true; }
function update(dt) {
  const oldX = player.x;
  if (game.keys.left) player.x -= 100 * dt;
  if (game.keys.right) player.x += 100 * dt;
  player.x = game.clamp(player.x, 0, game.width - player.w);
  for (const platform of platforms) {
    if (game.overlap(player, platform)) player.x = oldX;
  }
  if (game.keys.space && player.onGround) { player.vy = -280; player.onGround = false; }
  const oldY = player.y;
  const oldBottom = player.y + player.h;
  player.vy += 500 * dt;
  player.y += player.vy * dt;
  player.onGround = false;
  for (const platform of platforms) {
    if (player.x < platform.x + platform.w && player.x + player.w > platform.x) {
      if (player.vy >= 0 && oldBottom <= platform.y && player.y + player.h >= platform.y) {
        player.y = platform.y - player.h; player.vy = 0; player.onGround = true;
      } else if (player.vy < 0 && oldY >= platform.y + platform.h && player.y < platform.y + platform.h) {
        player.y = platform.y + platform.h; player.vy = 0;
      }
    }
  }
}
function draw() {
  for (const platform of platforms) game.rect(platform.x, platform.y, platform.w, platform.h, "#718995");
  game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text("← → move · Jump over the wall", 18, 28, "#aabec5", 16);
}`;

const starPlatformer = (hazards = false, freshJump = false) => `let score = 0;
let state = "playing";
${freshJump ? 'let jumpHeld = false;\n' : ''}const player = { x: 40, y: 184, w: 20, h: 26, vy: 0, onGround: true };
const platforms = [
  { x: 0, y: 210, w: 360, h: 30 },
  { x: 150, y: 145, w: 70, h: 12 }
];
const stars = [
  { x: 100, y: 190, w: 12, h: 12, collected: false },
  { x: 200, y: 190, w: 12, h: 12, collected: false },
  { x: 320, y: 190, w: 12, h: 12, collected: false }
];
${hazards ? 'const lava = { x: 245, y: 200, w: 40, h: 10 };\n' : ''}function start() {
  player.x = 40; player.y = 184; player.vy = 0; player.onGround = true;
  score = 0; state = "playing";
  ${freshJump ? 'jumpHeld = false;\n  ' : ''}for (const star of stars) star.collected = false;
}
function update(dt) {
  if (game.keys.up) { start(); return; }
  if (state !== "playing") return;
  const oldX = player.x;
  if (game.keys.left) player.x -= 100 * dt;
  if (game.keys.right) player.x += 100 * dt;
  player.x = game.clamp(player.x, 0, game.width - player.w);
  for (const platform of platforms) {
    if (game.overlap(player, platform)) player.x = oldX;
  }
  if (game.keys.space && ${freshJump ? '!jumpHeld && ' : ''}player.onGround) { player.vy = -280; player.onGround = false; }
  ${freshJump ? 'jumpHeld = game.keys.space;\n  ' : ''}const oldY = player.y;
  const oldBottom = player.y + player.h;
  player.vy += 500 * dt;
  player.y += player.vy * dt;
  player.onGround = false;
  for (const platform of platforms) {
    if (player.x < platform.x + platform.w && player.x + player.w > platform.x) {
      if (player.vy >= 0 && oldBottom <= platform.y && player.y + player.h >= platform.y) {
        player.y = platform.y - player.h; player.vy = 0; player.onGround = true;
      } else if (player.vy < 0 && oldY >= platform.y + platform.h && player.y < platform.y + platform.h) {
        player.y = platform.y + platform.h; player.vy = 0;
      }
    }
  }
  ${hazards ? 'if (game.overlap(player, lava)) { state = "lost"; return; }\n  ' : ''}for (const star of stars) {
    if (!star.collected && game.overlap(player, star)) {
      star.collected = true;
      score += 1;
    }
  }
  if (score === stars.length) state = "won";
}
function draw() {
  for (const platform of platforms) game.rect(platform.x, platform.y, platform.w, platform.h, "#718995");
  for (const star of stars) if (!star.collected) game.rect(star.x, star.y, star.w, star.h, "#efcd79");
  ${hazards ? 'game.rect(lava.x, lava.y, lava.w, lava.h, "#ec8f82");\n  ' : ''}game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text("Stars: " + score + " / " + stars.length, 18, 28);
  if (state === "won") game.text("All stars! You win.", 90, 95, "#a8ef95", 20);
  if (state === "lost") game.text("Lava! Try a jump next time.", 55, 95, "#efcd79", 18);
  game.text("← → move · Space jump · ↻ or ↑ restart", 18, 55, "#aabec5", 12);
}`;

const platformReset = {
  keys: { up: true, right: false, left: false, space: false },
  frames: 1,
  dt: 0.05,
};

const crystalGame = (timed = false) => `let score = 0;
let state = "playing";
${timed ? 'let timeLeft = 12;\n' : ''}const player = { x: 30, y: 110, w: 18, h: 18 };
const enemy = { x: 160, y: 100, w: 24, h: 24, vx: 90 };
const crystals = [
  { x: 70, y: 110, w: 12, h: 12, collected: false },
  { x: 160, y: 30, w: 12, h: 12, collected: false },
  { x: 300, y: 190, w: 12, h: 12, collected: false }
];
function start() {
  score = 0; state = "playing";
  ${timed ? 'timeLeft = 12;\n  ' : ''}player.x = 30; player.y = 110;
  enemy.x = 160; enemy.vx = 90;
  for (const crystal of crystals) crystal.collected = false;
}
function movePlayer(dt) {
  if (game.keys.left) player.x -= 100 * dt;
  if (game.keys.right) player.x += 100 * dt;
  if (game.keys.up) player.y -= 100 * dt;
  if (game.keys.down) player.y += 100 * dt;
  player.x = game.clamp(player.x, 0, game.width - player.w);
  player.y = game.clamp(player.y, 0, game.height - player.h);
}
function moveEnemy(dt) {
  enemy.x += enemy.vx * dt;
  if (enemy.x > 300) { enemy.x = 300; enemy.vx = -Math.abs(enemy.vx); }
  if (enemy.x < 100) { enemy.x = 100; enemy.vx = Math.abs(enemy.vx); }
}
function update(dt) {
  if (game.keys.space) { start(); return; }
  if (state !== "playing") return;
  ${timed ? 'timeLeft = Math.max(0, timeLeft - dt);\n  if (timeLeft <= 0) { state = "lost"; return; }\n  ' : ''}movePlayer(dt);
  moveEnemy(dt);
  if (game.overlap(player, enemy)) { state = "lost"; return; }
  for (const crystal of crystals) {
    if (!crystal.collected && game.overlap(player, crystal)) {
      crystal.collected = true;
      score += 1;
    }
  }
  if (score === crystals.length) state = "won";
}
function draw() {
  for (const crystal of crystals) if (!crystal.collected) game.rect(crystal.x, crystal.y, crystal.w, crystal.h, "#86c8f7");
  game.rect(enemy.x, enemy.y, enemy.w, enemy.h, "#ec8f82");
  game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text("Crystals: " + score + " / 3"${timed ? ' + "   Time: " + Math.ceil(timeLeft)' : ''}, 18, 22, "#aabec5", 16);
  if (state === "won") game.text("You built a whole game!", 58, 78, "#a8ef95", 20);
  if (state === "lost") game.text("Try a new route. ↻ restarts.", 48, 78, "#efcd79", 18);
}`;

const crystalRoute = [
  frames(8, { right: true }),
  frames(16, { right: false, up: true }),
  frames(18, { up: false, right: true }),
  frames(28, { right: true }),
  frames(32, { right: false, down: true }),
];

const capstoneStarter = `// Your game starts here. Keep each part small.
let score = 0;
let state = "playing";
const player = { x: 30, y: 110, w: 18, h: 18 };
const enemy = { x: 160, y: 100, w: 24, h: 24, vx: 90 };
const crystals = [
  { x: 70, y: 110, w: 12, h: 12, collected: false },
  { x: 160, y: 30, w: 12, h: 12, collected: false },
  { x: 300, y: 190, w: 12, h: 12, collected: false }
];
function start() {
  // Reset the player, enemy, score, state, and crystals.
}
function update(dt) {
  // Restart, move, check danger, collect, then check for a win.
}
function draw() {
  game.text("My crystal adventure", 18, 28);
  // Draw the player, enemy, crystals, score, and result.
}`;

const capstoneChecks: Check[] = [
  {
    label: 'The player and danger are visible',
    expression:
      'game.draws.some(d => d.type === "rect" && d.x === player.x && d.y === player.y && d.w === player.w) && game.draws.some(d => d.type === "rect" && d.x === enemy.x && d.w === enemy.w)',
  },
  {
    label: 'Every available crystal is visible',
    expression:
      'crystals.every(c => game.draws.some(d => d.type === "rect" && d.x === c.x && d.y === c.y && d.w === c.w && d.h === c.h))',
  },
  {
    label: 'The danger moves by elapsed time',
    actions: [frames(10, {}, 0.02)],
    expression: 'Math.abs(enemy.x - 178) < 0.01 && enemy.vx === 90',
  },
  {
    label: 'The patrol turns left at its right limit',
    actions: [frames(40)],
    expression: 'enemy.vx < 0 && enemy.x >= 100 && enemy.x < 300',
  },
  {
    label: 'The patrol turns right at its left limit',
    actions: [frames(100)],
    expression: 'enemy.vx > 0 && enemy.x >= 100 && enemy.x < 250',
  },
  {
    label: 'Movement uses elapsed time',
    actions: [frames(4, { left: true }, 0.02)],
    expression: 'Math.abs(player.x - 22) < 0.01 && player.y === 110',
  },
  {
    label: 'The player stays inside the screen',
    actions: [frames(100, { left: true, down: true })],
    expression: 'player.x === 0 && player.y === game.height - player.h',
  },
  {
    label: 'One crystal scores once',
    actions: [frames(8, { right: true }), frames(8, { right: false })],
    expression: 'score === 1 && crystals[0].collected === true',
  },
  {
    label: 'Touching danger ends play',
    actions: [frames(45, { right: true })],
    expression: 'state === "lost"',
  },
  {
    label: 'A safe route wins with all three crystals',
    actions: crystalRoute,
    expression: 'score === 3 && state === "won" && crystals.every(c => c.collected)',
  },
  {
    label: 'Restart clears an entire finished game',
    actions: [...crystalRoute, reset],
    expression:
      'score === 0 && state === "playing" && player.x === 30 && player.y === 110 && enemy.x === 160 && enemy.vx === 90 && crystals.every(c => !c.collected)',
  },
  {
    label: 'A result freezes movement and scoring',
    actions: [...crystalRoute, frames(20, { left: true, down: false })],
    expression: 'state === "won" && score === 3 && player.x === 300',
  },
];

export const gameLessons: Lesson[] = [
  lesson({
    id: 'game-your-first-piece',
    unit: '1 · Make a clicker',
    title: 'Put one square on the screen',
    subtitle: 'A game starts with something you can see.',
    project: 'Clicker',
    controls: 'pointer',
    minutes: 3,
    concept: 'x tells a game piece how far across to go.',
    explanation:
      'The screen is 360 pixels wide and 240 pixels tall. Its top-left corner is x: 0, y: 0. Bigger x values move right. A pixel is a tiny screen step.',
    analogy: 'Think of a game screen as a sheet of squared paper.',
    example: 'game.rect(140, 100, 32, 32, "#a8ef95");',
    question: 'Which x value puts a square farther right?',
    choices: ['20', '140', '0'],
    correct: 1,
    answer: '140 is farther across from the left edge.',
    task: 'Change the tile’s x from 20 to 140. Run it and see the square move right.',
    solution: tileGame(),
    replace: ['x: 140', 'x: 20'],
    tests: [
      {
        label: 'The square is drawn at x 140, y 100',
        expression:
          'game.draws.some(d => d.type === "rect" && d.x === 140 && d.y === 100 && d.w === 32 && d.h === 32)',
      },
    ],
    hints: [
      'Look at the tile’s x value on the first line.',
      'Keep y, width, and height as they are. Only the distance across needs to change.',
    ],
    takeaway: 'You can place a game piece with two numbers.',
    keywords: ['coordinates', 'x', 'drawing'],
  }),
  lesson({
    id: 'game-up-and-down',
    unit: '1 · Make a clicker',
    title: 'Move the square up',
    subtitle: 'Change one number. See one change.',
    project: 'Clicker',
    controls: 'pointer',
    minutes: 3,
    concept: 'y tells a game piece how far down to go.',
    explanation:
      'On this screen, y grows downward. A smaller y moves a piece up. The object tile keeps its position and size together; draw reads those facts.',
    analogy: 'Count rows down from the top of a page.',
    example: 'const tile = { x: 140, y: 60, w: 32, h: 32 };',
    question: 'To move upward from y 100, choose…',
    choices: ['y 160', 'y 60', 'x 60'],
    correct: 1,
    answer: 'A smaller y is closer to the top.',
    task: 'Move the square up to y 60. Leave its x at 140.',
    solution: tileGame(140, 60),
    replace: ['y: 60', 'y: 100'],
    tests: [
      {
        label: 'The visible square moved up without moving sideways',
        expression:
          'game.draws.some(d => d.type === "rect" && d.x === 140 && d.y === 60 && d.w === 32)',
      },
    ],
    hints: [
      'The draw function already uses tile.y.',
      'Change the stored y value instead of rewriting draw.',
    ],
    takeaway: 'Screen coordinates start at the top-left.',
    keywords: ['coordinates', 'y', 'object'],
  }),
  lesson({
    id: 'game-one-tap-one-star',
    unit: '1 · Make a clicker',
    title: 'One tap. One star.',
    subtitle: 'Make your first game respond.',
    project: 'Clicker',
    controls: 'pointer',
    concept: 'An event is a small moment that your game can respond to.',
    explanation:
      'game.pointer.clicked is true for one frame after a tap. score stores the number of stars. Adding 1 remembers one more star, even after the tap ends.',
    analogy: 'A tap rings a doorbell once. Holding your finger there should not ring it forever.',
    example: 'if (game.pointer.clicked) { score += 1; }',
    question: 'A player taps once and holds their finger. How many stars should they get?',
    choices: ['One', 'One every frame', 'Zero'],
    correct: 0,
    answer: 'clicked is a single event. down describes a held finger.',
    task: 'Change score += 0 to score += 1. Tap the screen and watch your star count.',
    solution: simpleClicks,
    replace: ['score += 1;', 'score += 0;'],
    tests: [
      { label: 'One tap adds one star', actions: [tap(150, 110)], expression: 'score === 1' },
      {
        label: 'A held finger does not add extra stars',
        actions: [tap(150, 110), { pointer: { x: 150, y: 110, down: true }, frames: 20, dt: 0.05 }],
        expression: 'score === 1',
      },
      {
        label: 'Three separate taps add three stars',
        actions: [tap(150, 110), tap(150, 110), tap(150, 110)],
        expression: 'score === 3',
      },
    ],
    hints: [
      'The counter needs to increase inside the clicked condition.',
      '+= adds to the value already stored.',
    ],
    takeaway: 'State remembers what happened; events tell you when to change it.',
    keywords: ['event', 'state', 'score'],
  }),
  lesson({
    id: 'game-hit-the-button',
    unit: '1 · Make a clicker',
    title: 'Only the button counts',
    subtitle: 'A tap needs to land in the right place.',
    project: 'Clicker',
    controls: 'pointer',
    concept: 'A condition lets an action happen only when its rule is true.',
    explanation:
      'A button has four edges. A tap is inside when its x and y fall between those edges. && means all the rules must be true together.',
    analogy: 'A basketball earns points when it goes through the hoop.',
    example: 'game.pointer.x >= target.x && game.pointer.x < target.x + target.w',
    question: 'A tap lands beside the button. Should score change?',
    choices: ['Yes', 'No', 'Only on the second tap'],
    correct: 1,
    answer: 'The button should count only taps inside its rectangle.',
    task: 'Replace the simple clicked condition with the full button condition from “The small idea”. Include the y checks too.',
    solution: clicker(),
    replace: [`game.pointer.clicked && ${hitTarget}`, 'game.pointer.clicked'],
    snippets: [{ label: 'Inside the button', code: `game.pointer.clicked && ${hitTarget}` }],
    tests: [
      {
        label: 'Inside taps count',
        actions: [tap(130, 90), tap(230, 140)],
        expression: 'score === 2',
      },
      {
        label: 'Outside taps do not count',
        actions: [tap(30, 110), tap(150, 200), tap(240, 110), tap(150, 150)],
        expression: 'score === 0',
      },
      { label: 'The top-left edge counts', actions: [tap(120, 80)], expression: 'score === 1' },
    ],
    hints: [
      'Keep clicked, then add the four edge checks.',
      'The right and bottom edges use < so taps just outside cannot count.',
    ],
    takeaway: 'Game rules need to handle misses as well as hits.',
    keywords: ['condition', 'bounds', 'pointer'],
  }),
  lesson({
    id: 'game-clicker-restart',
    unit: '1 · Make a clicker',
    title: 'A fresh start',
    subtitle: 'Make the Restart button useful.',
    project: 'Clicker',
    controls: 'pointer',
    concept: 'start puts a game back into its starting state.',
    explanation:
      'start runs when a game opens. You can call it again to restart. In a pointer game, ↻ or Space sets game.keys.space. After restart, return ends this frame so it cannot also count an old tap.',
    analogy: 'Clear the scoreboard before the next round.',
    example: 'if (game.keys.space) { start(); return; }',
    question: 'You earned three stars, then restart. What should score be?',
    choices: ['Three', 'Zero', 'Six'],
    correct: 1,
    answer: 'A new round starts with zero stars.',
    task: 'Inside start, set score to 0 instead of keeping its old value.',
    solution: clicker(),
    replace: ['function start() { score = 0; }', 'function start() { score = score; }'],
    tests: [
      {
        label: 'Restart clears two earned stars',
        actions: [tap(150, 110), tap(150, 110), reset],
        expression: 'score === 0',
      },
      {
        label: 'A new round can earn stars again',
        actions: [tap(150, 110), reset, release, tap(150, 110)],
        expression: 'score === 1',
      },
    ],
    hints: [
      'The update function already calls start when you restart.',
      'A reset needs a known starting value, rather than the previous round’s value.',
    ],
    takeaway: 'A useful game can always begin another round.',
    keywords: ['restart', 'start', 'return'],
    challenge: {
      task: 'Remix: the smaller gold treasure gives two stars for each tap inside. Outside taps give nothing, and Restart clears the score.',
      starter: unfinished(twoPointClicker, 'score += 2;', 'score += 1;'),
      solution: twoPointClicker,
      tests: [
        {
          label: 'One inside tap earns two stars',
          actions: [tap(60, 90)],
          expression: 'score === 2',
        },
        {
          label: 'Two hits and a miss earn four',
          actions: [tap(40, 70), tap(119, 149), tap(120, 100)],
          expression: 'score === 4',
        },
        {
          label: 'Holding after a hit gives no extra stars',
          actions: [tap(60, 90), { pointer: { x: 60, y: 90, down: true }, frames: 20, dt: 0.05 }],
          expression: 'score === 2',
        },
        {
          label: 'Restart clears the treasure score',
          actions: [tap(60, 90), reset],
          expression: 'score === 0',
        },
      ],
      hints: [
        'Find the rule that changes the score for a successful tap.',
        'Try two hits and one miss yourself before checking.',
      ],
    },
  }),
  lesson({
    id: 'game-reuse-a-small-job',
    unit: '1 · Make a clicker',
    title: 'Name a small job',
    subtitle: 'Make code easier to read and reuse.',
    project: 'Clicker',
    controls: 'pointer',
    concept: 'A function can do one small job with a value you give it.',
    explanation:
      'award(points) receives an amount and adds it to score. update calls award(1) for a hit. The name tells you what the code does without making you reread its details.',
    analogy: '“Add a star” is a useful named job, just like “deal a card”.',
    example: 'function award(points) { score += points; }',
    question: 'What would award(2) do with this function?',
    choices: ['Add two stars', 'Always add one star', 'Reset score'],
    correct: 0,
    answer: 'points takes the value 2, so the function adds 2.',
    task: 'Finish award so it adds points to score. Leave the hit rule calling award(1).',
    solution: clicker(true),
    replace: ['score += points;', 'score += 0;'],
    tests: [
      { label: 'A hit uses the award job', actions: [tap(150, 110)], expression: 'score === 1' },
      {
        label: 'Repeated hits keep adding',
        actions: [tap(150, 110), tap(230, 140), tap(20, 20)],
        expression: 'score === 2',
      },
      {
        label: 'The job handles a different amount',
        expression: '(() => { award(3); return score === 3; })()',
      },
    ],
    hints: [
      'points is the value received by the function.',
      'Use that received value instead of a fixed number.',
    ],
    takeaway: 'Small named functions make larger games easier to change.',
    keywords: ['function', 'parameter', 'reuse'],
  }),
  lesson({
    id: 'game-a-moving-target',
    unit: '2 · Catch the stars',
    title: 'Give the next star a new home',
    subtitle: 'Make each hit change the game.',
    project: 'Target catcher',
    controls: 'pointer',
    concept: 'Random numbers can make each round a little different.',
    explanation:
      'game.random(low, high) chooses a number in that range. Pick target coordinates that leave room for the whole square. Keeping the top area clear leaves room for instructions.',
    analogy: 'A friend hides the next treasure somewhere new.',
    example: 'target.x = game.random(20, 300);\ntarget.y = game.random(60, 180);',
    question: 'Why stop target.x at 300 on a 360-pixel screen?',
    choices: ['To leave room for its width', 'To make it invisible', 'Because x cannot be larger'],
    correct: 0,
    answer: 'The target has width. Its left edge must leave space for the rest.',
    task: 'Finish moveTarget with the two random coordinates shown. Tap a star to move it.',
    solution: targetGame(3, false),
    replace: [
      'target.x = game.random(20, 300);\n  target.y = game.random(60, 180);',
      'target.x = 150;\n  target.y = 100;',
    ],
    tests: [
      {
        label: 'A hit relocates the star within the screen',
        actions: [tap(160, 110)],
        expression:
          'score === 1 && target.x >= 20 && target.x <= 300 && target.y >= 60 && target.y <= 180 && (target.x !== 150 || target.y !== 100)',
      },
      {
        label: 'A miss leaves the target alone',
        actions: [tap(5, 5)],
        expression: 'score === 0 && target.x === 150 && target.y === 100',
      },
    ],
    hints: [
      'The hit code already calls moveTarget.',
      'Change both stored coordinates inside that named job.',
    ],
    takeaway: 'Choose random positions inside useful bounds.',
    keywords: ['random', 'bounds', 'state'],
  }),
  lesson({
    id: 'game-a-real-win',
    unit: '2 · Catch the stars',
    title: 'You caught three!',
    subtitle: 'Give the game a finish line.',
    project: 'Target catcher',
    controls: 'pointer',
    concept: 'A game state tells you whether a round is playing, won, or lost.',
    explanation:
      'When score reaches three, state becomes "won". The draw function shows a win message. update ignores more hits until restart, so the result stays settled.',
    analogy: 'Once you finish a race, extra steps do not change your finishing result.',
    example: 'if (score >= 3) state = "won";',
    question: 'After winning, another tap should…',
    choices: [
      'Start a new score automatically',
      'Leave the finished result alone',
      'Erase the win',
    ],
    correct: 1,
    answer: 'A finished round waits for a deliberate restart.',
    task: 'Set state to "won" when score reaches three.',
    solution: targetGame(3, false),
    replace: ['if (score >= 3) state = "won";', 'if (score >= 3) state = "playing";'],
    tests: [
      {
        label: 'Two hits keep the round going',
        actions: threeHits.slice(0, 2),
        expression: 'score === 2 && state === "playing"',
      },
      { label: 'Three hits win', actions: threeHits, expression: 'score === 3 && state === "won"' },
      {
        label: 'A finished score cannot grow',
        actions: [...threeHits, tap(170, 130), tap(170, 130)],
        expression: 'score === 3 && state === "won"',
      },
    ],
    hints: [
      'Use the stored score in your finish-line condition.',
      'The existing early return already protects a finished round.',
    ],
    takeaway: 'Playing and finished are different game states.',
    keywords: ['state', 'win', 'condition'],
    challenge: {
      task: 'Remix: the top half of this treasure gives two stars; the bottom half gives one. Win at four or more, and stop scoring after a win.',
      starter: unfinished(
        bonusTarget,
        'score += game.pointer.y < target.y + target.h / 2 ? 2 : 1;',
        'score += 1;'
      ),
      solution: bonusTarget,
      tests: [
        {
          label: 'The top half gives two',
          actions: [tap(110, 110)],
          expression: 'score === 2 && state === "playing"',
        },
        { label: 'The bottom half gives one', actions: [tap(110, 130)], expression: 'score === 1' },
        {
          label: 'Three bottom hits have not won',
          actions: [tap(110, 130), tap(110, 130), tap(110, 130)],
          expression: 'score === 3 && state === "playing"',
        },
        {
          label: 'Two top hits win and stop scoring',
          actions: [tap(110, 110), tap(110, 110), tap(110, 130)],
          expression: 'score === 4 && state === "won"',
        },
        {
          label: 'Outside taps and idle frames give no score',
          actions: [tap(80, 130), frames(10)],
          expression: 'score === 0 && state === "playing"',
        },
        {
          label: 'Holding after a bottom hit does not repeat it',
          actions: [
            tap(110, 130),
            { pointer: { x: 110, y: 130, down: true }, frames: 20, dt: 0.05 },
          ],
          expression: 'score === 1 && state === "playing"',
        },
      ],
      hints: [
        'Use the pointer’s y position to choose an amount.',
        'The halfway y is the top y plus half the height. A small if/else is fine.',
      ],
    },
  }),
  lesson({
    id: 'game-time-runs-out',
    unit: '2 · Catch the stars',
    title: 'Add a gentle countdown',
    subtitle: 'Time is measured in seconds, not guesses.',
    project: 'Target catcher',
    controls: 'pointer',
    concept: 'dt is the number of seconds since the previous frame.',
    explanation:
      'update runs repeatedly. dt is usually a small fraction of a second. Subtract dt from timeLeft to make ten real seconds last about ten seconds on different devices. Math.max keeps the timer at zero.',
    analogy: 'Use a clock, rather than counting how often someone looks at it.',
    example: 'timeLeft = Math.max(0, timeLeft - dt);',
    question: 'Why subtract dt instead of 1 every frame?',
    choices: [
      'A frame is always one second',
      'dt measures the actual time that passed',
      'It makes time random',
    ],
    correct: 1,
    answer: 'Many frames happen in a second. dt adds up to elapsed seconds.',
    task: 'Subtract dt from timeLeft. Catch three stars before the ten seconds run out.',
    solution: targetGame(),
    replace: ['timeLeft = Math.max(0, timeLeft - dt);', 'timeLeft = Math.max(0, timeLeft - 0);'],
    tests: [
      {
        label: 'One simulated second uses one second',
        actions: [frames(20)],
        expression: 'Math.abs(timeLeft - 9) < 0.01 && state === "playing"',
      },
      {
        label: 'Smaller frames keep the same timing',
        actions: [frames(50, {}, 0.02)],
        expression: 'Math.abs(timeLeft - 9) < 0.01',
      },
      {
        label: 'Timeout loses without a negative timer',
        actions: [frames(220)],
        expression: 'timeLeft === 0 && state === "lost"',
      },
    ],
    hints: [
      'The max function already guards the lower limit.',
      'Use update’s dt value for the amount of time to subtract.',
    ],
    takeaway: 'Use elapsed seconds for movement and timers.',
    keywords: ['dt', 'time', 'loss'],
  }),
  lesson({
    id: 'game-target-whole-reset',
    unit: '2 · Catch the stars',
    title: 'Restart the whole round',
    subtitle: 'A complete target-catching game.',
    project: 'Target catcher',
    controls: 'pointer',
    concept: 'A reset must restore every fact that belongs to the round.',
    explanation:
      'A new round needs zero score, playing state, ten seconds, and the first target position. Missing one reset can make the next round behave strangely. Test both a win and a timeout.',
    analogy: 'Reset the scoreboard and the clock before a rematch.',
    example: 'score = 0;\nstate = "playing";\ntimeLeft = 10;',
    question: 'The score resets but the timer stays at zero. What happens next?',
    choices: [
      'A normal new round',
      'The next round immediately runs out of time',
      'The player gets more stars',
    ],
    correct: 1,
    answer: 'The timer must reset along with score and state.',
    task: 'In start, restore timeLeft to 10. Try a win, a timeout, and Restart.',
    solution: targetGame(),
    replace: ['timeLeft = 10;\n  target.x', 'timeLeft = timeLeft;\n  target.x'],
    tests: [
      {
        label: 'Restart after a timeout restores the full round',
        actions: [frames(220), reset],
        expression:
          'score === 0 && state === "playing" && timeLeft === 10 && target.x === 150 && target.y === 100',
      },
      {
        label: 'Restart after a win restores the full round',
        actions: [...threeHits, reset],
        expression: 'score === 0 && state === "playing" && timeLeft === 10 && target.x === 150',
      },
      {
        label: 'Another round can still win',
        actions: [frames(220), reset, release, ...threeHits],
        expression: 'score === 3 && state === "won" && timeLeft > 0',
      },
    ],
    hints: [
      'Look for the four starting facts in start.',
      'Reset each fact to its original value, even when the previous round ended differently.',
    ],
    takeaway: 'Test a second round, not just the first.',
    keywords: ['restart', 'testing', 'cleanup'],
    challenge: {
      task: 'Remix: make an eight-second timer that pauses while ↓ is held. Releasing ↓ resumes it. Restart restores eight seconds.',
      starter: unfinished(
        pauseTarget,
        'if (!paused) timeLeft = Math.max(0, timeLeft - dt);',
        'timeLeft = Math.max(0, timeLeft - dt);'
      ),
      solution: pauseTarget,
      tests: [
        {
          label: 'An unpaused second counts down',
          actions: [frames(20)],
          expression: 'Math.abs(timeLeft - 7) < 0.01',
        },
        {
          label: 'Holding pause preserves the time',
          actions: [frames(40, { down: true })],
          expression: 'timeLeft === 8 && paused',
        },
        {
          label: 'Release resumes from the paused value',
          actions: [frames(20), frames(40, { down: true }), frames(20, { down: false })],
          expression: 'Math.abs(timeLeft - 6) < 0.01',
        },
        {
          label: 'Restart restores eight seconds',
          actions: [frames(60), reset],
          expression: 'timeLeft === 8 && !paused',
        },
      ],
      hints: [
        'A paused frame should skip the time-changing job.',
        'Check both holding the key and releasing it.',
      ],
    },
  }),
  lesson({
    id: 'game-the-frame-loop',
    unit: '3 · Build Pong',
    title: 'Move a little. Draw again.',
    subtitle: 'Discover the heartbeat of a game.',
    project: 'Pong',
    concept: 'A game loop repeatedly updates facts and draws their new values.',
    explanation:
      'start prepares the round. update changes the game. draw shows it. The runner clears the screen before each new drawing so the ball does not leave a trail.',
    analogy: 'An animation is a stack of pictures with tiny changes between them.',
    example: 'ball.x += 1;',
    question: 'After ten updates that each add 1, the ball moves…',
    choices: ['One pixel', 'Ten pixels', 'One hundred pixels'],
    correct: 1,
    answer: 'Ten small changes add up to ten pixels.',
    task: 'In update, add 1 to ball.x each frame. Watch the ball travel.',
    solution: movingBall(false),
    replace: ['ball.x += 1;', 'ball.x += 0;'],
    tests: [
      { label: 'Ten frames move ten pixels', actions: [frames(10)], expression: 'ball.x === 190' },
      {
        label: 'Twenty frames move twenty pixels',
        actions: [frames(20)],
        expression: 'ball.x === 200',
      },
      {
        label: 'draw follows the changed ball',
        actions: [frames(10)],
        expression: 'game.draws.some(d => d.type === "rect" && d.x === ball.x && d.y === ball.y)',
      },
    ],
    hints: [
      'Change the ball’s stored x, rather than a draw-only number.',
      'The runner repeats update for you. You do not need to write a loop here.',
    ],
    takeaway: 'Update changes the world; draw shows the world.',
    keywords: ['game loop', 'update', 'draw'],
  }),
  lesson({
    id: 'game-speed-not-frames',
    unit: '3 · Build Pong',
    title: 'A fair speed on every screen',
    subtitle: 'Move by seconds, like the timer.',
    project: 'Pong',
    concept: 'Velocity is distance per second.',
    explanation:
      'ball.vx is 100 pixels per second to the right. Multiply it by dt to find how far the ball should move in this one frame. Faster screens produce more, smaller steps.',
    analogy: 'A car’s speed describes distance per hour, rather than distance per photograph.',
    example: 'ball.x += ball.vx * dt;',
    question: 'At 100 pixels per second, half a second moves…',
    choices: ['100 pixels', '50 pixels', 'Half a pixel'],
    correct: 1,
    answer: '100 × 0.5 is 50.',
    task: 'Replace the fixed one-pixel step with ball.vx * dt.',
    solution: movingBall(),
    replace: ['ball.x += ball.vx * dt;', 'ball.x += 1;'],
    tests: [
      {
        label: 'Twenty larger frames move 100 pixels',
        actions: [frames(20)],
        expression: 'Math.abs(ball.x - 280) < 0.01',
      },
      {
        label: 'Fifty smaller frames also move 100 pixels',
        actions: [frames(50, {}, 0.02)],
        expression: 'Math.abs(ball.x - 280) < 0.01',
      },
    ],
    hints: [
      'Use the same elapsed-time idea as the countdown.',
      'Speed times elapsed seconds gives distance.',
    ],
    takeaway: 'Time-based movement keeps a game consistent across devices.',
    keywords: ['velocity', 'dt', 'movement'],
  }),
  lesson({
    id: 'game-bounce-at-an-edge',
    unit: '3 · Build Pong',
    title: 'Bounce off the bottom',
    subtitle: 'A collision changes direction.',
    project: 'Pong',
    concept: 'Positive vertical speed goes down; negative vertical speed goes up.',
    explanation:
      'When the ball’s bottom passes the screen’s bottom, place it just inside the edge and make vy negative. At the top, make vy positive. Position correction prevents the ball getting stuck outside.',
    analogy: 'A bouncing ball reverses direction when it meets a wall.',
    example: 'ball.vy = -Math.abs(ball.vy);',
    question: 'The ball hit the bottom. Which speed sends it upward?',
    choices: ['80', '-80', '0'],
    correct: 1,
    answer: 'Negative vy moves toward the top of the screen.',
    task: 'Give the bottom bounce a negative vy. The top bounce already works.',
    solution: wallBall,
    replace: ['ball.vy = -Math.abs(ball.vy);', 'ball.vy = Math.abs(ball.vy);'],
    tests: [
      {
        label: 'The bottom bounce heads upward inside the screen',
        actions: [frames(40)],
        expression: 'ball.vy < 0 && ball.y >= 0 && ball.y + ball.h <= game.height',
      },
      {
        label: 'The ball can bounce off both edges',
        actions: [frames(100)],
        expression: 'ball.vy > 0 && ball.y >= 0 && ball.y + ball.h <= game.height',
      },
    ],
    hints: [
      'The top and bottom need opposite signs.',
      'Keep the existing position correction. Change the bottom direction.',
    ],
    takeaway: 'A collision usually needs both a position correction and a response.',
    keywords: ['collision', 'velocity', 'bounds'],
  }),
  lesson({
    id: 'game-control-the-paddle',
    unit: '3 · Build Pong',
    title: 'Keep your paddle on screen',
    subtitle: 'Move with arrows or the touch controls.',
    project: 'Pong',
    concept: 'clamp keeps a value between a minimum and a maximum.',
    explanation:
      'The keys describe what the player is holding now. ↑ subtracts from y and ↓ adds to it. The lowest safe paddle y is screen height minus paddle height.',
    analogy: 'A slider can move only between its two ends.',
    example: 'paddle.y = game.clamp(paddle.y, 0, game.height - paddle.h);',
    question: 'Why subtract paddle.h from the maximum y?',
    choices: [
      'So the whole paddle stays visible',
      'To make the paddle faster',
      'To change its color',
    ],
    correct: 0,
    answer: 'Its top edge must leave room for the paddle’s height.',
    task: 'Replace the unfinished clamp line with the full safe range.',
    solution: paddleGame,
    replace: [
      'paddle.y = game.clamp(paddle.y, 0, game.height - paddle.h);',
      'paddle.y = paddle.y;',
    ],
    tests: [
      {
        label: 'Down stops at the bottom',
        actions: [frames(60, { down: true })],
        expression: 'paddle.y === game.height - paddle.h',
      },
      {
        label: 'Up stops at the top',
        actions: [frames(60, { up: true })],
        expression: 'paddle.y === 0',
      },
      {
        label: 'Short movement still responds',
        actions: [frames(5, { up: true })],
        expression: 'paddle.y === 50',
      },
    ],
    hints: [
      'The minimum y is zero.',
      'The maximum is the last position where the entire paddle still fits.',
    ],
    takeaway: 'Controls should respond while respecting the play area.',
    keywords: ['input', 'keys', 'clamp'],
    challenge: {
      task: 'Remix: move this bottom paddle with ← and →, rather than ↑ and ↓. Keep all 80 pixels of its width inside the screen.',
      starter: horizontalPaddle
        .replace(
          'if (game.keys.left) paddle.x -= 140 * dt;',
          'if (game.keys.up) paddle.x -= 140 * dt;'
        )
        .replace(
          'if (game.keys.right) paddle.x += 140 * dt;',
          'if (game.keys.down) paddle.x += 140 * dt;'
        ),
      solution: horizontalPaddle,
      tests: [
        {
          label: 'Left reaches the left edge',
          actions: [frames(60, { left: true })],
          expression: 'paddle.x === 0',
        },
        {
          label: 'Right reaches the last safe x',
          actions: [frames(60, { right: true })],
          expression: 'paddle.x === game.width - paddle.w',
        },
        {
          label: 'Vertical keys do not slide this paddle',
          actions: [frames(10, { up: true })],
          expression: 'paddle.x === 140',
        },
        {
          label: 'A short right move uses time',
          actions: [frames(5, { right: true }, 0.02)],
          expression: 'Math.abs(paddle.x - 154) < 0.01',
        },
      ],
      hints: [
        'Choose the matching key for each horizontal direction.',
        'Keep the movement time-based and keep the existing bounds.',
      ],
    },
  }),
  lesson({
    id: 'game-return-the-ball',
    unit: '3 · Build Pong',
    title: 'Return the ball',
    subtitle: 'Two rectangles meet.',
    project: 'Pong',
    concept: 'overlap checks whether two rectangles occupy some of the same space.',
    explanation:
      'When a left-moving ball touches the paddle, move it to the paddle’s right edge and make its horizontal speed positive. Checking its incoming direction avoids repeated bounce events.',
    analogy: 'A bat changes a ball’s path only when they actually meet.',
    example:
      'if (ball.vx < 0 && game.overlap(ball, paddle)) {\n  ball.x = paddle.x + paddle.w;\n  ball.vx = Math.abs(ball.vx);\n}',
    question: 'After touching the left paddle, the ball should travel…',
    choices: ['Right', 'Left', 'Nowhere'],
    correct: 0,
    answer: 'Positive vx sends the ball away from the left paddle.',
    task: 'Make the paddle bounce set ball.vx to a positive value.',
    solution: bouncePaddle,
    replace: ['ball.vx = Math.abs(ball.vx);', 'ball.vx = -Math.abs(ball.vx);'],
    tests: [
      {
        label: 'A meeting sends the ball right',
        actions: [frames(20)],
        expression: 'ball.vx > 0 && ball.x >= paddle.x + paddle.w',
      },
      {
        label: 'Moving the paddle away allows a miss',
        actions: [frames(20, { up: true })],
        expression: 'ball.vx < 0 && ball.x < paddle.x',
      },
    ],
    hints: [
      'The paddle is on the left. Away from it means increasing x.',
      'The hit test and position correction are already there.',
    ],
    takeaway: 'Detect the meeting, then respond in the right direction.',
    keywords: ['overlap', 'collision', 'response'],
  }),
  lesson({
    id: 'game-pong-a-complete-round',
    unit: '3 · Build Pong',
    title: 'Your own Pong rally',
    subtitle: 'A playable game with a real result.',
    project: 'Pong',
    minutes: 5,
    concept: 'A complete round has rules for progress, winning, losing, and restarting.',
    explanation:
      'Return the ball five times to win. A miss on the left loses the round. Hitting different parts of the paddle changes the ball’s vertical speed. Restart restores the ball, paddle, score, and state.',
    analogy: 'A sports game needs a scoreboard, a finish line, and a way to play again.',
    example: 'if (ball.x + ball.w < 0) state = "lost";',
    question: 'What should happen when the ball passes the paddle and leaves the left edge?',
    choices: ['Keep playing invisibly', 'Finish the round as a loss', 'Award five points'],
    correct: 1,
    answer: 'A clear loss tells the player why the round ended.',
    task: 'Change the miss rule so it sets state to "lost". Play a rally, then try Restart.',
    solution: pong,
    replace: [
      'if (ball.x + ball.w < 0) state = "lost";',
      'if (ball.x + ball.w < 0) state = "playing";',
    ],
    tests: [
      {
        label: 'A return earns one rally point',
        actions: [frames(20)],
        expression: 'score === 1 && state === "playing"',
      },
      {
        label: 'A miss ends the round',
        actions: [frames(40, { up: true })],
        expression: 'state === "lost" && score === 0',
      },
      {
        label: 'Five centered returns win',
        actions: [frames(600)],
        expression: 'score === 5 && state === "won"',
      },
      {
        label: 'Restart restores a playable round',
        actions: [frames(40, { up: true }), reset],
        expression:
          'state === "playing" && score === 0 && ball.x === 100 && ball.y === 115 && paddle.y === 90',
      },
    ],
    hints: [
      'The ball’s right edge is x + w.',
      'Once even its right edge is left of zero, the whole ball is gone.',
    ],
    takeaway: 'Test successful play, mistakes, and a second round.',
    keywords: ['win', 'loss', 'restart', 'testing'],
    challenge: {
      task: 'Remix: give Pong three lives. Each miss removes one life and serves a new ball. Lose only when lives reach zero. Restart restores all three lives.',
      starter: unfinished(livesPong, 'lives -= 1;', 'lives -= 0;'),
      solution: livesPong,
      tests: [
        {
          label: 'The first miss costs one life and serves again',
          actions: [frames(20, { up: true })],
          expression: 'lives === 2 && state === "playing" && ball.x > 0',
        },
        {
          label: 'Three misses use all lives',
          actions: [frames(100, { up: true })],
          expression: 'lives === 0 && state === "lost"',
        },
        {
          label: 'A clean return preserves lives',
          actions: [frames(20)],
          expression: 'lives === 3 && score === 1',
        },
        {
          label: 'Restart brings back three lives',
          actions: [frames(100, { up: true }), reset],
          expression: 'lives === 3 && score === 0 && state === "playing"',
        },
      ],
      hints: [
        'The miss block is the only place that should spend a life.',
        'Check the new life count before deciding whether to serve another ball.',
      ],
    },
  }),
  lesson({
    id: 'game-a-player-object',
    unit: '4 · Escape a maze',
    title: 'Meet your maze explorer',
    subtitle: 'Keep one game piece’s facts together.',
    project: 'Maze',
    minutes: 3,
    concept: 'An object stores related facts under useful names.',
    explanation:
      'player.x and player.y describe position. player.w and player.h describe size. Collision code and drawing can use the same facts, so they agree on where the explorer really is.',
    analogy: 'A character card keeps a person’s name, height, and other facts in one place.',
    example: 'const player = { x: 60, y: 110, w: 18, h: 18 };',
    question: 'Which fact describes the explorer’s width?',
    choices: ['player.y', 'player.w', 'player.x'],
    correct: 1,
    answer: 'w is our short name for width.',
    task: 'Change player.x from 40 to 60. See the explorer move closer to the exit.',
    solution: mazeObject,
    replace: ['x: 60', 'x: 40'],
    tests: [
      {
        label: 'The explorer and exit use their own object facts',
        expression:
          'game.draws.some(d => d.type === "rect" && d.x === 60 && d.y === 110 && d.w === 18 && d.h === 18) && game.draws.some(d => d.type === "rect" && d.x === goal.x && d.w === goal.w)',
      },
    ],
    hints: [
      'Find the player object at the top.',
      'draw already reads its values, so change only the stored x.',
    ],
    takeaway: 'Keep the facts for each game piece together.',
    keywords: ['object', 'player', 'state'],
  }),
  lesson({
    id: 'game-four-directions',
    unit: '4 · Escape a maze',
    title: 'Go left, right, up, or down',
    subtitle: 'You control the explorer.',
    project: 'Maze',
    concept: 'Each direction changes one coordinate in the correct direction.',
    explanation:
      'Left decreases x. Right increases x. Up decreases y. Down increases y. Multiply by dt, then clamp both coordinates so the entire player stays on screen.',
    analogy: 'Four clear directions are enough to explore a small map.',
    example: 'if (game.keys.left) player.x -= 80 * dt;',
    question: 'Left should make x…',
    choices: ['Bigger', 'Smaller', 'Become y'],
    correct: 1,
    answer: 'Smaller x means closer to the left edge.',
    task: 'Fix the left-arrow line. It should subtract, not add.',
    solution: mazeMovement,
    replace: [
      'if (game.keys.left) player.x -= 80 * dt;',
      'if (game.keys.left) player.x += 80 * dt;',
    ],
    tests: [
      {
        label: 'Left travels left',
        actions: [frames(5, { left: true })],
        expression: 'player.x === 20 && player.y === 110',
      },
      {
        label: 'Right travels right',
        actions: [frames(5, { right: true })],
        expression: 'player.x === 60 && player.y === 110',
      },
      {
        label: 'Up and down use y',
        actions: [frames(5, { up: true }), frames(10, { up: false, down: true })],
        expression: 'player.x === 40 && player.y === 130',
      },
      {
        label: 'The top-left corner is safe',
        actions: [frames(80, { left: true, up: true })],
        expression: 'player.x === 0 && player.y === 0',
      },
    ],
    hints: [
      'Compare the left line with the right line.',
      'Opposite directions need opposite signs.',
    ],
    takeaway: 'Position changes should match the player’s intended direction.',
    keywords: ['input', 'coordinates', 'movement'],
  }),
  lesson({
    id: 'game-a-solid-wall',
    unit: '4 · Escape a maze',
    title: 'Make the wall solid',
    subtitle: 'A wall should stop you, not hide you.',
    project: 'Maze',
    concept: 'Remember the old position so you can reject an illegal move.',
    explanation:
      'Save oldX and oldY before moving. If the new player rectangle overlaps the wall, restore those old coordinates. Open space still allows movement. This simple approach makes a small maze easy to understand.',
    analogy: 'Try a step. If a locked door blocks it, stay where you were.',
    example: 'if (game.overlap(player, wall)) { player.x = oldX; player.y = oldY; }',
    question: 'After walking into a wall, use…',
    choices: ['The last safe position', 'The center of the wall', 'A random position'],
    correct: 0,
    answer: 'The last safe position was outside the wall.',
    task: 'Restore oldX and oldY in the wall collision block.',
    solution: mazeOneWall,
    replace: [
      'if (game.overlap(player, wall)) { player.x = oldX; player.y = oldY; }',
      'if (game.overlap(player, wall)) { player.x = player.x; player.y = player.y; }',
    ],
    tests: [
      {
        label: 'A straight approach stops before the wall',
        actions: [frames(40, { right: true })],
        expression: 'player.x + player.w <= wall.x && player.x > 40',
      },
      {
        label: 'Open space above the wall still works',
        actions: [frames(40, { up: true }), frames(50, { up: false, right: true })],
        expression: 'player.x > wall.x + wall.w && player.y === 0',
      },
    ],
    hints: [
      'oldX and oldY were recorded before this frame’s move.',
      'Use both old values when the wall blocks the move.',
    ],
    takeaway: 'Collision can mean refusing a move, rather than bouncing.',
    keywords: ['collision', 'old position', 'wall'],
  }),
  lesson({
    id: 'game-maze-the-exit',
    unit: '4 · Escape a maze',
    title: 'Find the gold exit',
    subtitle: 'Turn movement into a goal.',
    project: 'Maze',
    concept: 'The same overlap check can detect success.',
    explanation:
      'A wall overlap blocks movement. A goal overlap changes state to "won". After a win, the explorer stops moving until restart. The same tool has different meanings for different pieces.',
    analogy: 'A doorway can be a barrier or a destination, depending on the game rule.',
    example: 'if (game.overlap(player, goal)) state = "won";',
    question: 'Which meeting wins this maze?',
    choices: ['Player and wall', 'Player and gold exit', 'Wall and screen'],
    correct: 1,
    answer: 'The exit is the destination.',
    task: 'Make touching the gold goal set state to "won". Go above or below the wall.',
    solution: mazeOneWall,
    replace: [
      'if (game.overlap(player, goal)) state = "won";',
      'if (game.overlap(player, goal)) state = "playing";',
    ],
    tests: [
      { label: 'Starting the maze does not win', expression: 'state === "playing"' },
      {
        label: 'A route around the wall reaches a win',
        actions: mazeRoute,
        expression: 'state === "won" && game.overlap(player, goal)',
      },
      {
        label: 'The winning position is stable',
        actions: [...mazeRoute, frames(20, { left: true, down: false })],
        expression: 'state === "won" && player.x === 304',
      },
    ],
    hints: [
      'Use the goal object in the check.',
      'The existing state guard already stops updates after a win.',
    ],
    takeaway: 'Game pieces can share geometry while following different rules.',
    keywords: ['goal', 'overlap', 'win'],
  }),
  lesson({
    id: 'game-more-than-one-wall',
    unit: '4 · Escape a maze',
    title: 'Check every wall',
    subtitle: 'Use one rule for a whole list.',
    project: 'Maze',
    minutes: 5,
    concept: 'An array is a list; a for…of loop visits each item in it.',
    explanation:
      'walls holds two wall objects. The collision loop should try each wall. The draw loop also visits each wall. Adding another wall later should not require copying the whole collision rule.',
    analogy: 'Check every door on a list with the same key test.',
    example:
      'for (const wall of walls) {\n  if (game.overlap(player, wall)) { player.x = oldX; player.y = oldY; }\n}',
    question: 'A loop checks only walls[0]. What is wrong?',
    choices: [
      'The second wall can be walked through',
      'Both walls disappear',
      'The player cannot move at all',
    ],
    correct: 0,
    answer: 'Every wall needs the same collision rule.',
    task: 'Change the collision loop from [walls[0]] to walls so it checks the whole list.',
    solution: maze(),
    replace: ['for (const wall of walls) {', 'for (const wall of [walls[0]]) {'],
    tests: [
      {
        label: 'The first wall is solid',
        actions: [frames(40, { right: true })],
        expression: 'player.x + player.w <= walls[0].x',
      },
      {
        label: 'The second wall is also solid',
        actions: [frames(40, { up: true }), frames(55, { up: false, right: true })],
        expression: 'player.x + player.w <= walls[1].x && player.x > walls[0].x',
      },
      {
        label: 'A route below both walls can win',
        actions: lowRoute,
        expression: 'state === "won"',
      },
    ],
    hints: [
      'The array already contains all the walls.',
      'Loop over that array, rather than a new list containing just its first item.',
    ],
    takeaway: 'Lists and loops let one rule handle many game pieces.',
    keywords: ['array', 'loop', 'reuse'],
    challenge: {
      task: 'Remix: pick up the blue key before the gold exit can open. A route to the exit without the key must keep playing. Restart puts the key back.',
      starter: unfinished(
        maze(true),
        'if (hasKey && game.overlap(player, goal))',
        'if (game.overlap(player, goal))'
      ),
      solution: maze(true),
      tests: [
        {
          label: 'The exit stays locked without the key',
          actions: [frames(20, { down: true }), frames(70, { down: false, right: true })],
          expression: '!hasKey && state === "playing"',
        },
        {
          label: 'A route through the key can win',
          actions: lowRoute,
          expression: 'hasKey && state === "won"',
        },
        {
          label: 'Picking up the key alone does not win',
          actions: [frames(28, { down: true }), frames(5, { down: false, right: true })],
          expression: 'hasKey && state === "playing"',
        },
        {
          label: 'Restart replaces the key',
          actions: [...lowRoute, reset],
          expression: '!hasKey && state === "playing" && player.x === 40',
        },
      ],
      hints: [
        'A win now depends on two facts being true together.',
        'Check the route that skips the key as well as the route that takes it.',
      ],
    },
  }),
  lesson({
    id: 'game-maze-reset-your-key',
    unit: '4 · Escape a maze',
    title: 'Put the key back',
    subtitle: 'A complete maze you can play again.',
    project: 'Maze',
    concept: 'Collected items belong to the round and need a reset too.',
    explanation:
      'The key disappears when hasKey becomes true. If start forgets to set hasKey to false, the second round begins with an unlocked exit. Reset the explorer, result, and collected-item state together.',
    analogy: 'Hide the treasure again before inviting someone to replay a treasure hunt.',
    example: 'hasKey = false;',
    question: 'Which value makes the blue key available again?',
    choices: ['hasKey = true', 'hasKey = false', 'state = "won"'],
    correct: 1,
    answer: 'false means the player has not collected it in this new round.',
    task: 'Restore hasKey to false inside start. Escape, restart, then collect the key again.',
    solution: maze(true),
    replace: ['  hasKey = false;\n}', '  hasKey = hasKey;\n}'],
    tests: [
      {
        label: 'A finished maze restarts with its key',
        actions: [...lowRoute, reset],
        expression: 'state === "playing" && !hasKey && player.x === 40 && player.y === 110',
      },
      {
        label: 'The second round can collect and win again',
        actions: [...lowRoute, reset, release, ...lowRoute],
        expression: 'hasKey && state === "won"',
      },
      {
        label: 'Restart redraws the blue key',
        actions: [...lowRoute, reset],
        expression:
          'game.draws.some(d => d.type === "rect" && d.x === key.x && d.y === key.y && d.color === "#86c8f7")',
      },
    ],
    hints: [
      'The update function already handles collecting the key.',
      'The new round should begin without owning it.',
    ],
    takeaway: 'Reset collected items as carefully as positions and scores.',
    keywords: ['restart', 'cleanup', 'collected items'],
  }),
  lesson({
    id: 'game-gravity',
    unit: '5 · Make a platformer',
    title: 'Let gravity pull',
    subtitle: 'Speed can change over time too.',
    project: 'Platformer',
    controls: 'platformer',
    concept: 'Gravity gradually adds to downward velocity.',
    explanation:
      'First add gravity × dt to vy. Then move y by vy × dt. The falling player speeds up as time passes. We will make the floor solid in the next steps.',
    analogy: 'A falling ball starts slowly, then falls faster.',
    example: 'player.vy += 500 * dt;\nplayer.y += player.vy * dt;',
    question: 'If gravity keeps adding positive vy, the player falls…',
    choices: ['Faster over time', 'Slower over time', 'Sideways'],
    correct: 0,
    answer: 'Positive vy is downward speed, and gravity increases it.',
    task: 'Add 500 * dt to player.vy. Watch a short fall, then restart.',
    solution: fallingPlayer,
    replace: ['player.vy += 500 * dt;', 'player.vy += 0 * dt;'],
    tests: [
      {
        label: 'Half a second builds downward speed',
        actions: [frames(10)],
        expression: 'Math.abs(player.vy - 250) < 0.01 && player.y > 40',
      },
      {
        label: 'A short fall is slower than a long fall',
        actions: [frames(5, {}, 0.02)],
        expression: 'Math.abs(player.vy - 50) < 0.01 && player.y > 40 && player.y < 50',
      },
    ],
    hints: [
      'Velocity changes before position uses it.',
      'Multiply gravity by dt, just as you multiplied speed by dt.',
    ],
    takeaway: 'Acceleration changes velocity; velocity changes position.',
    keywords: ['gravity', 'velocity', 'dt'],
  }),
  lesson({
    id: 'game-your-first-jump',
    unit: '5 · Make a platformer',
    title: 'Jump from the floor',
    subtitle: 'One upward push, then gravity takes over.',
    project: 'Platformer',
    controls: 'platformer',
    concept: 'A jump gives an upward velocity only when jumping is allowed.',
    explanation:
      'Negative vy moves up. onGround says whether the player is standing on something. Set it false when jumping so another held frame cannot keep boosting the same jump.',
    analogy: 'Push off the floor once, then come back down.',
    example:
      'if (game.keys.space && player.onGround) {\n  player.vy = -280;\n  player.onGround = false;\n}',
    question: 'Why check onGround before jumping?',
    choices: [
      'To stop unlimited boosts in midair',
      'To change the floor color',
      'To make the player invisible',
    ],
    correct: 0,
    answer: 'The jump rule should apply only when the player is allowed to push off.',
    task: 'Set the jump velocity to -280. Tap Jump, or press Space.',
    solution: jumpingPlayer,
    replace: ['player.vy = -280;', 'player.vy = 0;'],
    tests: [
      {
        label: 'Jump leaves the floor heading upward',
        actions: [frames(1, { space: true })],
        expression: 'player.y < 184 && player.vy < 0 && !player.onGround',
      },
      {
        label: 'Holding cannot boost an airborne jump',
        actions: [frames(2, { space: true })],
        expression: 'Math.abs(player.vy - (-230)) < 0.01',
      },
      {
        label: 'Releasing allows a safe landing',
        actions: [frames(1, { space: true }), frames(30, { space: false })],
        expression: 'player.y === 184 && player.vy === 0 && player.onGround',
      },
    ],
    hints: [
      'The screen’s upward direction uses a negative speed.',
      'Gravity already brings the jump back down.',
    ],
    takeaway: 'A jump changes speed; gravity makes the rest of the arc.',
    keywords: ['jump', 'onGround', 'state'],
  }),
  lesson({
    id: 'game-land-on-a-platform',
    unit: '5 · Make a platformer',
    title: 'Land on top',
    subtitle: 'The player’s feet belong on the surface.',
    project: 'Platformer',
    controls: 'platformer',
    concept: 'Landing means the player’s bottom crossed a surface while falling.',
    explanation:
      'Compare the old bottom with the new bottom. If a downward step crosses a platform top, put the player’s feet exactly there, set vy to zero, and allow jumping again. Passing under a platform should not count as landing.',
    analogy: 'Stand with your shoes on a shelf, rather than placing your whole body inside it.',
    example: 'player.y = platform.y - player.h;',
    question: 'A platform top is y 145 and the player is 26 tall. The standing player’s y is…',
    choices: ['145', '119', '171'],
    correct: 1,
    answer: '145 − 26 = 119, so the feet are at 145.',
    task: 'Fix the landing position so the player stands on top of each platform.',
    solution: landingPlayer,
    replace: ['player.y = platform.y - player.h;', 'player.y = platform.y;'],
    tests: [
      {
        label: 'The player lands on the raised platform',
        actions: [frames(30)],
        expression: 'player.y === 119 && player.vy === 0 && player.onGround',
      },
      {
        label: 'Leaving the ledge allows a lower floor landing',
        actions: [frames(50, { right: true })],
        expression: 'player.y === 184 && player.onGround && player.x > 230',
      },
    ],
    hints: [
      'y describes the player’s top, not their feet.',
      'Subtract the player’s height from the surface’s top.',
    ],
    takeaway: 'Use the previous and current position to detect a crossed surface.',
    keywords: ['landing', 'collision', 'old position'],
  }),
  lesson({
    id: 'game-platform-sides',
    unit: '5 · Make a platformer',
    title: 'Respect the sides too',
    subtitle: 'Walk into a wall. Jump over it.',
    project: 'Platformer',
    controls: 'platformer',
    minutes: 5,
    concept: 'Handle horizontal and vertical movement as separate steps.',
    explanation:
      'Move sideways first and reject a blocked side step. Then apply the jump, gravity, and vertical collisions. This lets the player stand on a surface without also being pushed away from its side.',
    analogy: 'First check the doorway across from you; then check what is under your feet.',
    example: 'if (game.overlap(player, platform)) player.x = oldX;',
    question: 'If a sideways move hits a solid wall, which value needs restoring?',
    choices: ['oldX', 'score', 'The wall color'],
    correct: 0,
    answer: 'Restore the horizontal position, then let vertical physics continue.',
    task: 'Restore oldX for a blocked horizontal move. Try walking into the tall wall, then jumping over it.',
    solution: solidPlatformer,
    replace: [
      'if (game.overlap(player, platform)) player.x = oldX;',
      'if (game.overlap(player, platform)) player.x = player.x;',
    ],
    tests: [
      {
        label: 'Walking cannot pass through the tall wall',
        actions: [frames(60, { right: true })],
        expression: 'player.x + player.w <= 260 && player.x > 220',
      },
      {
        label: 'A jump can cross the wall',
        actions: [
          frames(37, { right: true }),
          frames(20, { right: true, space: true }),
          frames(10, { right: true, space: false }),
        ],
        expression: 'player.x > 280 && player.onGround && player.y === 184',
      },
    ],
    hints: [
      'oldX is the last safe sideways position.',
      'Only undo x in the horizontal phase; the vertical phase has its own rules.',
    ],
    takeaway: 'Separating movement axes makes solid collisions easier to reason about.',
    keywords: ['collision', 'axis', 'platform'],
  }),
  lesson({
    id: 'game-stars-count-once',
    unit: '5 · Make a platformer',
    title: 'A star counts once',
    subtitle: 'Keep collected items from scoring again.',
    project: 'Platformer',
    controls: 'platformer',
    concept: 'Each collectible needs to remember whether it has been collected.',
    explanation:
      'The stars array holds a collected flag for each star. A pickup marks the flag true and adds one point. The next frame skips it. draw also skips it, so the visible game agrees with the score.',
    analogy: 'Once a coin is in your pocket, it is no longer lying on the ground.',
    example: 'star.collected = true;\nscore += 1;',
    question:
      'A player stands where a star was for ten frames. How many points should that star give?',
    choices: ['Ten', 'One', 'Zero'],
    correct: 1,
    answer: 'A collectible can be taken once per round.',
    task: 'Set a picked-up star’s collected flag to true. Walk through the three stars to win.',
    solution: starPlatformer(),
    replace: ['star.collected = true;', 'star.collected = false;'],
    tests: [
      {
        label: 'The first star gives exactly one point',
        actions: [frames(11, { right: true }), frames(10, { right: false })],
        expression: 'score === 1 && stars[0].collected && state === "playing"',
      },
      {
        label: 'Three different stars win',
        actions: [frames(56, { right: true })],
        expression: 'score === 3 && state === "won" && stars.every(s => s.collected)',
      },
      {
        label: 'Collected stars are no longer drawn',
        actions: [frames(11, { right: true })],
        expression:
          '!game.draws.some(d => d.type === "rect" && d.x === stars[0].x && d.y === stars[0].y && d.color === "#efcd79")',
      },
    ],
    hints: [
      'The pickup rule already checks !star.collected.',
      'Change the flag so the same star fails that check next frame.',
    ],
    takeaway: 'State prevents one event from being counted repeatedly.',
    keywords: ['array', 'collectible', 'state'],
  }),
  lesson({
    id: 'game-platformer-a-real-risk',
    unit: '5 · Make a platformer',
    title: 'Jump over danger',
    subtitle: 'A complete platformer with a second chance.',
    project: 'Platformer',
    controls: 'platformer',
    minutes: 5,
    concept: 'A hazard ends the round; restart gives a fresh attempt.',
    explanation:
      'The red strip is lava. Touching it loses. A well-timed jump clears it and lets you reach the last star. ↑ or ↻ restarts this platformer; Space is reserved for jumping. start restores every star and the player’s physics.',
    analogy: 'An obstacle makes choosing when to jump matter.',
    example: 'if (game.overlap(player, lava)) { state = "lost"; return; }',
    question: 'Why return immediately after touching lava?',
    choices: [
      'So a lost frame cannot also award a win',
      'So gravity gets stronger',
      'So restart disappears',
    ],
    correct: 0,
    answer: 'The danger result should settle before collecting or checking a win.',
    task: 'Change the lava rule to set state to "lost". Then collect two stars, jump the lava, and get the third.',
    solution: starPlatformer(true),
    replace: [
      'if (game.overlap(player, lava)) { state = "lost"; return; }',
      'if (game.overlap(player, lava)) { state = "playing"; return; }',
    ],
    tests: [
      {
        label: 'Walking into lava loses',
        actions: [frames(50, { right: true })],
        expression: 'state === "lost" && score === 2',
      },
      {
        label: 'A well-timed jump can win',
        actions: [frames(37, { right: true }), frames(25, { right: true, space: true })],
        expression: 'state === "won" && score === 3',
      },
      {
        label: 'Restart restores stars and jump physics',
        actions: [frames(50, { right: true }), platformReset],
        expression:
          'state === "playing" && score === 0 && player.x === 40 && player.y === 184 && player.vy === 0 && player.onGround && stars.every(s => !s.collected)',
      },
    ],
    hints: [
      'A collision with danger needs a finished state.',
      'Keep the return: it prevents the rest of this frame from changing that result.',
    ],
    takeaway: 'A good failure rule explains the mistake and allows another attempt.',
    keywords: ['hazard', 'loss', 'restart'],
    challenge: {
      task: 'Remix: Jump should happen only on a fresh press. Holding Jump through a landing must not launch another jump. Release and press again to jump again.',
      starter: unfinished(
        starPlatformer(false, true),
        'game.keys.space && !jumpHeld && player.onGround',
        'game.keys.space && player.onGround'
      ),
      solution: starPlatformer(false, true),
      tests: [
        {
          label: 'A fresh press still jumps',
          actions: [frames(1, { space: true })],
          expression: 'player.vy < 0 && !player.onGround',
        },
        {
          label: 'Holding through landing does not jump again',
          actions: [frames(30, { space: true })],
          expression: 'player.onGround && player.y === 184 && player.vy === 0',
        },
        {
          label: 'Release and another press allows another jump',
          actions: [
            frames(30, { space: true }),
            frames(1, { space: false }),
            frames(1, { space: true }),
          ],
          expression: 'player.vy < 0 && !player.onGround',
        },
        {
          label: 'Restart clears the remembered button',
          actions: [frames(10, { space: true }), platformReset],
          expression: '!jumpHeld && player.onGround',
        },
      ],
      hints: [
        'Compare the key’s current value with the previous frame’s value.',
        'The jump rule needs the moment the key becomes held, as well as a safe place to jump from.',
      ],
    },
  }),
  lesson({
    id: 'game-debug-the-patrol',
    unit: '6 · Build it yourself',
    title: 'Find the wrong comparison',
    subtitle: 'Reproduce a bug. Change one cause. Retest.',
    project: 'Crystal adventure',
    minutes: 5,
    concept: 'Debugging means using what you observe to find and test a cause.',
    explanation:
      'The danger should patrol between x 100 and x 300. It currently turns around far too early. Run it, watch the behavior, compare each edge rule with its meaning, change the mistaken bound, then check a short and a long run.',
    analogy:
      'If a train reverses before the station, inspect the rule that tells it the station was reached.',
    example: 'if (enemy.x < 100) { enemy.x = 100; enemy.vx = Math.abs(enemy.vx); }',
    question: 'Which observation is most useful when debugging?',
    choices: [
      '“It is broken”',
      '“It turns around before reaching the left limit”',
      '“The code is long”',
    ],
    correct: 1,
    answer: 'A specific, repeatable observation points to a specific rule.',
    task: 'Fix the left-edge comparison in moveEnemy. It should turn right only below x 100, not below x 300.',
    solution: crystalGame(),
    replace: ['if (enemy.x < 100)', 'if (enemy.x < 300)'],
    tests: [
      {
        label: 'A short patrol moves right without an early reset',
        actions: [frames(10)],
        expression: 'enemy.vx > 0 && enemy.x > 190 && enemy.x < 220',
      },
      {
        label: 'The right edge turns the patrol left',
        actions: [frames(40)],
        expression: 'enemy.vx < 0 && enemy.x >= 100 && enemy.x < 300',
      },
      {
        label: 'A longer patrol reaches the left side and returns',
        actions: [frames(100)],
        expression: 'enemy.vx > 0 && enemy.x >= 100 && enemy.x < 250',
      },
    ],
    hints: [
      'Read each bound as a sentence: “if the enemy is left of…”',
      'The patrol’s two limits are 100 and 300. Each edge rule needs its own limit.',
    ],
    takeaway: 'Observe, reproduce, change a cause, and test more than one case.',
    keywords: ['debugging', 'boundaries', 'testing'],
  }),
  lesson({
    id: 'game-my-first-original-game',
    unit: '6 · Build it yourself',
    title: 'Build your crystal adventure',
    subtitle: 'Combine the small ideas into your own whole game.',
    project: 'Crystal adventure',
    minutes: 20,
    concept: 'You can build a game by joining small, named jobs.',
    explanation:
      'This time you start with objects and empty functions. Move the green explorer at 100 pixels per second with four arrows. Keep it inside the screen. The red danger patrols x 100 to 300 at 90 pixels per second. Collect the three blue crystals once each to win. Touching danger loses. Freeze a finished round and let ↻ or Space reset all its state. Draw the pieces and score so the player can understand what is happening. Build one job, run it, then add the next. Pausing halfway is fine.',
    analogy: 'Build a model from familiar small pieces, checking each connection as you go.',
    example: 'function update(dt) {\n  // input → movement → collisions → score → result\n}',
    question: 'What is a useful way to start a whole game?',
    choices: [
      'Write everything before running once',
      'Draw one piece, then add one working job at a time',
      'Guess until all checks turn green',
    ],
    correct: 1,
    answer: 'Small working steps make mistakes easier to understand.',
    task: 'Build from the skeleton. First draw the explorer and danger. Then add movement and bounds, the patrol, one-time pickups, win/loss, and a complete restart. Check the named behaviors as you build.',
    solution: crystalGame(),
    starter: capstoneStarter,
    tests: capstoneChecks,
    hints: [
      'Reuse ideas from earlier lessons: speed × dt, clamp, overlap, collected flags, and a playing-state guard.',
      'Keep movePlayer, moveEnemy, and reset as separate small jobs if that helps. Names are your choice.',
      'Test a miss, a safe route, and Restart. A game that works once still needs to work the second time.',
    ],
    takeaway:
      'You can independently combine input, time, collisions, score, results, and reset into a playable game.',
    keywords: ['independent build', 'game loop', 'collision', 'state', 'debugging'],
    snippets: [
      {
        label: 'Draw one piece',
        code: 'game.rect(player.x, player.y, player.w, player.h, "#a8ef95");',
      },
      { label: 'Draw a status', code: 'game.text("Crystals: " + score + " / 3", 18, 22);' },
      {
        label: 'Name a movement job',
        code: 'function movePlayer(dt) {\n  // Handle arrows, then bounds.\n}',
      },
      {
        label: 'Visit collectibles',
        code: 'for (const crystal of crystals) {\n  // Check and remember a pickup.\n}',
      },
    ],
    challenge: {
      task: 'Independent final remix: build the same crystal adventure with a 12-second time limit. Win by collecting all three safely before time runs out. Timeout or danger loses. Restart must restore time as well as every game object. Start with this empty skeleton and write the rules yourself.',
      starter: capstoneStarter.replace(
        'let state = "playing";',
        'let state = "playing";\nlet timeLeft = 12;'
      ),
      solution: crystalGame(true),
      tests: [
        ...capstoneChecks,
        {
          label: 'One second leaves eleven seconds',
          actions: [frames(20)],
          expression: 'Math.abs(timeLeft - 11) < 0.01 && state === "playing"',
        },
        {
          label: 'Timeout loses at zero',
          actions: [frames(260)],
          expression: 'state === "lost" && timeLeft === 0',
        },
        {
          label: 'Restart after timeout restores everything',
          actions: [frames(260), reset],
          expression:
            'timeLeft === 12 && score === 0 && state === "playing" && player.x === 30 && enemy.x === 160 && crystals.every(c => !c.collected)',
        },
        {
          label: 'Restart after winning restores the clock too',
          actions: [...crystalRoute, reset],
          expression: 'timeLeft === 12 && score === 0 && state === "playing"',
        },
      ],
      hints: [
        'A timer is another round fact. Update it only while playing, and restore it on restart.',
        'Keep the danger loss and timeout loss clear before checking for a win.',
        'Use the previous projects as references, then explain the jobs in your own words.',
      ],
    },
  }),
];
