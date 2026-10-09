import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const docs = path.join(root, 'docs');
const source = ts.transpileModule(
  fs.readFileSync(path.join(root, 'src/lib/gameRuntime.ts'), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }
).outputText;
const runtimeUrl = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
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
let networkRequests = 0;
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/debug-network-canary.js')) {
      networkRequests++;
      response
        .writeHead(200, { 'Content-Type': 'text/javascript' })
        .end('self.externalCode = true;');
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
let checks = 0;
function pass(label) {
  checks++;
  console.log('PASS ' + label);
}
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(async (url) => {
    window.__debugQaRuntime = await import(url);
  }, runtimeUrl);
  async function play(code) {
    await page.evaluate((code) => {
      document.getElementById('debug-qa-frame')?.remove();
      if (window.__debugQaListener) removeEventListener('message', window.__debugQaListener);
      window.__debugQaMessages = [];
      const frame = document.createElement('iframe');
      frame.id = 'debug-qa-frame';
      frame.title = 'Game debugger browser test';
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.style.cssText =
        'display:block;width:370px;max-width:100%;height:390px;position:fixed;left:10px;top:10px;border:0;z-index:9999';
      window.__debugQaListener = (event) => {
        if (event.source === frame.contentWindow && event.data?.token === 'debug-browser-qa')
          window.__debugQaMessages.push(event.data);
      };
      addEventListener('message', window.__debugQaListener);
      frame.srcdoc = window.__debugQaRuntime.createGameDocument(code, 'debug-browser-qa');
      document.body.append(frame);
    }, code);
    await page.waitForFunction(
      () => window.__debugQaMessages.some((message) => message.type === 'ready'),
      null,
      { timeout: 5000 }
    );
  }
  const frame = page.frameLocator('#debug-qa-frame');
  const messages = () => page.evaluate(() => window.__debugQaMessages);
  const send = (type, details = {}) =>
    page.evaluate(
      ({ type, details }) =>
        document
          .getElementById('debug-qa-frame')
          .contentWindow.postMessage({ type, token: 'debug-browser-qa', ...details }, '*'),
      { type, details }
    );
  const last = async (type) => (await messages()).filter((message) => message.type === type).at(-1);
  async function waitNew(type, previousCount) {
    await page.waitForFunction(
      ({ type, previousCount }) =>
        window.__debugQaMessages.filter((message) => message.type === type).length > previousCount,
      { type, previousCount }
    );
    return last(type);
  }
  async function command(type, details = {}) {
    const previousCount = (await messages()).filter((message) => message.type === type).length;
    await send(type, details);
    return waitNew(type, previousCount);
  }
  async function pause() {
    const previousCount = (await messages()).filter((message) => message.type === 'paused').length;
    await send('pause');
    return waitNew('paused', previousCount);
  }
  const fixture = `let score=0,state='playing',x=0;const player={x:0,y:70,w:20,h:20};function update(dt){score++;x+=120*dt;player.x=x;}function draw(){game.rect(player.x,player.y,player.w,player.h,'gold');game.watch('speed',120);}`;
  await play(fixture);
  await page.waitForFunction(
    () => window.__debugQaMessages.filter((message) => message.type === 'frame').length >= 5
  );
  assert(
    (await messages()).every((message) => !message.debug),
    'Debugging must be opt-in.'
  );
  await send('pause', { token: 'wrong-token' });
  await frame
    .locator('canvas')
    .evaluate(() => window.postMessage({ type: 'pause', token: 'debug-browser-qa' }, '*'));
  await page.waitForFunction(
    () => window.__debugQaMessages.filter((message) => message.type === 'frame').length >= 15
  );
  assert(
    !(await messages()).some((message) => message.type === 'paused'),
    'Wrong token and wrong source must be ignored.'
  );
  pass('Debugging is opt-in and pause commands require the parent source plus session token');

  const enabled = await command('debug', { enabled: true });
  assert.equal(enabled.debug.watches.speed, 120);
  assert.equal(enabled.debug.watches.state, 'playing');
  assert.equal(enabled.debug.watches.player.x, enabled.debug.watches.x);
  assert.equal(enabled.debug.watches.score, enabled.debug.frame);
  const paused = await pause();
  assert.equal(paused.paused, true);
  const pausedFrames = (await messages()).filter((message) => message.type === 'frame').length;
  const pausedCanvas = await frame.locator('canvas').screenshot();
  await page.waitForTimeout(250);
  assert.equal(
    (await messages()).filter((message) => message.type === 'frame').length,
    pausedFrames,
    'No update may finish after the pause acknowledgement.'
  );
  assert(pausedCanvas.equals(await frame.locator('canvas').screenshot()));
  pass('Pause stops actual game updates and exposes current lexical state plus custom watches');

  const beforeStep = (await messages()).filter(
    (message) => message.type === 'frame' && message.paused === true
  ).length;
  await send('step');
  await page.waitForFunction(
    (count) =>
      window.__debugQaMessages.filter(
        (message) => message.type === 'frame' && message.paused === true
      ).length > count,
    beforeStep
  );
  const stepped = await last('frame');
  assert.equal(stepped.paused, true);
  assert.equal(stepped.debug.frame, paused.debug.frame + 1);
  assert(Math.abs(stepped.debug.time - paused.debug.time - 1 / 60) < 1e-10);
  assert.equal(stepped.debug.watches.score, paused.debug.watches.score + 1);
  assert(Math.abs(stepped.debug.watches.x - paused.debug.watches.x - 2) < 1e-9);
  assert(
    !pausedCanvas.equals(await frame.locator('canvas').screenshot()),
    'A step must redraw the moved player.'
  );
  const afterStepFrames = (await messages()).filter((message) => message.type === 'frame').length;
  await page.waitForTimeout(250);
  assert.equal(
    (await messages()).filter((message) => message.type === 'frame').length,
    afterStepFrames
  );
  pass(
    'One frame advances exactly 1/60 second, redraws the canvas, updates watches, and remains paused'
  );

  const previousResume = (await messages()).filter((message) => message.type === 'resumed').length;
  await send('resume');
  await waitNew('resumed', previousResume);
  const sampleStart = (await messages()).length;
  await page.waitForTimeout(1100);
  const sample = (await messages())
    .slice(sampleStart)
    .filter((message) => message.type === 'frame');
  const published = sample.filter((message) => message.debug);
  assert(
    published.length >= 1 && published.length <= 12,
    'Automatic debug publication is capped near ten per second.'
  );
  assert(
    sample.length > published.length,
    'Debug sampling must not throttle the game to the sample rate.'
  );
  assert(published.at(-1).debug.frame > stepped.debug.frame);
  await command('debug', { enabled: false });
  const disableStart = (await messages()).length;
  await page.waitForTimeout(250);
  assert((await messages()).slice(disableStart).every((message) => !message.debug));
  pass('Resume restores continuous play; watch publication stays near 10 Hz and can be disabled');

  await play(
    `function draw(){const circular={};circular.self=circular;for(let i=0;i<30;i++)game.watch('value'+i+'😀'.repeat(80),{large:Array(100).fill('😀'.repeat(1000)),circular,get trap(){throw Error('Getter executed');}});}`
  );
  const bounded = await command('debug', { enabled: true });
  assert.equal(Object.keys(bounded.debug.watches).length, 12);
  assert(new TextEncoder().encode(JSON.stringify(bounded.debug)).length < 8192);
  pass('Unicode, nested/circular values, getters, and many labels remain below an 8 KB snapshot');

  await play(
    `let blocked=false;function start(){try{importScripts(${JSON.stringify(base + 'debug-network-canary.js')});}catch{blocked=true;}}function draw(){game.watch('network blocked',blocked);game.watch('DOM',typeof document);game.watch('storage',typeof localStorage);}`
  );
  const isolated = await command('debug', { enabled: true });
  assert.equal(isolated.debug.watches['network blocked'], true);
  assert.equal(isolated.debug.watches.DOM, 'undefined');
  assert.equal(isolated.debug.watches.storage, 'undefined');
  assert.equal(networkRequests, 0);
  pass('The debugger preserves worker DOM/storage isolation and network blocking');

  await play('function update(){if(game.keys.space)while(true){}}');
  await command('debug', { enabled: true });
  await pause();
  await send('input', { keys: { space: true } });
  const started = Date.now();
  await send('step');
  assert.equal(await page.evaluate(() => 2 + 3), 5);
  await page.waitForFunction(
    () => window.__debugQaMessages.some((message) => message.type === 'error'),
    null,
    { timeout: 4000 }
  );
  assert(Date.now() - started < 3500);
  assert.match((await last('error')).error, /took too long/);
  pass(
    'A frozen single-step is terminated by the outside-worker watchdog while the app stays responsive'
  );
  console.log(`Verified ${checks} live debugger browser checks.`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
