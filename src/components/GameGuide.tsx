import './game-guide.css';

const lifecycleExample = `let x = 40;

function start() {
  x = 40;
}

function update(dt) {
  if (game.keys.right) x += 100 * dt;
  x = game.clamp(x, 0, game.width - 24);
}

function draw() {
  game.clear("#102a32");
  game.rect(x, 100, 24, 24, "#f3bd57");
}`;

const helpers = [
  ['game.clear(color)', 'Paint the background. Put it first in draw().'],
  ['game.rect(x, y, width, height, color)', 'Draw a box. x and y mark its top-left corner.'],
  ['game.circle(x, y, radius, color)', 'Draw a circle. x and y mark its center.'],
  ['game.text(message, x, y, color, size)', 'Draw words. size is the letter height in pixels.'],
  [
    'game.clamp(value, minimum, maximum)',
    'Keep a number inside a range, such as the edges of the screen.',
  ],
  ['game.random(minimum, maximum)', 'Choose a random number between two values.'],
  ['game.overlap(a, b)', 'Check whether two boxes share space. Each box needs x, y, w, and h.'],
] as const;

export default function GameGuide() {
  return (
    <section className="game-guide" aria-label="Game making reference">
      <div className="game-guide-heading">
        <span className="game-guide-eyebrow">Keep this beside your code</span>
        <h2>A little game-making guide</h2>
        <p>Open just the part you need. One small change, then play and see.</p>
      </div>

      <details>
        <summary>Three jobs every game needs</summary>
        <div className="game-guide-content">
          <dl className="game-guide-jobs">
            <div>
              <dt>
                <code>start()</code> — get ready
              </dt>
              <dd>Runs once each time you press Play. Set starting positions and scores here.</dd>
            </div>
            <div>
              <dt>
                <code>update(dt)</code> — make things happen
              </dt>
              <dd>
                Runs again and again. Read controls, move things, and check the rules.{' '}
                <code>dt</code> is the seconds since the previous update. <code>100 * dt</code>{' '}
                means about 100 pixels per second.
              </dd>
            </div>
            <div>
              <dt>
                <code>draw()</code> — show it
              </dt>
              <dd>
                Runs after each update. Paint the scene using the current positions and score. Keep
                movement in update() so drawing does one job.
              </dd>
            </div>
          </dl>
          <p>This tiny game moves a square right while you hold Right:</p>
          <pre aria-label="Example of a game with start, update and draw">
            <code>{lifecycleExample}</code>
          </pre>
          <p>
            Press Play to restart after changing code. A game also needs a goal, a way to win or
            lose, and a way to try again.
          </p>
        </div>
      </details>

      <details>
        <summary>Drawing and controls, in plain words</summary>
        <div className="game-guide-content">
          <p>
            The screen is <strong>360 pixels wide and 240 high</strong>. <code>game.width</code> and{' '}
            <code>game.height</code> give you those numbers. x grows toward the right; y grows
            toward the bottom.
          </p>
          <dl className="game-guide-api">
            {helpers.map(([call, explanation]) => (
              <div key={call}>
                <dt>
                  <code>{call}</code>
                </dt>
                <dd>{explanation}</dd>
              </div>
            ))}
          </dl>
          <div className="game-guide-note">
            <p>
              <code>game.keys.left</code>, <code>right</code>, <code>up</code>, <code>down</code>,
              and <code>space</code> are true while held. Use the buttons below the game. The Space
              button is labeled Jump, Restart, or Action to match the game. In platformer lessons,
              the ↻ button uses the up key to restart. On a keyboard, click the game first, then use
              arrows or WASD.
            </p>
            <p>
              <code>game.pointer.x</code> and <code>y</code> tell you where you tapped.{' '}
              <code>down</code> stays true while held; <code>clicked</code> is true for one update
              after a tap. Check clicked to add one point per tap.
            </p>
          </div>
        </div>
      </details>

      <details>
        <summary>When the game does something surprising</summary>
        <div className="game-guide-content">
          <ol className="game-guide-steps">
            <li>
              <strong>Say what you expected.</strong> “One tap should add one point.”
            </li>
            <li>
              <strong>Find one small difference.</strong> Read the error or failed check. Show a
              value with <code>game.text(score, 12, 12)</code> to see what it does during play.
            </li>
            <li>
              <strong>Change one thing.</strong> Check spelling, quotes, brackets, and{' '}
              <code>=</code> versus <code>===</code>. If every frame adds a point, check clicked
              instead of down.
            </li>
            <li>
              <strong>Play both cases.</strong> Try a tap and no tap; a wall and open space; a win
              and a loss. Then press Play to test a fresh start.
            </li>
          </ol>
          <p className="game-guide-note">
            A loop that never ends will stop your game. Give it a finishing condition, or let
            update() repeat the work one frame at a time.
          </p>
        </div>
      </details>

      <details>
        <summary>Your five little games, and what each teaches</summary>
        <div className="game-guide-content">
          <ol className="game-guide-steps game-guide-roadmap">
            <li>
              <strong>Clicker.</strong> Draw a target, count taps, reuse a small job, and reset.
            </li>
            <li>
              <strong>Target catcher.</strong> Move a target, race a countdown, win, lose, and
              restart.
            </li>
            <li>
              <strong>Pong.</strong> Read controls, move with time, bounce a ball, and keep score.
            </li>
            <li>
              <strong>Maze.</strong> Use a list of walls, stop collisions, find a goal, and build a
              level.
            </li>
            <li>
              <strong>Platformer.</strong> Add gravity, jumping, landing, collectibles, and win or
              loss rules.
            </li>
          </ol>
          <p>
            After guided practice, try the fresh challenges with your own code. Keep a project you
            can explain: what changes, what draws, and why each rule exists.
          </p>
          <p>
            Then build your crystal adventure from an empty skeleton. Join movement, danger,
            collectibles, results, and restart into one game you can explain.
          </p>
        </div>
      </details>

      <details>
        <summary>When you’re ready to build beyond CodeSprout</summary>
        <div className="game-guide-content">
          <p>
            Save your source and backup first. You’re practicing real JavaScript and core 2D game
            ideas. These helper calls belong to CodeSprout; outside the app, replace them with your
            chosen tool’s drawing and input calls.
          </p>
          <div className="game-guide-next">
            <article>
              <h3>Keep using JavaScript</h3>
              <p>
                Rebuild a tiny game with standard Canvas. <code>game.rect()</code> becomes a canvas
                context’s <code>fillRect()</code>. You’ll add keyboard events and a{' '}
                <code>requestAnimationFrame()</code> loop.
              </p>
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial"
                target="_blank"
                rel="noopener noreferrer"
              >
                MDN’s free Canvas guide ↗
              </a>
              <a
                href="https://developer.mozilla.org/en-US/docs/Games/Tutorials/2D_breakout_game_pure_JavaScript"
                target="_blank"
                rel="noopener noreferrer"
              >
                Build Breakout step by step ↗
              </a>
            </article>
            <article>
              <h3>Try a game engine</h3>
              <p>
                The free Phaser JavaScript framework adds scenes, sprites, and physics for 2D web
                games. Free Godot gives you a visual editor and its own scripting language,
                GDScript. Start with one small 2D game.
              </p>
              <a
                href="https://docs.phaser.io/phaser/getting-started/making-your-first-phaser-game"
                target="_blank"
                rel="noopener noreferrer"
              >
                Phaser’s first game tutorial ↗
              </a>
              <a
                href="https://docs.godotengine.org/en/stable/getting_started/first_2d_game/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Godot’s first 2D game tutorial ↗
              </a>
            </article>
          </div>
          <p className="game-guide-note">
            Take this course as your beginning in 2D games. Large games, 3D worlds, multiplayer,
            art, audio, and publishing each take more practice. Pick one new skill when you feel
            ready.
          </p>
          <p className="game-guide-link-note">
            These official guides open online in a new tab. Your CodeSprout lessons work offline.
          </p>
        </div>
      </details>
    </section>
  );
}
