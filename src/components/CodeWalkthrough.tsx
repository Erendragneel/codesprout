import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  codeWalkthroughs,
  getCodeWalkthrough,
  type WalkthroughDrawing,
  type WalkthroughMemory,
} from '../data/codeWalkthroughs';
import './code-walkthrough.css';

function valueText(value: WalkthroughMemory[string] | undefined) {
  return value === undefined
    ? 'Not set yet'
    : typeof value === 'string'
      ? `"${value}"`
      : String(value);
}

function drawingDescription(drawings: WalkthroughDrawing[]) {
  const boxes = drawings.filter((drawing) => drawing.kind === 'rect').length;
  const words = drawings
    .filter((drawing) => drawing.kind === 'text')
    .map((drawing) => drawing.message);
  return drawings.length
    ? `${boxes} visible square${boxes === 1 ? '' : 's'}${words.length ? `. Text: ${words.join('. ')}` : ''}.`
    : 'The screen is empty.';
}

export default function CodeWalkthrough() {
  const [exampleId, setExampleId] = useState(codeWalkthroughs[0].id);
  const [position, setPosition] = useState(0);
  const [guessing, setGuessing] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [lastGuess, setLastGuess] = useState<{ position: number; choice: number } | null>(null);
  const codeList = useRef<HTMLOListElement>(null);
  const uniqueId = useId().replace(/:/g, '');
  const example = codeWalkthroughs.find((candidate) => candidate.id === exampleId)!;
  const trace = useMemo(() => getCodeWalkthrough(exampleId), [exampleId]);
  const current = position ? trace.steps[position - 1] : undefined;
  const next = trace.steps[position];
  const screen = current?.screenAfter ?? [];
  const before = current?.before ?? {};
  const after = current?.after ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const prediction = guessing ? next?.prediction : undefined;
  const screenChanged =
    !!current && JSON.stringify(current.screenBefore) !== JSON.stringify(current.screenAfter);

  useEffect(() => {
    const list = codeList.current;
    const row = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !row) return;
    if (
      row.offsetTop < list.scrollTop ||
      row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight
    ) {
      list.scrollTop = Math.max(0, row.offsetTop - list.clientHeight / 2);
    }
  }, [position, exampleId]);

  function restart() {
    setPosition(0);
    setChoice(null);
    setLastGuess(null);
    if (codeList.current) codeList.current.scrollTop = 0;
  }
  function advance() {
    if (!next) return;
    setLastGuess(prediction && choice !== null ? { position: position + 1, choice } : null);
    setPosition(position + 1);
    setChoice(null);
  }

  return (
    <section className="code-walkthrough" aria-labelledby={`${uniqueId}-heading`}>
      <header className="walkthrough-heading">
        <span className="walkthrough-eyebrow">Guided example · fixed inputs</span>
        <h2 id={`${uniqueId}-heading`}>Watch one line change your game</h2>
        <p>
          Step through a tiny built-in program. See which line runs, what it remembers, and when the
          screen changes. These examples use fixed inputs.
        </p>
      </header>
      <div className="walkthrough-setup">
        <label htmlFor={`${uniqueId}-example`}>Choose a small idea</label>
        <select
          id={`${uniqueId}-example`}
          value={exampleId}
          onChange={(event) => {
            setExampleId(event.target.value);
            restart();
          }}
        >
          {codeWalkthroughs.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.title}
            </option>
          ))}
        </select>
        <p>{example.goal}</p>
      </div>
      <div className="walkthrough-controls" aria-label="Guided code steps">
        <button
          type="button"
          onClick={() => {
            setPosition(Math.max(0, position - 1));
            setChoice(null);
            setLastGuess(null);
          }}
          disabled={!position}
        >
          Back one step
        </button>
        <button type="button" className="walkthrough-next" onClick={advance} disabled={!next}>
          Next step <span aria-hidden="true">→</span>
        </button>
        <button type="button" onClick={restart}>
          Start again
        </button>
        <span className="walkthrough-count">
          Step {position} of {trace.steps.length}
        </span>
      </div>
      <div className="walkthrough-story" role="status" aria-live="polite" aria-atomic="true">
        <strong>{current ? `Line ${current.line} just ran` : 'Ready for the first line'}</strong>
        <p>
          {current?.why ??
            'Nothing has run yet. Next step starts at line 1. Function bodies run when their function is called, so the highlight will sometimes jump.'}
        </p>
        {lastGuess?.position === position && current?.prediction && (
          <p className="walkthrough-guess-result">
            {lastGuess.choice === current.prediction.correct
              ? 'That matches this example. '
              : 'Here is what this line does. '}
            {current.prediction.explanation}
          </p>
        )}
      </div>
      <div className="walkthrough-workspace">
        <section
          className="walkthrough-source"
          aria-label="Code with the current executed line highlighted"
        >
          <h3>The code</h3>
          <ol
            ref={codeList}
            className="walkthrough-lines"
            tabIndex={0}
            aria-label="Example code. Use arrow keys to scroll."
          >
            {example.lines.map((line, index) => (
              <li key={index} aria-current={current?.line === index + 1 ? 'step' : undefined}>
                <span className="walkthrough-line-number" aria-hidden="true">
                  {index + 1}
                </span>
                <code>{line}</code>
              </li>
            ))}
          </ol>
          <p>Follow the highlighted line. A skipped line leaves no step behind.</p>
        </section>
        <div className="walkthrough-observe">
          <figure className="walkthrough-screen">
            <h3>The screen, zoomed in</h3>
            <svg viewBox="0 0 180 140" role="img" aria-labelledby={`${uniqueId}-screen-title`}>
              <title id={`${uniqueId}-screen-title`}>{drawingDescription(screen)}</title>
              <defs>
                <pattern
                  id={`${uniqueId}-grid`}
                  width="10"
                  height="10"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#dce6d4" strokeWidth="0.4" />
                </pattern>
              </defs>
              <rect width="180" height="140" fill="#f5f8ef" />
              <rect width="180" height="140" fill={`url(#${uniqueId}-grid)`} />
              {screen.map((drawing, index) =>
                drawing.kind === 'rect' ? (
                  <rect
                    key={index}
                    x={drawing.x}
                    y={drawing.y}
                    width={drawing.width}
                    height={drawing.height}
                    fill={drawing.color}
                    stroke="#244e37"
                    strokeWidth="0.5"
                  />
                ) : (
                  <text
                    key={index}
                    x={drawing.x}
                    y={drawing.y}
                    dominantBaseline="hanging"
                    fontSize="12"
                    fill="#244e37"
                  >
                    {drawing.message}
                  </text>
                )
              )}
            </svg>
            <figcaption>
              {screenChanged
                ? 'The drawing changed on this step.'
                : 'The drawing stays the same until a draw call changes it.'}
            </figcaption>
          </figure>
          <section
            className="walkthrough-memory"
            aria-label="Stored facts before and after this line"
          >
            <h3>What the code remembers</h3>
            <table>
              <caption>Before and after the highlighted line</caption>
              <thead>
                <tr>
                  <th scope="col">Fact</th>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                </tr>
              </thead>
              <tbody>
                {keys.length ? (
                  keys.map((key) => (
                    <tr
                      key={key}
                      className={before[key] !== after[key] ? 'walkthrough-memory-changed' : ''}
                    >
                      <th scope="row">
                        <code>{key}</code>
                      </th>
                      <td>{valueText(before[key])}</td>
                      <td>{valueText(after[key])}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>No stored facts yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </div>
      <div className="walkthrough-predict">
        <label className="walkthrough-guess-toggle">
          <input
            type="checkbox"
            checked={guessing}
            onChange={(event) => {
              setGuessing(event.target.checked);
              setChoice(null);
            }}
          />
          Try an optional tiny guess before a change
        </label>
        {prediction && (
          <fieldset>
            <legend>{prediction.question}</legend>
            <div className="walkthrough-choices">
              {prediction.choices.map((answer, index) => (
                <button
                  type="button"
                  key={answer}
                  aria-pressed={choice === index}
                  className={choice === index ? 'selected' : ''}
                  onClick={() => setChoice(index)}
                >
                  {answer}
                </button>
              ))}
            </div>
            <p>
              Choose if you want, then tap Next step to see. These guesses earn no points or
              independent results.
            </p>
          </fieldset>
        )}
        {!next && (
          <p>
            You reached the end. Try explaining one change in your own words, or choose another
            little example.
          </p>
        )}
      </div>
    </section>
  );
}
