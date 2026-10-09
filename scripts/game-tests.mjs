import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const docs = path.join(root, 'docs');
function moduleUrl(relative) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
}
const runtimeUrl = moduleUrl('src/lib/gameRuntime.ts');
const course = await import(moduleUrl('src/data/gameLessons.ts'));
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};
let canaryRequests = 0;
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/network-canary.js')) {
      canaryRequests++;
      response.writeHead(200, { 'Content-Type': 'text/javascript' }).end('self.canary = true;');
      return;
    }
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
      'Content-Type': types[path.extname(file)] || 'text/plain',
      'Cache-Control': 'no-cache',
    });
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/codesprout/`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
});
let assertions = 0;
function pass(label) {
  assertions++;
  console.log('PASS ' + label);
}

try {
  // Blocking service workers keeps this suite tied to the freshly staged build.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(async (url) => {
    window.__gameQaRuntime = await import(url);
  }, runtimeUrl);
  const checkCode = (code, cases) =>
    page.evaluate(async ({ code, cases }) => window.__gameQaRuntime.runGameChecks(code, cases), {
      code,
      cases,
    });

  // These checks inspect learner state after simulated input, collisions, and
  // drawing. They do not compare source text against a canned answer.
  const exportedLessons = course.gameLessons || course.lessons;
  const lessons = exportedLessons?.map((lesson) => ({
    ...lesson,
    tests: lesson.game?.tests || lesson.tests,
  }));
  const challenges =
    course.gameChallenges ||
    course.challenges ||
    exportedLessons?.flatMap((lesson) =>
      lesson.game?.challenge ? [{ ...lesson.game.challenge, id: `${lesson.id}-remix` }] : []
    );
  assert(Array.isArray(lessons) && lessons.length > 0, 'Game lessons must be exported.');
  assert(
    Array.isArray(challenges) && challenges.length > 0,
    'Independent challenges must be exported.'
  );
  for (const [kind, items] of [
    ['guided', lessons],
    ['independent', challenges],
  ]) {
    for (const item of items) {
      const cases = item.checks || item.tests;
      assert(Array.isArray(cases) && cases.length > 0, 'Behavior checks exist for ' + item.id);
      assert(
        typeof item.solution === 'string' && typeof item.starter === 'string',
        'QA solution and starter exist for ' + item.id
      );
      const solution = await checkCode(item.solution, cases);
      assert(!solution.error, `${item.id} solution error: ${solution.error}`);
      assert(
        solution.checks.length === cases.length && solution.checks.every((check) => check.passed),
        `${item.id} solution failed: ${JSON.stringify(solution)}`
      );
      const starter = await checkCode(item.starter, cases);
      assert(
        !starter.checks.every((check) => check.passed),
        `${item.id} starter must leave a real problem to solve.`
      );
    }
    pass(
      `${items.length} ${kind} game exercises: every solution passes behavioral checks and every starter needs work`
    );
  }

  const variants = [
    {
      label: 'Right moves with seconds, left stays bounded',
      actions: [
        { keys: { right: true }, frames: 10, dt: 0.05 },
        { keys: { right: false, left: true }, frames: 15, dt: 0.05 },
      ],
      expression: 'player.x === 0',
    },
    {
      label: 'Draw reflects real state',
      actions: [{ keys: { right: true }, frames: 2, dt: 0.05 }],
      expression: 'game.draws.some(d => d.type === "rect" && d.x === 20)',
    },
  ];
  for (const expression of ['player.x += 100 * dt;', 'player.x = player.x + dt * 100;']) {
    const result = await checkCode(
      `let player={x:10,y:20,w:20,h:20};function update(dt){if(game.keys.right){${expression}}if(game.keys.left)player.x-=100*dt;player.x=game.clamp(player.x,0,game.width-player.w);}function draw(){game.rect(player.x,player.y,player.w,player.h,'gold');}`,
      variants
    );
    assert(
      result.checks.every((check) => check.passed),
      JSON.stringify(result)
    );
  }
  pass('Equivalent valid JavaScript passes movement and drawing checks');

  const network = await checkCode(
    `let blocked=false;function start(){try{importScripts(${JSON.stringify(base + 'network-canary.js')});}catch{blocked=true;}}`,
    [
      {
        label: 'No app DOM or storage',
        expression:
          'typeof window === "undefined" && typeof document === "undefined" && typeof localStorage === "undefined"',
      },
      { label: 'Network denied', expression: 'blocked' },
    ]
  );
  assert(
    network.checks.every((check) => check.passed),
    JSON.stringify(network)
  );
  assert.equal(canaryRequests, 0);
  pass('Game checks cannot access app DOM/storage or request an external script');

  const timedOutAt = Date.now();
  const timedOut = await checkCode('while(true){}', [{ label: 'Finishes', expression: 'true' }]);
  assert.match(timedOut.error, /took too long/);
  assert(Date.now() - timedOutAt < 4000);
  assert.equal(await page.locator('iframe[title="Isolated game checks"]').count(), 0);
  pass('Nonterminating check code is killed and its hidden iframe is removed');

  async function play(code) {
    await page.evaluate(
      ({ code }) => {
        document.getElementById('game-qa-frame')?.remove();
        window.__gameQaMessages = [];
        if (window.__gameQaListener) removeEventListener('message', window.__gameQaListener);
        const frame = document.createElement('iframe');
        frame.id = 'game-qa-frame';
        frame.title = 'Game runtime browser test';
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.style.cssText =
          'display:block;width:370px;max-width:100%;height:390px;border:0;position:fixed;top:10px;left:10px;z-index:9999;background:#102a32';
        window.__gameQaListener = (event) => {
          if (event.source === frame.contentWindow && event.data?.token === 'game-browser-qa')
            window.__gameQaMessages.push(event.data);
        };
        addEventListener('message', window.__gameQaListener);
        frame.srcdoc = window.__gameQaRuntime.createGameDocument(code, 'game-browser-qa');
        document.body.append(frame);
      },
      { code }
    );
    await page.waitForFunction(
      () => window.__gameQaMessages.some((message) => message.type === 'ready'),
      null,
      { timeout: 5000 }
    );
  }
  const frame = page.frameLocator('#game-qa-frame');
  const canvas = frame.locator('canvas');
  const waitFrames = async (extra = 10) => {
    const start = await page.evaluate(
      () => window.__gameQaMessages.filter((message) => message.type === 'frame').length
    );
    await page.waitForFunction(
      (target) =>
        window.__gameQaMessages.filter((message) => message.type === 'frame').length >= target,
      start + extra
    );
  };
  const playable = `let x=20,score=0;function start(){if(typeof document!=='undefined'||typeof localStorage!=='undefined')throw Error('Isolation failed');}function update(dt){if(game.pointer.clicked)score++;if(game.keys.right)x=game.clamp(x+140*dt,0,330);}function draw(){game.rect(x,70,25,25,'gold');game.text('Score: '+score,5,5);}`;
  await play(playable);
  await waitFrames(3);
  const initial = await canvas.screenshot();
  const canvasBounds = await canvas.boundingBox();
  await page.touchscreen.tap(canvasBounds.x + 120, canvasBounds.y + 120);
  await waitFrames();
  const scored = await canvas.screenshot();
  assert(!initial.equals(scored), 'A real touch must change the rendered score.');
  await waitFrames();
  assert(
    scored.equals(await canvas.screenshot()),
    'A held or completed click must not repeatedly add score.'
  );
  pass('A real phone touch changes the canvas, scores once, and continues playing');

  const right = await frame.getByRole('button', { name: 'Move right', exact: true }).boundingBox();
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: right.x + right.width / 2, y: right.y + right.height / 2 }],
  });
  await waitFrames(12);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitFrames(3);
  const moved = await canvas.screenshot();
  assert(!scored.equals(moved), 'Holding the phone arrow must move the rendered player.');
  await waitFrames(4);
  assert(
    moved.equals(await canvas.screenshot()),
    'Releasing a touch button must release the game key.'
  );
  pass('Holding and releasing a real phone arrow controls player movement');

  await canvas.focus();
  await page.keyboard.down('ArrowRight');
  await waitFrames(8);
  await page.keyboard.up('ArrowRight');
  assert(!moved.equals(await canvas.screenshot()), 'Keyboard arrows must move the player.');
  await page.evaluate(() =>
    document
      .getElementById('game-qa-frame')
      .contentWindow.postMessage({ type: 'stop', token: 'game-browser-qa' }, '*')
  );
  await page.waitForFunction(() =>
    window.__gameQaMessages.some((message) => message.type === 'stopped')
  );
  assert.match(await frame.getByRole('status').textContent(), /Game stopped/);
  pass('Keyboard input works and Stop terminates continuous play');

  await play('function update(){while(true){}}');
  const stuckAt = Date.now();
  assert.equal(
    await page.evaluate(() => 2 + 3),
    5,
    'An infinite update cannot freeze the parent app.'
  );
  await page.waitForFunction(
    () => window.__gameQaMessages.some((message) => message.type === 'error'),
    null,
    { timeout: 4000 }
  );
  assert(Date.now() - stuckAt < 3500);
  assert.match(await frame.getByRole('status').textContent(), /took too long/);
  pass(
    'An infinite update is killed by the outside-worker watchdog while the app stays responsive'
  );

  await context.setOffline(true);
  const offlineCheck = await checkCode(
    'let score=0;function update(){if(game.pointer.clicked)score++;}',
    [{ label: 'Offline click', actions: [{ click: true, frames: 5 }], expression: 'score===1' }]
  );
  assert(offlineCheck.checks[0].passed);
  await play(playable);
  await waitFrames(4);
  await context.setOffline(false);
  pass('Behavior checks and the actual playable canvas work without network access');
  console.log(
    `Verified ${assertions} game browser checks and ${lessons.length + challenges.length} complete game exercises.`
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
