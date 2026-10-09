import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameDocument, runGameChecks } from './gameRuntime';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function workerSource(documentHtml: string): string {
  const match = documentHtml.match(/const workerSource = ("(?:\\.|[^"\\])*");/);
  if (!match) throw new Error('A sandbox worker source must be present.');
  return JSON.parse(match[1]);
}

// Only fixed test snippets execute here. Production code executes this same
// source in a real worker, where the iframe owns its termination deadline.
function testWorker(documentHtml: string) {
  const sent: unknown[] = [];
  const worker = {
    postMessage: (result: unknown) => sent.push(result),
    onmessage: (_event: { data: unknown }) => {},
  };
  new Function('self', workerSource(documentHtml))(worker);
  return { sent, send: (data: unknown) => worker.onmessage({ data }) };
}

function mockBrowser() {
  let receive: (event: MessageEvent) => void = () => {};
  const frame = {
    setAttribute: vi.fn(),
    style: { display: '' },
    title: '',
    referrerPolicy: '',
    srcdoc: '',
    contentWindow: { postMessage: vi.fn() },
    remove: vi.fn(),
  };
  const removeEventListener = vi.fn();
  vi.stubGlobal('document', { createElement: () => frame, body: { append: vi.fn() } });
  vi.stubGlobal('window', {
    addEventListener: (_: string, listener: typeof receive) => {
      receive = listener;
    },
    removeEventListener,
  });
  const send = (data: unknown, source: unknown = frame.contentWindow) => {
    receive({ data, source } as MessageEvent);
  };
  const getToken = () => frame.srcdoc.match(/const sessionToken = "([a-f\d]+)"/)?.[1];
  return {
    frame,
    removeEventListener,
    send,
    get token() {
      return getToken();
    },
    executeChecks() {
      send({ type: 'ready', token: getToken() });
      const payload = frame.contentWindow.postMessage.mock.calls[0][0].payload;
      const worker = testWorker(frame.srcdoc);
      worker.send(payload);
      send({ type: 'result', token: getToken(), result: worker.sent[0] });
    },
  };
}

describe('real game behavior checks', () => {
  it('tests movement under held input and leaves a fresh state for every case', async () => {
    const browser = mockBrowser();
    const promise = runGameChecks(
      `
      let player = { x: 20, y: 30, w: 20, h: 20 };
      function update(dt) { if (game.keys.right) player.x += 100 * dt; }
      function draw() { game.rect(player.x, player.y, player.w, player.h, 'gold'); }
    `,
      [
        {
          label: 'Moves with time',
          actions: [{ keys: { right: true }, frames: 20, dt: 0.05 }],
          expression: 'player.x === 120',
        },
        {
          label: 'Stays put without input',
          actions: [{ frames: 20 }],
          expression: 'player.x === 20',
        },
        {
          label: 'Draws the moved player',
          actions: [{ keys: { right: true }, frames: 2, dt: 0.05 }],
          expression: 'game.draws.some(d => d.type === "rect" && d.x === 30 && d.color === "gold")',
        },
      ]
    );
    browser.executeChecks();
    expect((await promise).checks.every((check) => check.passed)).toBe(true);
    expect(browser.frame.remove).toHaveBeenCalledTimes(1);
  });

  it('a pointer click scores once across many frames, while pointer down stays held', async () => {
    const browser = mockBrowser();
    const promise = runGameChecks(
      `
      let score = 0, heldFrames = 0;
      function update() {
        if (game.pointer.clicked && game.pointer.x >= 50 && game.pointer.x <= 100) score += 1;
        if (game.pointer.down) heldFrames += 1;
      }
    `,
      [
        {
          label: 'One click, one point',
          actions: [{ click: true, pointer: { x: 75, y: 60, down: true }, frames: 12 }],
          expression: 'score === 1 && heldFrames === 12 && game.pointer.clicked === false',
        },
        {
          label: 'Miss does not score',
          actions: [{ click: true, pointer: { x: 10, y: 60 }, frames: 3 }],
          expression: 'score === 0',
        },
      ]
    );
    browser.executeChecks();
    expect((await promise).checks).toEqual([
      { label: 'One click, one point', passed: true },
      { label: 'Miss does not score', passed: true },
    ]);
  });

  it('tests actual collision decisions, edge contact, clamp, and stable random values', async () => {
    const browser = mockBrowser();
    const promise = runGameChecks(
      `
      const player = { x: 15, y: 10, w: 10, h: 10 };
      const coin = { x: 20, y: 10, w: 10, h: 10 };
      let score = 0;
      function update() { if (game.overlap(player, coin)) { score++; coin.x = 300; } }
    `,
      [
        { label: 'Collect once', actions: [{ frames: 5 }], expression: 'score === 1' },
        {
          label: 'Touching edges is no overlap',
          expression: '!game.overlap({x:0,y:0,w:10,h:10},{x:10,y:0,w:10,h:10})',
        },
        {
          label: 'Bounds and random',
          expression:
            'game.clamp(-4,0,360) === 0 && game.clamp(500,0,360) === 360 && game.random(10,30) === 20',
        },
      ]
    );
    browser.executeChecks();
    expect((await promise).checks.every((check) => check.passed)).toBe(true);
  });

  it('caps elapsed time like the live game, calls start once, and clears the last frame', async () => {
    const browser = mockBrowser();
    const promise = runGameChecks(
      `
      let starts = 0, elapsed = 0;
      function start() { starts++; }
      function update(dt) { elapsed += dt; }
      function draw() { game.circle(20,30,5,'pink'); game.text('Hi',5,6); }
    `,
      [
        {
          label: 'Lifecycle',
          actions: [{ frames: 2, dt: 99 }],
          expression:
            'starts === 1 && elapsed === .1 && game.draws.length === 3 && game.draws[0].type === "clear" && game.draws[2].message === "Hi"',
        },
      ]
    );
    browser.executeChecks();
    expect((await promise).checks).toEqual([{ label: 'Lifecycle', passed: true }]);
  });

  it('rejects broken behavior and reports syntax or update errors without losing check labels', async () => {
    let browser = mockBrowser();
    let promise = runGameChecks('let score = 0; function update() {}', [
      { label: 'Score changes', actions: [{ click: true }], expression: 'score === 1' },
    ]);
    browser.executeChecks();
    expect(await promise).toEqual({
      output: [],
      checks: [{ label: 'Score changes', passed: false }],
    });
    browser = mockBrowser();
    promise = runGameChecks('function update() { throw new Error("Oops"); }', [
      { label: 'Keeps running', actions: [{ frames: 1 }], expression: 'true' },
    ]);
    browser.executeChecks();
    expect((await promise).error).toContain('Oops');
    browser = mockBrowser();
    promise = runGameChecks('let = ;', [{ label: 'Valid code', expression: 'true' }]);
    browser.executeChecks();
    expect((await promise).error).toContain('SyntaxError');
  });

  it('a learner return value cannot skip the real behavioral check', async () => {
    const browser = mockBrowser();
    const promise = runGameChecks('return true;', [
      { label: 'Actual behavior', expression: 'false' },
    ]);
    browser.executeChecks();
    expect((await promise).checks).toEqual([{ label: 'Actual behavior', passed: false }]);
  });
});

describe('continuous game worker', () => {
  it('opt-in watches capture snapshots, read course variables, and leave getters alone', () => {
    const worker = testWorker(createGameDocument('', 'token'));
    const canvas = { getContext: () => ({ fillRect() {} }) };
    worker.send({
      type: 'start',
      debugEnabled: true,
      canvas,
      code: `let score=0;const player={x:0,y:10};
        function update(dt){score++;player.x+=60*dt;}
        function draw(){game.watch('copy',player);game.watch('score','manual');game.watch('guarded',{x:5,get trap(){throw Error('Getter ran');}});}`,
    });
    worker.send({ type: 'frame', dt: 1 / 60, paused: true, forceDebug: true, debugEnabled: true });
    const [initial, step] = worker.sent as {
      debug: { frame: number; time: number; watches: Record<string, unknown> };
      paused?: boolean;
    }[];
    expect(initial.debug.frame).toBe(0);
    expect(initial.debug.time).toBe(0);
    expect(initial.debug.watches.copy).toEqual({ x: 0, y: 10 });
    expect(initial.debug.watches.guarded).toEqual({ x: 5, trap: '[getter]' });
    expect(step.paused).toBe(true);
    expect(step.debug.frame).toBe(1);
    expect(step.debug.time).toBe(1 / 60);
    expect(step.debug.watches.player).toEqual({ x: 1, y: 10 });
    expect(step.debug.watches.score).toBe('manual');
    expect(initial.debug.watches.copy).toEqual({ x: 0, y: 10 });
  });

  it('caps automatic debug publication at ten per second and leaves default messages alone', () => {
    let now = 0;
    vi.stubGlobal('performance', { now: () => now });
    const worker = testWorker(createGameDocument('', 'token'));
    const canvas = { getContext: () => ({ fillRect() {} }) };
    worker.send({
      type: 'start',
      debugEnabled: true,
      canvas,
      code: 'let x=0;function update(){x++;}',
    });
    for (let frame = 0; frame < 9; frame++)
      worker.send({ type: 'frame', dt: 1 / 60, debugEnabled: true });
    now = 100;
    worker.send({ type: 'frame', dt: 1 / 60, debugEnabled: true });
    now = 150;
    worker.send({ type: 'frame', dt: 1 / 60, debugEnabled: true });
    expect(worker.sent.filter((message) => (message as { debug?: unknown }).debug)).toHaveLength(2);
    const ordinary = testWorker(createGameDocument('', 'token'));
    ordinary.send({ type: 'start', canvas, code: 'function draw(){game.watch("x",123);}' });
    ordinary.send({ type: 'frame', dt: 1 / 60 });
    expect(ordinary.sent).toEqual([{ type: 'ready' }, { type: 'frame' }]);
  });

  it('bounds the complete watch payload, including Unicode, nested objects, and label count', () => {
    const worker = testWorker(createGameDocument('', 'token'));
    const canvas = { getContext: () => ({ fillRect() {} }) };
    worker.send({
      type: 'start',
      debugEnabled: true,
      canvas,
      code: `function draw(){const circular={};circular.self=circular;for(let i=0;i<30;i++)game.watch('value'+i+'😀'.repeat(80),{big:Array(100).fill('😀'.repeat(1000)),circular});}`,
    });
    const result = worker.sent[0] as { type: string; debug: { watches: Record<string, unknown> } };
    expect(result.type).toBe('ready');
    expect(Object.keys(result.debug.watches)).toHaveLength(12);
    expect(new TextEncoder().encode(JSON.stringify(result.debug)).length).toBeLessThan(8192);
  });

  it('watch is harmless in behavioral checks and does not add drawing commands', async () => {
    const browser = mockBrowser();
    const promise = runGameChecks(
      'function draw(){game.rect(1,2,3,4);game.watch("anything",{get trap(){throw Error("Getter");}});}',
      [
        {
          label: 'Watch has no gameplay effect',
          expression: 'game.draws.length === 2 && game.draws[1].type === "rect"',
        },
      ]
    );
    browser.executeChecks();
    expect((await promise).checks[0].passed).toBe(true);
  });

  it('renders start and repeated frames with the same input and draw semantics as checks', () => {
    const fillRect = vi.fn();
    const context = {
      fillRect,
      fillText: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    };
    const worker = testWorker(
      createGameDocument(
        `
      let x = 10;
      function start() { x = 20; }
      function update(dt) { if (game.keys.right) x += 100 * dt; if (game.pointer.clicked) x += 1; }
      function draw() { game.rect(x, 40, 15, 15, 'gold'); }
    `,
        'test-token'
      )
    );
    worker.send({
      type: 'start',
      code: `let x = 10; function start() { x = 20; } function update(dt) { if (game.keys.right) x += 100 * dt; if (game.pointer.clicked) x += 1; } function draw() { game.rect(x,40,15,15,'gold'); }`,
      canvas: { getContext: () => context },
    });
    worker.send({ type: 'frame', dt: 2, keys: { right: true }, pointer: { clicked: true } });
    worker.send({ type: 'frame', dt: 0.05, keys: { right: false } });
    expect(worker.sent).toEqual([{ type: 'ready' }, { type: 'frame' }, { type: 'frame' }]);
    expect(fillRect.mock.calls.filter((args) => args[2] === 15).map((args) => args[0])).toEqual([
      20, 26, 26,
    ]);
  });

  it('reports lifecycle errors then refuses subsequent frames', () => {
    const worker = testWorker(createGameDocument('', 'token'));
    const canvas = { getContext: () => ({ fillRect() {} }) };
    worker.send({
      type: 'start',
      canvas,
      code: 'function update() { throw new Error("Bad collision"); }',
    });
    worker.send({ type: 'frame', dt: 0.016 });
    worker.send({ type: 'frame', dt: 0.016 });
    expect(worker.sent).toEqual([
      { type: 'ready' },
      { type: 'error', error: 'Error: Bad collision' },
    ]);
  });
});

describe('game sandbox boundary and cleanup', () => {
  it('labels restart and jump controls to match each project’s keyboard mapping', () => {
    const clicker = createGameDocument('', 'token', 'pointer');
    expect(clicker).toContain('data-key="space" aria-label="Restart game">Restart ↻');
    const platformer = createGameDocument('', 'token', 'platformer');
    expect(platformer).toContain('data-key="space" aria-label="Jump">Jump');
    expect(platformer).toContain('data-key="up" aria-label="Restart game">↻');
    expect(createGameDocument('', 'token')).toContain('aria-label="Jump or action">Action');
  });

  it('escapes source and tokens out of HTML, denies network, and includes usable touch controls', () => {
    const documentHtml = createGameDocument('game.text("</script><img src=x>",0,0);', '</script>');
    expect(documentHtml.match(/<script /g)).toHaveLength(1);
    expect(documentHtml.match(/<\/script>/g)).toHaveLength(1);
    expect(documentHtml).toContain("connect-src 'none'");
    expect(documentHtml).toContain('transferControlToOffscreen');
    expect(documentHtml).toContain('worker.terminate()');
    expect(documentHtml).toContain('URL.revokeObjectURL');
    expect(documentHtml).toContain('aria-label="Move left"');
    expect(documentHtml).toContain('aria-label="Jump or action"');
  });

  it('accepts only the correct iframe source and token, clips results, and cleans up', async () => {
    const browser = mockBrowser();
    const promise = runGameChecks('', [{ label: 'Real label', expression: 'true' }]);
    expect(browser.frame.setAttribute).toHaveBeenCalledWith('sandbox', 'allow-scripts');
    browser.send({ type: 'ready', token: browser.token }, {});
    browser.send({ type: 'ready', token: 'wrong' });
    expect(browser.frame.contentWindow.postMessage).not.toHaveBeenCalled();
    browser.send({ type: 'ready', token: browser.token });
    browser.send({ type: 'ready', token: browser.token });
    expect(browser.frame.contentWindow.postMessage).toHaveBeenCalledTimes(1);
    browser.send({
      type: 'result',
      token: browser.token,
      result: {
        output: Array(100).fill('x'.repeat(9000)),
        checks: [{ label: 'Forged', passed: true }],
      },
    });
    const result = await promise;
    expect(result.checks).toEqual([{ label: 'Real label', passed: true }]);
    expect(result.output).toHaveLength(20);
    expect(result.output[0]).toHaveLength(1000);
    expect(browser.removeEventListener).toHaveBeenCalledTimes(1);
    expect(browser.frame.remove).toHaveBeenCalledTimes(1);
  });

  it('finishes a nonresponding check sandbox and rejects oversized code before mounting', async () => {
    vi.useFakeTimers();
    const browser = mockBrowser();
    const promise = runGameChecks('while (true) {}', [{ label: 'Finish', expression: 'true' }]);
    await vi.advanceTimersByTimeAsync(3000);
    expect((await promise).error).toContain('took too long');
    expect(browser.frame.remove).toHaveBeenCalledTimes(1);
    const oversized = await runGameChecks('x'.repeat(50001), [
      { label: 'Finish', expression: 'true' },
    ]);
    expect(oversized.checks).toEqual([{ label: 'Finish', passed: false }]);
    expect(oversized.error).toContain('50,000');
  });
});
