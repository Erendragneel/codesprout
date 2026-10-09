import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const docs = path.join(root, 'docs');
const moduleUrl = (relative) => {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
};
const runtimeUrl = moduleUrl('src/lib/gameRuntime.ts');
const { buildChallenges } = await import(moduleUrl('src/data/buildChallenges.ts'));
const contentTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/codesprout/')) {
      response.writeHead(404).end();
      return;
    }
    const relative = pathname.slice('/codesprout/'.length) || 'index.html';
    const file = path.resolve(docs, relative);
    if (!file.startsWith(docs + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(file)] || 'text/plain',
      'Cache-Control': 'no-cache',
    });
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(500).end();
  }
});

// Mutations deliberately introduce plausible, valid-code mistakes. Grading is
// still execution of input/collision/rendering behavior, never a source match.
const mutations = [
  [
    'build-meteor-survival',
    'win feedback missing',
    'if (state === "won") game.text("You survived!", 100, 105, "#a8ef95", 23);',
    '',
    'A win gives a visible message beyond the score and timer',
  ],
  [
    'build-meteor-survival',
    'loss feedback missing',
    'if (state === "lost") game.text("Meteor! Try another route.", 50, 105, "#efcd79", 18);',
    '',
    'A loss gives a different visible message',
  ],
  [
    'build-brick-breaker',
    'win feedback missing',
    'if (state === "won") game.text("Every brick! You win.", 80, 110, "#a8ef95", 20);',
    '',
    'Breaking all three bricks wins and removes them visually',
  ],
  [
    'build-brick-breaker',
    'loss feedback missing',
    'if (state === "lost") game.text("Missed. Try a new angle.", 70, 110, "#efcd79", 18);',
    '',
    'Passing below the missed paddle loses',
  ],
  [
    'build-brick-breaker',
    'top brick bounce points into brick',
    'if (oldBottom <= brick.y) { ball.y = brick.y - ball.h; ball.vy = -Math.abs(ball.vy); }',
    'if (oldBottom <= brick.y) { ball.y = brick.y - ball.h; ball.vy = Math.abs(ball.vy); }',
    'Different bricks and hits from every side respond correctly',
  ],
  [
    'build-brick-breaker',
    'left brick bounce points into brick',
    'else if (oldX + ball.w <= brick.x) { ball.x = brick.x - ball.w; ball.vx = -Math.abs(ball.vx); }',
    'else if (oldX + ball.w <= brick.x) { ball.x = brick.x - ball.w; ball.vx = Math.abs(ball.vx); }',
    'Different bricks and hits from every side respond correctly',
  ],
  [
    'build-brick-breaker',
    'right brick bounce points into brick',
    'else if (oldX >= brick.x + brick.w) { ball.x = brick.x + brick.w; ball.vx = Math.abs(ball.vx); }',
    'else if (oldX >= brick.x + brick.w) { ball.x = brick.x + brick.w; ball.vx = -Math.abs(ball.vx); }',
    'Different bricks and hits from every side respond correctly',
  ],
  [
    'build-meteor-survival',
    'score display never updates',
    '"Dodged: " + score',
    '"Dodged: 0"',
    'The game shows score and remaining seconds',
  ],
  [
    'build-meteor-survival',
    'drawing omitted',
    'game.rect(player.x, player.y, player.w, player.h, "#a8ef95");',
    '',
    'The explorer and meteor are visible',
  ],
  [
    'build-meteor-survival',
    'wrong arrow direction',
    'if (game.keys.left) player.x -= 180 * dt;',
    'if (game.keys.left) player.x += 180 * dt;',
    'Left stops at the screen edge',
  ],
  [
    'build-meteor-survival',
    'missing player bounds',
    'player.x = game.clamp(player.x, 0, game.width - player.w);',
    '',
    'Right keeps the entire explorer visible',
  ],
  [
    'build-meteor-survival',
    'frame-counted timer',
    'timeLeft - dt',
    'timeLeft - 1',
    'The countdown uses seconds on smaller frames',
  ],
  [
    'build-meteor-survival',
    'meteor never moves',
    'meteor.y += meteor.vy * dt;',
    'meteor.y += 0;',
    'The meteor falls at 100 pixels per second',
  ],
  [
    'build-meteor-survival',
    'missed scoring',
    'score += 1;',
    'score += 0;',
    'One safely passed meteor scores once and starts another',
  ],
  [
    'build-meteor-survival',
    'same pass counted repeatedly',
    'meteor.y = -meteor.h;',
    'meteor.y = meteor.y;',
    'One safely passed meteor scores once and starts another',
  ],
  [
    'build-meteor-survival',
    'new meteor outside play area',
    'meteor.x = game.random(0, game.width - meteor.w);',
    'meteor.x = game.width;',
    'One safely passed meteor scores once and starts another',
  ],
  [
    'build-meteor-survival',
    'missing collision loss',
    'if (game.overlap(player, meteor)) { state = "lost"; return; }',
    'if (game.overlap(player, meteor)) { state = "playing"; return; }',
    'Touching the meteor loses the round',
  ],
  [
    'build-meteor-survival',
    'missing survival win',
    'if (timeLeft <= 0) state = "won";',
    'if (timeLeft <= 0) state = "playing";',
    'Surviving all twelve seconds wins',
  ],
  [
    'build-meteor-survival',
    'finished game continues',
    'if (state !== "playing") return;',
    '',
    'A loss freezes movement, scoring, and time',
  ],
  [
    'build-meteor-survival',
    'incomplete second-round reset',
    'meteor.y = 20;',
    'meteor.y = meteor.y;',
    'Restart restores every fact after a loss',
  ],
  [
    'build-brick-breaker',
    'score display never updates',
    '"Bricks: " + score + " / " + bricks.length',
    '"Bricks: 0 / " + bricks.length',
    'A brick hit removes one brick, scores once, and bounces',
  ],
  [
    'build-brick-breaker',
    'ball not drawn',
    'game.circle(ball.x + ball.w / 2, ball.y + ball.h / 2, ball.w / 2, "#86c8f7");',
    '',
    'The paddle, ball, and every intact brick are visible',
  ],
  [
    'build-brick-breaker',
    'paddle escapes screen',
    'paddle.x = game.clamp(paddle.x, 0, game.width - paddle.w);',
    '',
    'The paddle stops at the left edge',
  ],
  [
    'build-brick-breaker',
    'ball ignores elapsed time',
    'ball.x += ball.vx * dt;',
    'ball.x += ball.vx;',
    'Both ball coordinates use velocity times seconds',
  ],
  [
    'build-brick-breaker',
    'left wall direction wrong',
    'if (ball.x < 0) { ball.x = 0; ball.vx = Math.abs(ball.vx); }',
    'if (ball.x < 0) { ball.x = 0; ball.vx = -Math.abs(ball.vx); }',
    'The left wall corrects position and reflects right',
  ],
  [
    'build-brick-breaker',
    'right wall direction wrong',
    'if (ball.x + ball.w > game.width) { ball.x = game.width - ball.w; ball.vx = -Math.abs(ball.vx); }',
    'if (ball.x + ball.w > game.width) { ball.x = game.width - ball.w; ball.vx = Math.abs(ball.vx); }',
    'The right wall corrects position and reflects left',
  ],
  [
    'build-brick-breaker',
    'ceiling direction wrong',
    'if (ball.y < 0) { ball.y = 0; ball.vy = Math.abs(ball.vy); }',
    'if (ball.y < 0) { ball.y = 0; ball.vy = -Math.abs(ball.vy); }',
    'The ceiling corrects position and reflects down',
  ],
  [
    'build-brick-breaker',
    'paddle returns downward',
    'ball.vy = -Math.abs(ball.vy);',
    'ball.vy = Math.abs(ball.vy);',
    'A left-half paddle hit returns upward and aims left',
  ],
  [
    'build-brick-breaker',
    'paddle aiming reversed',
    'ball.vx = game.clamp(offset * 4, -160, 160);',
    'ball.vx = game.clamp(-offset * 4, -160, 160);',
    'A right-half paddle hit returns upward and aims right',
  ],
  [
    'build-brick-breaker',
    'broken brick not scored',
    'score += 1;',
    'score += 0;',
    'A brick hit removes one brick, scores once, and bounces',
  ],
  [
    'build-brick-breaker',
    'broken brick still scores',
    'if (!brick.broken && game.overlap(ball, brick))',
    'if (game.overlap(ball, brick))',
    'An already broken brick cannot score again',
  ],
  [
    'build-brick-breaker',
    'no brick collision response',
    'else if (oldY >= brick.y + brick.h) { ball.y = brick.y + brick.h; ball.vy = Math.abs(ball.vy); }',
    'else if (oldY >= brick.y + brick.h) { ball.y = brick.y + brick.h; ball.vy = -Math.abs(ball.vy); }',
    'A brick hit removes one brick, scores once, and bounces',
  ],
  [
    'build-brick-breaker',
    'miss never loses',
    'if (ball.y > game.height) state = "lost";',
    'if (ball.y > game.height) state = "playing";',
    'Passing below the missed paddle loses',
  ],
  [
    'build-brick-breaker',
    'all bricks never win',
    'if (score === bricks.length) state = "won";',
    'if (score === bricks.length) state = "playing";',
    'Breaking all three bricks wins and removes them visually',
  ],
  [
    'build-brick-breaker',
    'result does not freeze',
    'if (state !== "playing") return;',
    '',
    'A loss freezes the ball, paddle, and score',
  ],
  [
    'build-brick-breaker',
    'bricks not restored on restart',
    'for (const brick of bricks) brick.broken = false;',
    'for (const brick of bricks) brick.broken = brick.broken;',
    'Restart after a win restores every brick and both velocities',
  ],
];

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/codesprout/`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(async (url) => {
    window.__buildQaRuntime = await import(url);
  }, runtimeUrl);
  const run = (code, tests) =>
    page.evaluate(async ({ code, tests }) => window.__buildQaRuntime.runGameChecks(code, tests), {
      code,
      tests,
    });
  assert.equal(buildChallenges.length, 2, 'Both independent projects exist.');
  for (const challenge of buildChallenges) {
    assert(challenge.tests.length > 0 && challenge.tests.length <= 20);
    const solution = await run(challenge.solution, challenge.tests);
    assert(!solution.error, `${challenge.id}: ${solution.error}`);
    assert(
      solution.checks.every((check) => check.passed),
      `${challenge.id}: ${JSON.stringify(solution.checks.filter((check) => !check.passed))}`
    );
    const starter = await run(challenge.starter, challenge.tests);
    assert(
      !starter.error,
      `${challenge.id} starter must be a valid runnable skeleton: ${starter.error}`
    );
    assert(
      !starter.checks.every((check) => check.passed),
      `${challenge.id} requires real independent work.`
    );
    console.log(
      `PASS ${challenge.id}: solution passes ${challenge.tests.length} behavior checks; empty skeleton needs work`
    );
  }

  // Play a complete brick round using held-arrow input rather than placing the
  // ball into test scenarios. This also verifies that the authored game wins.
  const brickGame = buildChallenges.find((item) => item.id === 'build-brick-breaker');
  const fullRound = await run(brickGame.solution, [
    {
      label: 'A full brick-breaker round can be won with normal paddle controls',
      expression:
        '(() => { for (let frame = 0; frame < 600 && state === "playing"; frame++) { const target = ball.x + ball.w / 2; const center = paddle.x + paddle.w / 2; game.keys.left = center > target + 4; game.keys.right = center < target - 4; update(0.05); } return state === "won" && score === 3; })()',
    },
  ]);
  assert(
    fullRound.checks[0]?.passed,
    `A complete playable brick-breaker round must win: ${JSON.stringify(fullRound)}`
  );
  console.log('PASS a full brick-breaker round wins with normal held-arrow controls');

  for (const [id, label, correct, wrong, targetLabel] of mutations) {
    const challenge = buildChallenges.find((item) => item.id === id);
    assert(challenge.solution.includes(correct), `Mutation fixture must find ${id}: ${label}`);
    const test = challenge.tests.find((item) => item.label === targetLabel);
    assert(test, `Named behavior check exists: ${targetLabel}`);
    const result = await run(challenge.solution.replace(correct, wrong), [test]);
    assert.equal(result.checks[0]?.passed, false, `${id}: checks must catch ${label}.`);
    console.log(`PASS behavior rejects ${id}: ${label}`);
  }
  console.log(
    `PASS independent project QA: 2 builds and ${mutations.length} meaningful wrong-code variants`
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
