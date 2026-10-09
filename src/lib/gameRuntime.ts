import type { CheckResult, RunResult } from './runner';

export type GameKeys = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  space: boolean;
};
export type GamePointer = { x: number; y: number; down: boolean; clicked: boolean };
export type GameTestAction = {
  keys?: Partial<GameKeys>;
  pointer?: Partial<GamePointer>;
  frames?: number;
  dt?: number;
  click?: boolean;
};
export type GameCheck = { label: string; expression: string; actions?: GameTestAction[] };
export type GameTestCase = GameCheck;

const MAX_CODE = 50_000;
const MAX_CHECKS = 20;
const TIMEOUT_MESSAGE =
  'Your game stopped because a piece of code took too long. Look for a loop that never ends, then press Play again.';

function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function csp(nonce: string): string {
  return `default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval' blob:; worker-src blob:; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
}

// This factory lives inside workers. Canvas drawing and headless checks share it,
// so the checks exercise the same input, collision, and drawing API as Play.
const GAME_FACTORY = String.raw`
function makeGame(context, random) {
  const keys = { left: false, right: false, up: false, down: false, space: false };
  const pointer = { x: 0, y: 0, down: false, clicked: false };
  const draws = [];
  const record = command => { if (draws.length < 2000) draws.push(command); };
  const game = {
    width: 360, height: 240, keys, pointer, draws,
    clear(color = '#102a32') {
      draws.length = 0;
      record({ type: 'clear', color });
      if (context) { context.fillStyle = color; context.fillRect(0, 0, 360, 240); }
    },
    rect(x, y, w, h, color = '#f3bd57') {
      record({ type: 'rect', x, y, w, h, color });
      if (context) { context.fillStyle = color; context.fillRect(x, y, w, h); }
    },
    circle(x, y, r, color = '#f3bd57') {
      record({ type: 'circle', x, y, r, color });
      if (context) { context.fillStyle = color; context.beginPath(); context.arc(x, y, Math.max(0, r), 0, Math.PI * 2); context.fill(); }
    },
    text(message, x, y, color = '#ffffff', size = 18) {
      record({ type: 'text', message: String(message), x, y, color, size });
      if (context) { context.fillStyle = color; context.font = Math.max(1, Math.min(100, Number(size) || 18)) + 'px system-ui, sans-serif'; context.textBaseline = 'top'; context.fillText(String(message).slice(0, 1000), x, y); }
    },
    clamp(value, min, max) { return Math.min(max, Math.max(min, value)); },
    random(min, max) { return min + random() * (max - min); },
    overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  };
  return Object.freeze(game);
}
function applyInput(game, input) {
  if (input.keys) for (const key of ['left', 'right', 'up', 'down', 'space']) {
    if (typeof input.keys[key] === 'boolean') game.keys[key] = input.keys[key];
  }
  if (input.pointer) {
    for (const key of ['x', 'y']) if (Number.isFinite(input.pointer[key])) game.pointer[key] = input.pointer[key];
    for (const key of ['down', 'clicked']) if (typeof input.pointer[key] === 'boolean') game.pointer[key] = input.pointer[key];
  }
}
function gameError(error) {
  return ((error && error.name ? String(error.name) + ': ' : '') + (error && error.message ? String(error.message) : String(error))).slice(0, 2000);
}
`;

const PLAY_WORKER =
  GAME_FACTORY +
  String.raw`
let game;
let lifecycle;
let stopped = false;
const send = self.postMessage.bind(self);
const quietConsole = Object.freeze({ log() {}, info() {}, warn() {}, error() {}, debug() {}, clear() {} });
function render(dt, update) {
  game.clear();
  if (update && lifecycle.update) lifecycle.update(dt);
  if (lifecycle.draw) lifecycle.draw();
  game.pointer.clicked = false;
}
self.onmessage = event => {
  if (stopped) return;
  try {
    const message = event.data;
    if (message.type === 'start' && !game) {
      const context = message.canvas.getContext('2d');
      if (!context) throw new Error('This browser could not open the game canvas. Try a current Chrome browser.');
      game = makeGame(context, Math.random);
      const evaluate = new Function('game', 'console', '"use strict";\n' + message.code + '\n;return { start: typeof start === "function" ? start : null, update: typeof update === "function" ? update : null, draw: typeof draw === "function" ? draw : null };');
      lifecycle = evaluate(game, quietConsole);
      if (lifecycle.start) lifecycle.start();
      render(0, false);
      send({ type: 'ready' });
    } else if (message.type === 'frame' && game) {
      applyInput(game, message);
      render(Math.min(.05, Math.max(0, Number(message.dt) || 0)), true);
      send({ type: 'frame' });
    }
  } catch (error) {
    stopped = true;
    send({ type: 'error', error: gameError(error) });
  }
};`;

const CHECK_WORKER =
  GAME_FACTORY +
  String.raw`
let started = false;
const send = self.postMessage.bind(self);
self.onmessage = event => {
  if (started) return;
  started = true;
  const { code, checks } = event.data;
  const output = [];
  const print = (...values) => { if (output.length < 20) output.push(values.map(value => String(value).slice(0, 500)).join(' ').slice(0, 1000)); };
  const practiceConsole = Object.freeze({ log: print, info: print, warn: print, error: print, debug: print, clear() { output.length = 0; } });
  const results = [];
  let error;
  for (const check of checks) {
    try {
      const game = makeGame(null, () => .5);
      // Appended checks can see learner const/let state. Every check gets a fresh
      // game so a previous test's movement or score cannot contaminate the next.
      const evaluate = new Function('game', 'console', '__gameActions', '__applyInput', '__gameResult', '"use strict";\n' + code + '\n;\n' +
        'if (typeof start === "function") start();\n' +
        'game.clear(); if (typeof draw === "function") draw(); game.pointer.clicked = false;\n' +
        'for (const __action of __gameActions) {\n' +
        '  __applyInput(game, __action); if (__action.click) game.pointer.clicked = true;\n' +
        '  const __frames = Math.min(600, Math.max(0, Math.floor(Number(__action.frames ?? 1) || 0)));\n' +
        '  const __dt = Math.min(.05, Math.max(0, Number(__action.dt ?? (1 / 60)) || 0));\n' +
        '  for (let __frame = 0; __frame < __frames; __frame++) {\n' +
        '    game.clear(); if (typeof update === "function") update(__dt);\n' +
        '    if (typeof draw === "function") draw(); game.pointer.clicked = false;\n' +
        '  }\n' +
        '}\n__gameResult.passed = Boolean(' + check.expression + ');');
      const outcome = { passed: false };
      evaluate(game, practiceConsole, check.actions || [], applyInput, outcome);
      results.push({ label: check.label, passed: outcome.passed === true });
    } catch (failure) {
      results.push({ label: check.label, passed: false });
      // A test that references a missing variable is normal incomplete work;
      // syntax/runtime errors also give the learner a readable explanation.
      if (!error) error = gameError(failure);
    }
  }
  send({ output, checks: results, ...(error ? { error } : {}) });
};`;

/**
 * Render with sandbox="allow-scripts" (never allow-same-origin). Learner code
 * runs in a worker inside this opaque iframe: no app DOM/storage, no network.
 * Messages to the parent carry token and type ready | frame | error | stopped.
 * The parent must also verify event.source against iframe.contentWindow.
 */
export function createGameDocument(
  code: string,
  token: string,
  controls?: 'pointer' | 'arrows' | 'platformer'
): string {
  const nonce = randomToken();
  const actionLabel = controls ? (controls === 'platformer' ? 'Jump' : 'Restart ↻') : 'Action';
  const actionAria = controls ? (controls === 'platformer' ? 'Jump' : 'Restart game') : 'Jump or action';
  const upLabel = controls === 'platformer' ? '↻' : '↑';
  const upAria = controls === 'platformer' ? 'Restart game' : 'Move up';
  const boot = `
    const sessionToken = ${scriptJson(token)};
    const gameCode = ${scriptJson(code.slice(0, MAX_CODE))};
    const workerSource = ${scriptJson(PLAY_WORKER)};
    const send = (type, error) => parent.postMessage({ type, token: sessionToken, ...(error ? { error } : {}) }, '*');
    const canvas = document.getElementById('game');
    const status = document.getElementById('status');
    const keys = { left: false, right: false, up: false, down: false, space: false };
    const pointer = { x: 0, y: 0, down: false, clicked: false };
    let worker;
    let workerUrl;
    let timeout;
    let animation;
    let stopped = false;
    let previousTime = 0;
    const clearKeys = () => { for (const key of Object.keys(keys)) keys[key] = false; pointer.down = false; pointer.clicked = false; document.querySelectorAll('[data-key]').forEach(button => button.removeAttribute('data-held')); };
    const stop = (message, type = 'error') => {
      if (stopped) return;
      stopped = true; clearTimeout(timeout); cancelAnimationFrame(animation); clearKeys();
      if (worker) worker.terminate(); if (workerUrl) URL.revokeObjectURL(workerUrl);
      status.textContent = message || 'Game stopped. Press Play to try again.';
      send(type, type === 'error' ? message : undefined);
    };
    const armWatchdog = () => { clearTimeout(timeout); timeout = setTimeout(() => stop(${scriptJson(TIMEOUT_MESSAGE)}), 2000); };
    const scheduleFrame = () => {
      if (stopped) return;
      animation = requestAnimationFrame(time => {
        if (stopped) return;
        const dt = previousTime ? Math.min(.05, (time - previousTime) / 1000) : 1 / 60;
        previousTime = time;
        armWatchdog();
        worker.postMessage({ type: 'frame', dt, keys: { ...keys }, pointer: { ...pointer } });
        pointer.clicked = false;
      });
    };
    const keyMap = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'space' };
    addEventListener('keydown', event => { const key = keyMap[event.key]; if (key) { event.preventDefault(); keys[key] = true; } });
    addEventListener('keyup', event => { const key = keyMap[event.key]; if (key) { event.preventDefault(); keys[key] = false; } });
    addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys(); });
    const updatePointer = event => { const bounds = canvas.getBoundingClientRect(); pointer.x = Math.max(0, Math.min(360, (event.clientX - bounds.left) * 360 / bounds.width)); pointer.y = Math.max(0, Math.min(240, (event.clientY - bounds.top) * 240 / bounds.height)); };
    canvas.addEventListener('pointerdown', event => { event.preventDefault(); canvas.focus(); canvas.setPointerCapture(event.pointerId); updatePointer(event); pointer.down = true; pointer.clicked = true; });
    canvas.addEventListener('pointermove', updatePointer);
    canvas.addEventListener('pointerup', event => { updatePointer(event); pointer.down = false; });
    canvas.addEventListener('pointercancel', () => { pointer.down = false; pointer.clicked = false; });
    for (const button of document.querySelectorAll('[data-key]')) {
      const key = button.dataset.key;
      button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); keys[key] = true; button.setAttribute('data-held', ''); });
      const release = () => { keys[key] = false; button.removeAttribute('data-held'); };
      button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
      button.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); keys[key] = true; } });
      button.addEventListener('keyup', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); release(); } });
    }
    addEventListener('message', event => {
      if (event.source !== parent || event.data?.token !== sessionToken) return;
      if (event.data.type === 'stop') stop('', 'stopped');
      else if (event.data.type === 'input') {
        if (event.data.keys) for (const key of Object.keys(keys)) if (typeof event.data.keys[key] === 'boolean') keys[key] = event.data.keys[key];
        if (event.data.pointer) { for (const key of ['x', 'y']) if (Number.isFinite(event.data.pointer[key])) pointer[key] = event.data.pointer[key]; for (const key of ['down', 'clicked']) if (typeof event.data.pointer[key] === 'boolean') pointer[key] = event.data.pointer[key]; }
      }
    });
    addEventListener('pagehide', () => stop('', 'stopped'));
    try {
      if (${code.length > MAX_CODE ? 'true' : 'false'}) throw new Error('Keep your game under 50,000 characters.');
      if (!canvas.transferControlToOffscreen || typeof Worker === 'undefined') throw new Error('This game editor needs a browser with worker canvas support. Update Samsung Chrome or desktop Chrome, then try again.');
      workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
      worker = new Worker(workerUrl);
      worker.onmessage = event => {
        if (stopped) return;
        clearTimeout(timeout);
        if (event.data?.type === 'error') stop(String(event.data.error).slice(0, 2000));
        else if (event.data?.type === 'ready' || event.data?.type === 'frame') { status.textContent = 'Playing. Tap the game or use the controls below.'; send(event.data.type); scheduleFrame(); }
      };
      worker.onerror = event => { event.preventDefault(); stop('The game runner could not start. Try a current Chrome browser.'); };
      const surface = canvas.transferControlToOffscreen();
      armWatchdog(); worker.postMessage({ type: 'start', code: gameCode, canvas: surface }, [surface]);
    } catch (error) { stop(error.message || String(error)); }
  `;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp(nonce)}"><style>html,body{margin:0;background:#102a32;color:#fff;font-family:system-ui,sans-serif}*{box-sizing:border-box}body{padding:10px}canvas{display:block;width:100%;aspect-ratio:3/2;border-radius:12px;touch-action:none;outline-offset:3px}canvas:focus-visible,button:focus-visible{outline:3px solid #fff}#status{font-size:12px;line-height:1.4;min-height:34px;margin:8px 0}#controls{display:flex;gap:7px;justify-content:center}button{background:#254650;color:#fff;border:1px solid #567780;border-radius:10px;min-height:48px;min-width:44px;font-size:20px;touch-action:none}button[data-held]{background:#496b3a}button[data-key=space]{flex:1;font-size:15px;max-width:105px}@media(max-width:300px){body{padding:6px}#controls{gap:4px}button{min-width:38px}}</style></head><body><canvas id="game" width="360" height="240" tabindex="0" aria-label="Your playable game. Tap here to focus keyboard controls.">Your game needs canvas support.</canvas><p id="status" role="status">Starting your game…</p><div id="controls" role="group" aria-label="Touch game controls"><button type="button" data-key="left" aria-label="Move left">←</button><button type="button" data-key="up" aria-label="${upAria}">${upLabel}</button><button type="button" data-key="down" aria-label="Move down">↓</button><button type="button" data-key="right" aria-label="Move right">→</button><button type="button" data-key="space" aria-label="${actionAria}">${actionLabel}</button></div><script nonce="${nonce}">${boot}</script></body></html>`;
}

function checkDocument(token: string): string {
  const nonce = randomToken();
  const boot = `
    const sessionToken = ${scriptJson(token)};
    const workerSource = ${scriptJson(CHECK_WORKER)};
    let worker; let workerUrl; let timeout; let started = false; let finished = false;
    const stop = result => { if (finished) return; finished = true; clearTimeout(timeout); if (worker) worker.terminate(); if (workerUrl) URL.revokeObjectURL(workerUrl); parent.postMessage({ type: 'result', token: sessionToken, result }, '*'); };
    addEventListener('message', event => {
      if (event.source !== parent || event.data?.token !== sessionToken || event.data?.type !== 'run' || started) return;
      started = true;
      try {
        workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
        worker = new Worker(workerUrl);
        timeout = setTimeout(() => stop({ output: [], checks: [], error: ${scriptJson(TIMEOUT_MESSAGE)} }), 2000);
        worker.onmessage = event => stop(event.data);
        worker.onerror = () => stop({ output: [], checks: [], error: 'The game checks could not start. Try a current Chrome browser.' });
        worker.postMessage(event.data.payload);
      } catch { stop({ output: [], checks: [], error: 'This browser could not open the isolated game checks. Try a current Chrome browser.' }); }
    });
    parent.postMessage({ type: 'ready', token: sessionToken }, '*');
  `;
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp(nonce)}"></head><body><script nonce="${nonce}">${boot}</script></body></html>`;
}

/** Runs trusted behavioral checks, with fresh learner state for every check. */
export function runGameChecks(code: string, cases: readonly GameCheck[]): Promise<RunResult> {
  const chosen = cases.slice(0, MAX_CHECKS);
  const failed: CheckResult[] = chosen.map(({ label }) => ({ label, passed: false }));
  if (code.length > MAX_CODE)
    return Promise.resolve({
      output: [],
      checks: failed,
      error: 'Keep your game under 50,000 characters.',
    });
  if (typeof document === 'undefined' || !document.body)
    return Promise.resolve({
      output: [],
      checks: failed,
      error: 'Open CodeSprout in a browser to check your game.',
    });
  return new Promise((resolve) => {
    const token = randomToken();
    const frame = document.createElement('iframe');
    frame.title = 'Isolated game checks';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.referrerPolicy = 'no-referrer';
    frame.style.display = 'none';
    let finished = false;
    let started = false;
    let deadline: ReturnType<typeof setTimeout>;
    const finish = (result: RunResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      window.removeEventListener('message', receive);
      frame.remove();
      resolve(result);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.data?.token !== token) return;
      if (event.data.type === 'ready' && !started) {
        started = true;
        frame.contentWindow?.postMessage(
          { type: 'run', token, payload: { code, checks: chosen } },
          '*'
        );
      } else if (event.data.type === 'result') {
        const result = event.data.result;
        if (!result || !Array.isArray(result.checks) || !Array.isArray(result.output)) return;
        finish({
          output: result.output.slice(0, 20).map((line: unknown) => String(line).slice(0, 1000)),
          checks: chosen.map(({ label }, index) => ({
            label,
            passed: result.checks[index]?.passed === true,
          })),
          ...(typeof result.error === 'string' ? { error: result.error.slice(0, 2000) } : {}),
        });
      }
    };
    window.addEventListener('message', receive);
    deadline = setTimeout(
      () => finish({ output: [], checks: failed, error: TIMEOUT_MESSAGE }),
      3000
    );
    frame.srcdoc = checkDocument(token);
    document.body.append(frame);
  });
}
