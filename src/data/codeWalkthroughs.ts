export type WalkthroughMemory = Record<string, string | number | boolean | null>;
export type WalkthroughDrawing =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; color: string }
  | { kind: 'text'; message: string; x: number; y: number };
export type WalkthroughPrediction = {
  question: string;
  choices: readonly string[];
  correct: number;
  explanation: string;
};
export type WalkthroughStep = {
  line: number;
  before: WalkthroughMemory;
  after: WalkthroughMemory;
  screenBefore: WalkthroughDrawing[];
  screenAfter: WalkthroughDrawing[];
  why: string;
  prediction?: WalkthroughPrediction;
};
type StepContext = {
  before: WalkthroughMemory;
  after: WalkthroughMemory;
  input: WalkthroughMemory;
};
type Hook = {
  line: number;
  memory: string;
  input?: string;
  at?: 'before' | 'after' | 'inside-end';
  why: string | ((context: StepContext) => string);
  prediction?: WalkthroughPrediction | ((context: StepContext) => WalkthroughPrediction);
};
type Definition = {
  id: string;
  title: string;
  goal: string;
  lines: readonly string[];
  finalMemory: string;
  hooks: readonly Hook[];
};

const scoreMemory = '{ score }';
const movingMemory = '{ x, speed }';
const collisionMemory = '{ state, "player.x": player.x, "wall.x": wall.x }';
const pickupMemory = '{ score, "star.collected": star.collected }';

// These four tiny programs are original, trusted teaching examples. Only their
// fixed source can be traced; this helper never accepts or executes learner code.
const definitions: readonly Definition[] = [
  {
    id: 'tap-counter',
    title: 'A tap adds one star',
    goal: 'Watch input change a stored score, then watch draw show it.',
    lines: [
      'let score = 0;',
      'function update(tapped) {',
      '  if (!tapped) return;',
      '  score += 1;',
      '}',
      'function draw() {',
      '  game.clear();',
      '  game.text("Stars: " + score, 12, 12);',
      '}',
      'update(true);',
      'draw();',
      'update(false);',
      'draw();',
    ],
    finalMemory: scoreMemory,
    hooks: [
      {
        line: 1,
        memory: scoreMemory,
        why: 'Give score a starting value of zero. A variable keeps a fact for later.',
      },
      {
        line: 10,
        at: 'before',
        memory: scoreMemory,
        why: 'Call update with true: a tap has arrived. Now follow the code into that function.',
      },
      {
        line: 3,
        at: 'before',
        memory: scoreMemory,
        input: '{ tapped }',
        why: ({ input }) =>
          input.tapped
            ? 'tapped is true, so !tapped is false. Skip the return and continue to the next line.'
            : 'tapped is false, so !tapped is true. return ends this update; the adding line will be skipped.',
      },
      {
        line: 4,
        memory: scoreMemory,
        why: 'Add one to the score. The fact changed; drawing is a separate job.',
        prediction: {
          question: 'What will happen to score?',
          choices: ['It goes up by one.', 'It stays at zero.'],
          correct: 0,
          explanation: '+= 1 adds one to the value already stored.',
        },
      },
      {
        line: 11,
        at: 'before',
        memory: scoreMemory,
        why: 'Ask draw to show the current score. Calls send us into their named function.',
      },
      {
        line: 7,
        memory: scoreMemory,
        why: 'Clear the previous picture. Clearing the screen does not clear the score.',
      },
      {
        line: 8,
        memory: scoreMemory,
        why: 'Read score and draw the words on screen. Drawing uses the stored fact; it does not add another star.',
      },
      {
        line: 12,
        at: 'before',
        memory: scoreMemory,
        why: 'Try another update with false: this time there was no tap.',
      },
      {
        line: 13,
        at: 'before',
        memory: scoreMemory,
        why: 'The no-tap update finished without adding anything. Draw the same score again.',
      },
    ],
  },
  {
    id: 'movement-time',
    title: 'Move by seconds',
    goal: 'See why speed × time moves the square a fair distance.',
    lines: [
      'let x = 20;',
      'const speed = 100;',
      'function update(dt, right) {',
      '  if (right) x += speed * dt;',
      '}',
      'function draw() {',
      '  game.clear();',
      '  game.rect(x, 70, 20, 20, "#77a965");',
      '}',
      'update(0.1, true);',
      'draw();',
      'update(0.2, false);',
      'draw();',
    ],
    finalMemory: movingMemory,
    hooks: [
      {
        line: 1,
        memory: '{ x }',
        why: 'Store x as 20. x is the square’s distance from the left edge.',
      },
      {
        line: 2,
        memory: movingMemory,
        why: 'Store a speed of 100 pixels per second. Speed and distance have different jobs.',
      },
      {
        line: 10,
        at: 'before',
        memory: movingMemory,
        why: 'Give update 0.1 seconds and a held Right control. Follow the call to its movement rule.',
      },
      {
        line: 4,
        memory: movingMemory,
        input: '{ dt, right }',
        why: ({ input }) =>
          input.right
            ? `Right is held. 100 × ${input.dt} is 10 pixels, so x moves from 20 to 30.`
            : 'Right is not held. This if checks the input but skips the addition; x stays where it is.',
        prediction: ({ input }) =>
          input.right
            ? {
                question: 'At 100 pixels per second, how far does 0.1 seconds move?',
                choices: ['10 pixels.', '100 pixels.'],
                correct: 0,
                explanation: '100 × 0.1 = 10. Add that distance to x.',
              }
            : {
                question: 'Right is false. What changes?',
                choices: ['x stays at 30.', 'x moves another 20 pixels.'],
                correct: 0,
                explanation: 'The condition skips the movement when Right is not held.',
              },
      },
      { line: 11, at: 'before', memory: movingMemory, why: 'Now draw can use the new x value.' },
      {
        line: 7,
        memory: movingMemory,
        why: 'Clear the previous picture before drawing the next one. This does not reset x.',
      },
      {
        line: 8,
        memory: movingMemory,
        why: 'Draw a square at the stored x. The position becomes visible here.',
      },
      {
        line: 12,
        at: 'before',
        memory: movingMemory,
        why: 'Try 0.2 seconds with Right released. Time can pass without a movement request.',
      },
      {
        line: 13,
        at: 'before',
        memory: movingMemory,
        why: 'Draw again after that update. The square should stay in the same place.',
      },
    ],
  },
  {
    id: 'collision-return',
    title: 'A collision stops this update',
    goal: 'Follow a true condition and see which line return skips.',
    lines: [
      'let state = "playing";',
      'const player = { x: 30, y: 70, w: 20, h: 20 };',
      'const wall = { x: 45, y: 70, w: 20, h: 20 };',
      'function update() {',
      '  if (game.overlap(player, wall)) {',
      '    state = "lost";',
      '    return;',
      '  }',
      '  player.x += 10;',
      '}',
      'game.rect(wall.x, wall.y, wall.w, wall.h, "#d99580");',
      'update();',
      'game.rect(player.x, player.y, player.w, player.h, "#77a965");',
      'game.text(state, 12, 12);',
    ],
    finalMemory: collisionMemory,
    hooks: [
      { line: 1, memory: '{ state }', why: 'The round begins in the playing state.' },
      {
        line: 2,
        memory: '{ state, "player.x": player.x }',
        why: 'Store the player’s position and size together. Its right edge is 30 + 20 = 50.',
      },
      {
        line: 3,
        memory: collisionMemory,
        why: 'The wall starts at x 45. These two rectangles already share a little space.',
      },
      {
        line: 11,
        memory: collisionMemory,
        why: 'Draw the wall. Creating an object stored its facts; this draw call makes it visible.',
      },
      {
        line: 12,
        at: 'before',
        memory: collisionMemory,
        why: 'Call update and check the game’s collision rule.',
      },
      {
        line: 5,
        at: 'before',
        memory: collisionMemory,
        why: 'overlap is true: the player’s right edge passes the wall’s left edge, and their heights overlap too.',
      },
      {
        line: 6,
        memory: collisionMemory,
        why: 'The true condition enters its block. Set state to lost.',
      },
      {
        line: 7,
        at: 'before',
        memory: collisionMemory,
        why: 'return ends this update now. Line 9 will be skipped, so the player cannot move after this loss.',
        prediction: {
          question: 'Will line 9 move player.x to 40?',
          choices: ['No. return skips it.', 'Yes. Every line must run.'],
          correct: 0,
          explanation:
            'A function stops when it reaches return. Code after the call can still continue.',
        },
      },
      {
        line: 9,
        memory: collisionMemory,
        why: 'This movement runs only if the collision block did not return.',
      },
      {
        line: 13,
        memory: collisionMemory,
        why: 'Execution continues after the update call. Draw the player at its unchanged x of 30.',
      },
      {
        line: 14,
        memory: collisionMemory,
        why: 'Draw the lost state so the player can understand the result. return stopped update, not the whole program.',
      },
    ],
  },
  {
    id: 'pickup-reset',
    title: 'Take a star once, then reset',
    goal: 'Use a remembered flag to stop duplicate points and make another round.',
    lines: [
      'let score = 0;',
      'const star = { collected: false };',
      'function pickup() {',
      '  if (star.collected) return;',
      '  star.collected = true;',
      '  score += 1;',
      '}',
      'function draw() { game.clear(); if (!star.collected) game.rect(70, 70, 20, 20, "gold"); }',
      'function start() { score = 0; star.collected = false; }',
      'draw();',
      'pickup(); draw();',
      'pickup(); draw();',
      'start(); draw();',
    ],
    finalMemory: pickupMemory,
    hooks: [
      { line: 1, memory: scoreMemory, why: 'Start the score at zero.' },
      {
        line: 2,
        memory: pickupMemory,
        why: 'false means the star is still available. This flag belongs to this particular star.',
      },
      {
        line: 10,
        at: 'before',
        memory: pickupMemory,
        why: 'Draw the available star before trying a pickup.',
      },
      {
        line: 8,
        at: 'inside-end',
        memory: pickupMemory,
        why: ({ after }) =>
          after['star.collected']
            ? 'Clear the old picture. The star is collected, so the condition skips drawing it.'
            : 'Clear the old picture. The star is available, so draw the gold square.',
      },
      {
        line: 11,
        at: 'before',
        memory: pickupMemory,
        why: 'Try the first pickup, then redraw. Follow pickup first.',
      },
      {
        line: 4,
        at: 'before',
        memory: pickupMemory,
        why: ({ after }) =>
          after['star.collected']
            ? 'The flag is already true. return skips both the flag change and the extra point.'
            : 'The flag is false, so skip this return and continue to collect the star.',
      },
      {
        line: 5,
        memory: pickupMemory,
        why: 'Remember that this star has been collected. Future pickups can read that fact.',
        prediction: {
          question: 'What does star.collected become?',
          choices: ['true — already taken.', 'false — still available.'],
          correct: 0,
          explanation: 'This assignment records the pickup so it cannot count twice.',
        },
      },
      {
        line: 6,
        memory: pickupMemory,
        why: 'Award one point for this new pickup. It will not run on the second attempt.',
      },
      {
        line: 12,
        at: 'before',
        memory: pickupMemory,
        why: 'Try picking up the same star again. The flag will protect the score.',
      },
      {
        line: 13,
        at: 'before',
        memory: pickupMemory,
        why: 'Call start to prepare another round, then redraw its fresh state.',
      },
      {
        line: 9,
        at: 'inside-end',
        memory: pickupMemory,
        why: 'Reset both facts: zero score and an available star. Resetting only score would leave the next round without its star.',
        prediction: {
          question: 'What should a complete reset restore?',
          choices: ['Zero score and an available star.', 'Zero score, but keep the star hidden.'],
          correct: 0,
          explanation: 'Both the score and the collected flag belong to the round.',
        },
      },
    ],
  },
];

export const codeWalkthroughs = definitions.map(({ id, title, goal, lines }) => ({
  id,
  title,
  goal,
  lines,
}));

/** Pure deterministic tracing for the four fixed, trusted examples above. */
export function getCodeWalkthrough(id: string): {
  steps: WalkthroughStep[];
  finalMemory: WalkthroughMemory;
  finalScreen: WalkthroughDrawing[];
} {
  const definition = definitions.find((example) => example.id === id);
  if (!definition) throw new Error('Choose one of the guided code examples.');
  const steps: WalkthroughStep[] = [];
  let memory: WalkthroughMemory = {};
  let screen: WalkthroughDrawing[] = [];
  const copyScreen = () => screen.map((drawing) => ({ ...drawing }));
  const hooks = new Map(definition.hooks.map((hook) => [hook.line, hook]));
  const game = {
    clear: () => {
      screen = [];
    },
    rect: (x: number, y: number, width: number, height: number, color = '#77a965') => {
      screen.push({ kind: 'rect', x, y, width, height, color });
    },
    text: (message: unknown, x: number, y: number) => {
      screen.push({ kind: 'text', message: String(message), x, y });
    },
    overlap: (
      a: { x: number; y: number; w: number; h: number },
      b: { x: number; y: number; w: number; h: number }
    ) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  };
  const record = (line: number, nextMemory: WalkthroughMemory, input: WalkthroughMemory) => {
    const hook = hooks.get(line)!;
    const before = { ...memory };
    const after = { ...nextMemory };
    const context = { before, after, input };
    const previous = steps.at(-1);
    steps.push({
      line,
      before,
      after,
      screenBefore: previous ? previous.screenAfter.map((drawing) => ({ ...drawing })) : [],
      screenAfter: copyScreen(),
      why: typeof hook.why === 'function' ? hook.why(context) : hook.why,
      ...(hook.prediction
        ? {
            prediction:
              typeof hook.prediction === 'function' ? hook.prediction(context) : hook.prediction,
          }
        : {}),
    });
    memory = after;
  };
  const instrumented = definition.lines
    .map((line, index) => {
      const hook = hooks.get(index + 1);
      if (!hook) return line;
      const call = `__record(${index + 1}, ${hook.memory}, ${hook.input ?? '{}'});`;
      if (hook.at === 'before') return `${call}\n${line}`;
      if (hook.at === 'inside-end') {
        const end = line.lastIndexOf('}');
        return `${line.slice(0, end)} ${call} ${line.slice(end)}`;
      }
      return `${line}\n${call}`;
    })
    .join('\n');
  const finalMemory = new Function(
    'game',
    '__record',
    `"use strict";\n${instrumented}\nreturn ${definition.finalMemory};`
  )(game, record) as WalkthroughMemory;
  return { steps, finalMemory: { ...finalMemory }, finalScreen: copyScreen() };
}

/** Used to verify the displayed program against its trace without changing it. */
export function getWalkthroughSource(id: string): { code: string; resultExpression: string } {
  const definition = definitions.find((example) => example.id === id);
  if (!definition) throw new Error('Choose one of the guided code examples.');
  return { code: definition.lines.join('\n'), resultExpression: definition.finalMemory };
}
