import type { GameTestCase } from '../lib/gameRuntime';

export type BuildChallenge = {
  id: string;
  title: string;
  subtitle: string;
  brief: string;
  plan: string[];
  starter: string;
  /** Used only by automated QA. Never expose this in the independent-build UI. */
  solution: string;
  tests: GameTestCase[];
  controls: 'pointer' | 'arrows' | 'platformer';
  conceptHints: string[];
  projectTitle: string;
};

const frames = (count: number, keys: Record<string, boolean> = {}, dt = 0.05) => ({
  keys,
  frames: count,
  dt,
});
const restart = { keys: { space: true }, frames: 1, dt: 0.05 };

const dodgeObjects = `let score = 0;
let timeLeft = 12;
let state = "playing";
const player = { x: 168, y: 196, w: 24, h: 24 };
const meteor = { x: 168, y: 20, w: 22, h: 22, vy: 100 };`;

const dodgeStarter = `${dodgeObjects}

function start() {
  // Prepare every fact for a new round.
}

function update(dt) {
  // Read controls, move, check danger, count dodges, and check time.
}

function draw() {
  // Show the explorer, meteor, score, time, and result.
}`;

const dodgeSolution = `${dodgeObjects}

function start() {
  score = 0;
  timeLeft = 12;
  state = "playing";
  player.x = 168;
  player.y = 196;
  meteor.x = 168;
  meteor.y = 20;
  meteor.vy = 100;
}

function update(dt) {
  if (game.keys.space) { start(); return; }
  if (state !== "playing") return;
  if (game.keys.left) player.x -= 180 * dt;
  if (game.keys.right) player.x += 180 * dt;
  player.x = game.clamp(player.x, 0, game.width - player.w);
  meteor.y += meteor.vy * dt;
  timeLeft = Math.max(0, timeLeft - dt);
  if (game.overlap(player, meteor)) { state = "lost"; return; }
  if (meteor.y > game.height) {
    score += 1;
    meteor.x = game.random(0, game.width - meteor.w);
    meteor.y = -meteor.h;
  }
  if (timeLeft <= 0) state = "won";
}

function draw() {
  game.rect(0, 224, game.width, 16, "#718995");
  game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.rect(meteor.x, meteor.y, meteor.w, meteor.h, "#ec8f82");
  game.text("Dodged: " + score, 18, 18, "#efcd79", 17);
  game.text("Time: " + Math.ceil(timeLeft), 230, 18, "#aabec5", 17);
  if (state === "won") game.text("You survived!", 100, 105, "#a8ef95", 23);
  if (state === "lost") game.text("Meteor! Try another route.", 50, 105, "#efcd79", 18);
  game.text("← → move · ↻ or Space restart", 18, 52, "#aabec5", 14);
}`;

const dodgeResetCheck =
  'score === 0 && timeLeft === 12 && state === "playing" && player.x === 168 && player.y === 196 && meteor.x === 168 && meteor.y === 20 && meteor.vy === 100';

const dodgeTests: GameTestCase[] = [
  {
    label: 'The explorer and meteor are visible',
    expression:
      'game.draws.some(d => d.type === "rect" && d.x === player.x && d.y === player.y && d.w === player.w && d.h === player.h) && game.draws.some(d => d.type === "rect" && d.x === meteor.x && d.y === meteor.y && d.w === meteor.w && d.h === meteor.h)',
  },
  {
    label: 'The game shows score and remaining seconds',
    actions: [frames(60, { left: true })],
    expression:
      'game.draws.some(d => d.type === "text" && d.message.includes(String(score))) && game.draws.some(d => d.type === "text" && d.message.includes(String(Math.ceil(timeLeft))))',
  },
  {
    label: 'A short right move uses elapsed seconds',
    actions: [frames(10, { right: true }, 0.02)],
    expression: 'Math.abs(player.x - 204) < 0.01 && player.y === 196',
  },
  {
    label: 'A win gives a visible message beyond the score and timer',
    expression:
      '(() => { const playing = game.draws.filter(d => d.type === "text").map(d => d.message); state = "won"; game.clear(); draw(); return game.draws.some(d => d.type === "text" && d.message.trim() && !playing.includes(d.message)); })()',
  },
  {
    label: 'A loss gives a different visible message',
    expression:
      '(() => { const playing = game.draws.filter(d => d.type === "text").map(d => d.message); state = "won"; game.clear(); draw(); const won = game.draws.filter(d => d.type === "text").map(d => d.message); state = "lost"; game.clear(); draw(); return game.draws.some(d => d.type === "text" && d.message.trim() && !playing.includes(d.message) && !won.includes(d.message)); })()',
  },
  {
    label: 'Left stops at the screen edge',
    actions: [frames(60, { left: true })],
    expression: 'player.x === 0 && player.y === 196',
  },
  {
    label: 'Right keeps the entire explorer visible',
    actions: [frames(60, { right: true })],
    expression: 'player.x === game.width - player.w && player.y === 196',
  },
  {
    label: 'Vertical controls do not move this floor-based explorer',
    actions: [frames(5, { up: true, down: true })],
    expression: 'player.x === 168 && player.y === 196',
  },
  {
    label: 'The countdown uses seconds on smaller frames',
    actions: [frames(50, {}, 0.02)],
    expression: 'Math.abs(timeLeft - 11) < 0.01 && state === "playing"',
  },
  {
    label: 'The meteor falls at 100 pixels per second',
    actions: [frames(20, {}, 0.02)],
    expression: 'Math.abs(meteor.y - 60) < 0.01 && score === 0',
  },
  {
    label: 'One safely passed meteor scores once and starts another',
    actions: [frames(60, { left: true })],
    expression:
      'score === 1 && state === "playing" && meteor.x >= 0 && meteor.x + meteor.w <= game.width && meteor.y > -meteor.h && meteor.y < 150',
  },
  {
    label: 'Touching the meteor loses the round',
    actions: [frames(40)],
    expression: 'state === "lost" && score === 0',
  },
  {
    label: 'A loss freezes movement, scoring, and time',
    actions: [frames(40)],
    expression:
      '(() => { const before = { x: player.x, y: meteor.y, time: timeLeft, score }; game.keys.right = true; update(0.05); return state === "lost" && player.x === before.x && meteor.y === before.y && timeLeft === before.time && score === before.score; })()',
  },
  {
    label: 'Surviving all twelve seconds wins',
    actions: [frames(260, { left: true })],
    expression: 'state === "won" && timeLeft === 0 && score >= 3',
  },
  {
    label: 'A win freezes movement, scoring, and time',
    actions: [frames(260, { left: true })],
    expression:
      '(() => { const before = { x: player.x, y: meteor.y, time: timeLeft, score }; game.keys.left = false; game.keys.right = true; update(0.05); return state === "won" && player.x === before.x && meteor.y === before.y && timeLeft === before.time && score === before.score; })()',
  },
  {
    label: 'Restart restores every fact after a loss',
    actions: [frames(40), restart],
    expression: dodgeResetCheck,
  },
  {
    label: 'Restart restores every fact after a win',
    actions: [frames(260, { left: true }), restart],
    expression: dodgeResetCheck,
  },
  {
    label: 'The new round responds normally after restarting',
    actions: [frames(40), restart, frames(10, { space: false, left: true })],
    expression:
      'state === "playing" && score === 0 && Math.abs(player.x - 78) < 0.01 && Math.abs(timeLeft - 11.5) < 0.01 && Math.abs(meteor.y - 70) < 0.01',
  },
];

const brickObjects = `let score = 0;
let state = "playing";
const paddle = { x: 140, y: 210, w: 80, h: 12 };
const ball = { x: 175, y: 175, w: 10, h: 10, vx: 85, vy: -140 };
const bricks = [
  { x: 72, y: 50, w: 56, h: 16, broken: false },
  { x: 152, y: 50, w: 56, h: 16, broken: false },
  { x: 232, y: 50, w: 56, h: 16, broken: false }
];`;

const brickStarter = `${brickObjects}

function start() {
  // Restore the paddle, ball, bricks, score, and state.
}

function update(dt) {
  // Move, bounce, break bricks, decide a result, and allow restart.
}

function draw() {
  // Show the paddle, ball, remaining bricks, score, and result.
}`;

const brickSolution = `${brickObjects}

function start() {
  score = 0;
  state = "playing";
  paddle.x = 140;
  ball.x = 175;
  ball.y = 175;
  ball.vx = 85;
  ball.vy = -140;
  for (const brick of bricks) brick.broken = false;
}

function update(dt) {
  if (game.keys.space) { start(); return; }
  if (state !== "playing") return;
  if (game.keys.left) paddle.x -= 180 * dt;
  if (game.keys.right) paddle.x += 180 * dt;
  paddle.x = game.clamp(paddle.x, 0, game.width - paddle.w);
  const oldX = ball.x;
  const oldY = ball.y;
  const oldBottom = ball.y + ball.h;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < 0) { ball.x = 0; ball.vx = Math.abs(ball.vx); }
  if (ball.x + ball.w > game.width) { ball.x = game.width - ball.w; ball.vx = -Math.abs(ball.vx); }
  if (ball.y < 0) { ball.y = 0; ball.vy = Math.abs(ball.vy); }

  if (ball.vy > 0 && oldBottom <= paddle.y && ball.y + ball.h >= paddle.y &&
      ball.x < paddle.x + paddle.w && ball.x + ball.w > paddle.x) {
    ball.y = paddle.y - ball.h;
    ball.vy = -Math.abs(ball.vy);
    const offset = ball.x + ball.w / 2 - (paddle.x + paddle.w / 2);
    ball.vx = game.clamp(offset * 4, -160, 160);
    if (Math.abs(ball.vx) < 35) ball.vx = offset < 0 ? -35 : 35;
  }

  for (const brick of bricks) {
    if (!brick.broken && game.overlap(ball, brick)) {
      brick.broken = true;
      score += 1;
      if (oldBottom <= brick.y) { ball.y = brick.y - ball.h; ball.vy = -Math.abs(ball.vy); }
      else if (oldY >= brick.y + brick.h) { ball.y = brick.y + brick.h; ball.vy = Math.abs(ball.vy); }
      else if (oldX + ball.w <= brick.x) { ball.x = brick.x - ball.w; ball.vx = -Math.abs(ball.vx); }
      else if (oldX >= brick.x + brick.w) { ball.x = brick.x + brick.w; ball.vx = Math.abs(ball.vx); }
      else ball.vy = -ball.vy;
      break;
    }
  }
  if (ball.y > game.height) state = "lost";
  if (score === bricks.length) state = "won";
}

function draw() {
  for (const brick of bricks) if (!brick.broken) game.rect(brick.x, brick.y, brick.w, brick.h, "#efcd79");
  game.rect(paddle.x, paddle.y, paddle.w, paddle.h, "#a8ef95");
  game.circle(ball.x + ball.w / 2, ball.y + ball.h / 2, ball.w / 2, "#86c8f7");
  game.text("Bricks: " + score + " / " + bricks.length, 18, 18, "#aabec5", 17);
  if (state === "won") game.text("Every brick! You win.", 80, 110, "#a8ef95", 20);
  if (state === "lost") game.text("Missed. Try a new angle.", 70, 110, "#efcd79", 18);
  game.text("← → move · ↻ or Space restart", 18, 224, "#aabec5", 12);
}`;

// These focused checks place the ball at real collision boundaries, then call
// the learner's update. They assess behavior while keeping failures readable.
const hitOneBrick = `const brick = bricks[0]; ball.x = brick.x + 10; ball.y = brick.y + brick.h + 2; ball.vx = 0; ball.vy = -140; update(0.05);`;
const hitEveryBrick = `for (const brick of bricks) { ball.x = brick.x + 10; ball.y = brick.y + brick.h + 2; ball.vx = 0; ball.vy = -140; update(0.05); }`;
const missPaddle = `ball.x = 20; ball.y = 230; ball.vx = 0; ball.vy = 140; update(0.05); update(0.05);`;
const brickResetCheck =
  'score === 0 && state === "playing" && paddle.x === 140 && ball.x === 175 && ball.y === 175 && ball.vx === 85 && ball.vy === -140 && bricks.every(b => !b.broken)';

const brickTests: GameTestCase[] = [
  {
    label: 'The paddle, ball, and every intact brick are visible',
    expression:
      'game.draws.some(d => d.type === "rect" && d.x === paddle.x && d.y === paddle.y && d.w === paddle.w) && game.draws.some(d => (d.type === "rect" && d.x === ball.x && d.y === ball.y && d.w === ball.w) || (d.type === "circle" && d.x === ball.x + ball.w / 2 && d.y === ball.y + ball.h / 2 && d.r === ball.w / 2)) && bricks.every(b => game.draws.some(d => d.type === "rect" && d.x === b.x && d.y === b.y && d.w === b.w && d.h === b.h))',
  },
  {
    label: 'The paddle moves right by elapsed seconds',
    actions: [frames(10, { right: true }, 0.02)],
    expression: 'Math.abs(paddle.x - 176) < 0.01 && paddle.y === 210',
  },
  {
    label: 'The paddle stops at the left edge',
    actions: [frames(25, { left: true })],
    expression: 'paddle.x === 0',
  },
  {
    label: 'The entire paddle stays inside the right edge',
    actions: [frames(25, { right: true })],
    expression: 'paddle.x === game.width - paddle.w',
  },
  {
    label: 'Both ball coordinates use velocity times seconds',
    actions: [frames(20, {}, 0.02)],
    expression: 'Math.abs(ball.x - 209) < 0.01 && Math.abs(ball.y - 119) < 0.01',
  },
  {
    label: 'The left wall corrects position and reflects right',
    expression:
      '(() => { ball.x = 2; ball.y = 130; ball.vx = -100; ball.vy = 0; update(0.05); return ball.x >= 0 && ball.vx > 0; })()',
  },
  {
    label: 'The right wall corrects position and reflects left',
    expression:
      '(() => { ball.x = 348; ball.y = 130; ball.vx = 100; ball.vy = 0; update(0.05); return ball.x + ball.w <= game.width && ball.vx < 0; })()',
  },
  {
    label: 'The ceiling corrects position and reflects down',
    expression:
      '(() => { ball.x = 180; ball.y = 2; ball.vx = 0; ball.vy = -100; update(0.05); return ball.y >= 0 && ball.vy > 0; })()',
  },
  {
    label: 'A left-half paddle hit returns upward and aims left',
    expression:
      '(() => { ball.x = 160; ball.y = 196; ball.vx = 0; ball.vy = 140; update(0.05); return ball.y + ball.h <= paddle.y && ball.vy < 0 && ball.vx < 0; })()',
  },
  {
    label: 'A right-half paddle hit returns upward and aims right',
    expression:
      '(() => { ball.x = 200; ball.y = 196; ball.vx = 0; ball.vy = 140; update(0.05); return ball.y + ball.h <= paddle.y && ball.vy < 0 && ball.vx > 0; })()',
  },
  {
    label: 'Passing below the missed paddle loses',
    expression: `(() => { const playing = game.draws.filter(d => d.type === "text").map(d => d.message); state = "won"; game.clear(); draw(); const won = game.draws.filter(d => d.type === "text").map(d => d.message); start(); ${missPaddle} game.clear(); draw(); return state === "lost" && score === 0 && game.draws.some(d => d.type === "text" && d.message.trim() && !playing.includes(d.message) && !won.includes(d.message)); })()`,
  },
  {
    label: 'A brick hit removes one brick, scores once, and bounces',
    expression: `(() => { ${hitOneBrick} game.clear(); draw(); return score === 1 && bricks[0].broken && !bricks[1].broken && !bricks[2].broken && ball.vy > 0 && game.draws.some(d => d.type === "text" && d.message.includes(String(score))); })()`,
  },
  {
    label: 'An already broken brick cannot score again',
    expression: `(() => { ${hitOneBrick} ball.x = brick.x + 10; ball.y = brick.y + brick.h + 2; ball.vx = 0; ball.vy = -140; update(0.05); return score === 1 && state === "playing"; })()`,
  },
  {
    label: 'Different bricks and hits from every side respond correctly',
    expression:
      '(() => { const b = bricks[2]; ball.x = b.x + 10; ball.y = b.y + b.h + 2; ball.vx = 0; ball.vy = -140; update(0.05); if (!(score === 1 && b.broken && !bricks[0].broken && ball.vy > 0)) return false; for (const side of ["top", "left", "right"]) { start(); const brick = bricks[0]; ball.x = side === "top" ? brick.x + 10 : side === "left" ? brick.x - ball.w - 2 : brick.x + brick.w + 2; ball.y = side === "top" ? brick.y - ball.h - 2 : brick.y + 3; ball.vx = side === "top" ? 0 : side === "left" ? 140 : -140; ball.vy = side === "top" ? 140 : 0; update(0.05); if (!(brick.broken && score === 1 && (side === "top" ? ball.vy < 0 && ball.y + ball.h <= brick.y : side === "left" ? ball.vx < 0 && ball.x + ball.w <= brick.x : ball.vx > 0 && ball.x >= brick.x + brick.w))) return false; } return true; })()',
  },
  {
    label: 'Breaking all three bricks wins and removes them visually',
    expression: `(() => { ${hitEveryBrick} game.clear(); draw(); const won = game.draws.filter(d => d.type === "text").map(d => d.message); const result = state === "won" && score === 3 && bricks.every(b => b.broken) && !bricks.some(b => game.draws.some(d => d.type === "rect" && d.x === b.x && d.y === b.y && d.w === b.w)); state = "playing"; game.clear(); draw(); const playing = game.draws.filter(d => d.type === "text").map(d => d.message); return result && won.some(message => message.trim() && !playing.includes(message)); })()`,
  },
  {
    label: 'A loss freezes the ball, paddle, and score',
    expression: `(() => { ${missPaddle} const before = { x: ball.x, y: ball.y, px: paddle.x, score }; game.keys.right = true; update(0.05); return state === "lost" && ball.x === before.x && ball.y === before.y && paddle.x === before.px && score === before.score; })()`,
  },
  {
    label: 'A win freezes the ball, paddle, and score',
    expression: `(() => { ${hitEveryBrick} const before = { x: ball.x, y: ball.y, px: paddle.x, score }; game.keys.left = true; update(0.05); return state === "won" && ball.x === before.x && ball.y === before.y && paddle.x === before.px && score === before.score; })()`,
  },
  {
    label: 'Restart after a partially scored loss restores the full game',
    expression: `(() => { ${hitOneBrick} ${missPaddle} game.keys.space = true; update(0.05); return ${brickResetCheck}; })()`,
  },
  {
    label: 'Restart after a win restores every brick and both velocities',
    expression: `(() => { ${hitEveryBrick} paddle.x = 20; ball.x = 300; ball.y = 180; ball.vx = -75; ball.vy = 90; game.keys.space = true; update(0.05); return ${brickResetCheck}; })()`,
  },
  {
    label: 'A restarted round can move and serve normally',
    expression: `(() => { ${hitEveryBrick} game.keys.space = true; update(0.05); game.keys.space = false; game.keys.right = true; update(0.02); return state === "playing" && score === 0 && Math.abs(paddle.x - 143.6) < 0.01 && Math.abs(ball.x - 176.7) < 0.01 && Math.abs(ball.y - 172.2) < 0.01; })()`,
  },
];

export const buildChallenges: BuildChallenge[] = [
  {
    id: 'build-meteor-survival',
    title: 'Build a meteor dodge game',
    subtitle: 'Your own controls, clock, danger, score, and second chance.',
    projectTitle: 'Meteor survival',
    controls: 'arrows',
    brief:
      'Make a real game from these empty functions. Move the green explorer with Left and Right and survive twelve seconds. Red meteors fall from above. Each meteor that passes safely below the screen earns one point and returns above the screen at a random legal x. Touching a meteor loses; surviving the whole clock wins. The named facts in the starter are the contract used by the checks, so keep those names. You choose your own functions, colors, and wording.',
    plan: [
      'Show the player and meteor at their stored coordinates. Show score, remaining seconds, and a clear result.',
      'Move player.x at 180 pixels per second with Left and Right. Keep the entire player on screen; player.y stays 196.',
      'Move meteor.y using meteor.vy and elapsed seconds. Count down from twelve using elapsed seconds.',
      'Touching danger loses. Only a meteor whose top passes below the screen earns one point; then return it above the screen with room for its width.',
      'Reaching zero seconds while safe wins. A finished round stops moving, scoring, and counting time.',
      'Restart or Space restores score 0, timeLeft 12, playing state, player (168, 196), and meteor (168, 20) falling at 100 pixels per second. Make the next round work too.',
    ],
    starter: dodgeStarter,
    solution: dodgeSolution,
    tests: dodgeTests,
    conceptHints: [
      'Separate “prepare the round”, “change the world”, and “show the world”. Start by drawing just the player.',
      'A speed multiplied by elapsed seconds gives the distance for one update. A timer also changes by elapsed seconds.',
      'Rectangles overlap when they share some space. A completed round should skip ordinary updates while still allowing a restart.',
      'A passed meteor is one event. Moving it back above the screen prevents that same pass from scoring on every later frame.',
      'Try standing still, moving to each edge, surviving, losing, and restarting. The second round is part of your game.',
    ],
  },
  {
    id: 'build-brick-breaker',
    title: 'Build a brick breaker',
    subtitle: 'Turn paddle skills into a whole new game.',
    projectTitle: 'Brick breaker',
    controls: 'arrows',
    brief:
      'Start with the empty functions and build a small brick breaker. Steer the paddle with Left and Right. The ball bounces from the walls, ceiling, paddle, and three gold bricks. Each brick can break once. Break all three to win; miss the ball to lose. Where the ball meets the paddle lets you aim left or right. Keep the named fields in the starter because the checks use them. Write the rules yourself; your helper functions and visual style are yours.',
    plan: [
      'Draw the paddle, ball, and every brick that is not broken. Show score and clear win/loss feedback.',
      'Move paddle.x at 180 pixels per second with Left and Right, keeping its entire width on screen. Its y stays 210.',
      'Move both ball coordinates using their velocities and elapsed seconds. Bounce inward at the left wall, right wall, and ceiling, correcting positions as well as directions.',
      'A falling ball meeting the paddle returns upward. A hit left of the paddle center aims left; a hit right of center aims right.',
      'Check each intact brick. A collision breaks it, adds exactly one point, and bounces the ball away. A broken brick disappears and cannot score again.',
      'Win when all three are broken. A ball whose top passes below the screen loses. A finished game freezes the ball, paddle, and score.',
      'Restart or Space restores score 0, playing state, paddle.x 140, ball (175, 175) with vx 85 and vy -140, and all three intact bricks.',
    ],
    starter: brickStarter,
    solution: brickSolution,
    tests: brickTests,
    conceptHints: [
      'Build one small behavior at a time: visible pieces, paddle, moving ball, one wall, paddle bounce, one brick, then the whole list.',
      'A bounce needs a safe position and a direction pointing away from the surface. The previous position helps tell you which face the ball crossed.',
      'Compare the ball’s center with the paddle’s center to decide which horizontal direction an aimed return should take.',
      'Each brick needs its own remembered broken state. The list lets you apply one collision rule to every brick.',
      'Test hits and misses separately, then test an entire finished game and its next round. Draw a troublesome value on screen when you need to see what is happening.',
    ],
  },
];
