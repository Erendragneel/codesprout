import { useEffect, useRef, useState } from 'react';
import type { Lesson } from '../data/curriculum';
import { runHtml, runJavaScript, htmlPreviewDocument } from '../lib/runner';
import { Icon, type IconName } from './Icon';
import { RobotBoard } from './Robot';
import { Garden } from './Garden';

const directions: Record<string, [number, number]> = {
  right: [1, 0],
  left: [-1, 0],
  up: [0, -1],
  down: [0, 1],
};
const directionIcons: Record<string, IconName> = {
  right: 'arrow',
  left: 'left',
  up: 'up',
  down: 'down',
};
export function speak(text: string) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('en'));
    if (voice) utterance.voice = voice;
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  }
}
function friendlyError(message: string) {
  if (/timeout|took too long|time limit|stopped/i.test(message))
    return 'That code kept running. Check your loop: does it have a way to stop?';
  if (/not defined/i.test(message))
    return 'A name is missing. Check that you created it first, and used the same spelling.';
  if (/unexpected|syntax|invalid|missing/i.test(message))
    return 'One small piece looks out of place. Check your quotes, brackets, and spelling.';
  if (/not a function/i.test(message))
    return 'That name cannot be called yet. Check the function name and how you created it.';
  return 'That did not run yet. Take a look at the example or try one hint.';
}

export default function LessonView({
  lesson,
  draft,
  completed,
  totalCompleted,
  readAloud,
  onClose,
  onDraft,
  onComplete,
  onNext,
  hasNext,
}: {
  lesson: Lesson;
  draft?: string;
  completed: boolean;
  totalCompleted: number;
  readAloud: boolean;
  onClose: () => void;
  onDraft: (id: string, value: string) => void;
  onComplete: (id: string) => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [code, setCode] = useState(draft ?? lesson.starter);
  const [commands, setCommands] = useState<string[]>([]);
  const [position, setPosition] = useState<[number, number]>(lesson.robot?.start ?? [0, 0]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    output?: string[];
    checks?: { label: string; passed: boolean }[];
    error?: string;
  } | null>(null);
  const [hints, setHints] = useState(0);
  const [preview, setPreview] = useState('');
  const [assisted, setAssisted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const active = useRef(true);
  const wasCompleted = useRef(completed);
  useEffect(() => {
    active.current = true;
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    titleRef.current?.focus();
    return () => {
      active.current = false;
      document.body.style.overflow = old;
      window.speechSynthesis?.cancel();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    titleRef.current?.focus();
    dialogRef.current?.scrollTo({ top: 0 });
    if (readAloud && step === 0) speak(`${lesson.title}. ${lesson.explanation}. ${lesson.analogy}`);
  }, [step, lesson, readAloud]);
  function edit(value: string) {
    setCode(value);
    onDraft(lesson.id, value);
    setResult(null);
  }
  function reset() {
    edit(lesson.starter);
    setCommands([]);
    setPosition(lesson.robot?.start ?? [0, 0]);
    setResult(null);
    setPreview('');
  }
  async function run() {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      if (lesson.kind === 'robot' && lesson.robot) {
        const r = lesson.robot;
        let p: [number, number] = [...r.start];
        setPosition(p);
        let error = '';
        if (!commands.length) error = 'Add an arrow first. Each arrow is one small move.';
        for (const command of commands) {
          if (error || !active.current) break;
          await new Promise((resolve) => setTimeout(resolve, readAloud ? 600 : 340));
          const d = directions[command];
          const next: [number, number] = [p[0] + d[0], p[1] + d[1]];
          if (next[0] < 0 || next[1] < 0 || next[0] >= r.size || next[1] >= r.size) {
            error = 'The robot reached the edge. Undo an arrow and try a different direction.';
            break;
          }
          if (r.walls.some((w) => w[0] === next[0] && w[1] === next[1])) {
            error = 'A rock is in the way. Try going around it.';
            break;
          }
          p = next;
          setPosition(p);
        }
        if (!active.current) return;
        const ok = !error && p[0] === r.goal[0] && p[1] === r.goal[1];
        setResult({
          ok,
          message: ok
            ? 'You did it! Your instructions took the robot to the star.'
            : error || 'Almost! Add or change an arrow to reach the star.',
        });
      } else if (lesson.kind === 'javascript') {
        const response = await runJavaScript(code, lesson.checks);
        if (!active.current) return;
        const outputOk =
          !lesson.expected ||
          JSON.stringify(response.output.map((s) => s.trim())) ===
            JSON.stringify(lesson.expected.map((s) => s.trim()));
        const ok = !response.error && outputOk && response.checks.every((c) => c.passed);
        setResult({
          ok,
          message: response.error
            ? friendlyError(response.error)
            : ok
              ? 'It works! You made the computer follow your instructions.'
              : 'Your code ran. Let’s make its result match the goal below.',
          output: response.output,
          checks: response.checks,
          error: response.error,
        });
      } else {
        setPreview(htmlPreviewDocument(code));
        const response = await runHtml(code, lesson.htmlChecks);
        if (!active.current) return;
        const ok = !response.error && response.checks.every((c) => c.passed);
        setResult({
          ok,
          message: response.error
            ? friendlyError(response.error)
            : ok
              ? 'You made it! Your page has everything the task asked for.'
              : 'Your page is growing. Check the unfinished items below.',
          checks: response.checks,
          error: response.error,
        });
      }
    } catch {
      if (active.current)
        setResult({
          ok: false,
          message: 'The practice space could not start. Try Run again or reopen this lesson.',
        });
    } finally {
      if (active.current) setRunning(false);
    }
  }
  function finish() {
    onComplete(lesson.id);
    setStep(3);
  }
  function trap(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
    if (event.key !== 'Tab') return;
    const elements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], textarea, input, [tabindex="0"]'
      ) ?? []
    ).filter((el) => el.offsetParent !== null);
    const first = elements[0],
      last = elements.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === titleRef.current)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  return (
    <div
      className="lesson-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-title"
      onKeyDown={trap}
      ref={dialogRef}
    >
      <header className="lesson-header">
        <button className="icon-button" onClick={onClose} aria-label="Save and close lesson">
          <Icon name="close" />
        </button>
        <div className="lesson-header-center">
          <span>{lesson.unit}</span>
          <div className="step-dots" aria-label={`Step ${step + 1} of 4`}>
            {['Understand', 'Guess', 'Try', 'Grow'].map((label, i) => (
              <span key={label} className={i <= step ? 'filled' : ''} title={label} />
            ))}
          </div>
        </div>
        <button
          className="icon-button"
          onClick={() =>
            speak(
              step === 0
                ? `${lesson.explanation}. ${lesson.analogy}`
                : step === 1
                  ? lesson.prediction.question
                  : lesson.task
            )
          }
          aria-label="Read this step aloud"
        >
          <Icon name="volume" />
        </button>
      </header>
      <div className={`lesson-content ${step === 2 && lesson.kind !== 'robot' ? 'wide' : ''}`}>
        <div className="eyebrow">
          <Icon
            name={step === 3 ? 'sprout' : step === 2 ? 'play' : step === 1 ? 'hint' : 'leaf'}
            size={15}
          />{' '}
          {['A tiny idea', 'Make a little guess', 'Your turn', 'A little more growth'][step]}
        </div>
        <h1 id="lesson-title" tabIndex={-1} ref={titleRef}>
          {step === 3 ? 'Look at you grow.' : lesson.title}
        </h1>
        {step === 0 && (
          <>
            <p className="lesson-lead">{lesson.explanation}</p>
            <div className="analogy">
              <Icon name="hint" size={23} />
              <p>{lesson.analogy}</p>
            </div>
            {lesson.kind === 'robot' && lesson.robot ? (
              <RobotBoard {...lesson.robot} />
            ) : (
              <div className="example-card">
                <span className="code-label">A tiny example</span>
                <pre>
                  <code>{lesson.example}</code>
                </pre>
              </div>
            )}
            <p className="small-note">No need to memorize. You can look at the example anytime.</p>
            <button className="button primary full" onClick={() => setStep(1)}>
              I’m ready for a tiny guess <Icon name="arrow" />
            </button>
          </>
        )}
        {step === 1 && (
          <>
            <p className="lesson-lead">{lesson.prediction.question}</p>
            {lesson.kind !== 'robot' && (
              <pre className="prediction-code">
                <code>{lesson.example}</code>
              </pre>
            )}
            <div className="choices">
              {lesson.prediction.choices.map((answer, i) => (
                <button
                  key={i}
                  className={`choice ${choice === i ? 'selected' : ''} ${checked && choice === i ? (i === lesson.prediction.correct ? 'correct' : 'retry') : ''}`}
                  onClick={() => {
                    setChoice(i);
                    setChecked(false);
                  }}
                >
                  <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
                  <span>{answer}</span>
                  {checked && choice === i && i === lesson.prediction.correct && (
                    <Icon name="check" />
                  )}
                </button>
              ))}
            </div>
            {checked && (
              <div
                className={`feedback ${choice === lesson.prediction.correct ? 'success' : 'gentle'}`}
                role="status"
              >
                <Icon name={choice === lesson.prediction.correct ? 'check' : 'hint'} />
                <div>
                  <strong>
                    {choice === lesson.prediction.correct
                      ? 'Exactly!'
                      : 'A useful guess. Let’s try again.'}
                  </strong>
                  <p>
                    {choice === lesson.prediction.correct
                      ? lesson.prediction.explanation
                      : 'Look back at the tiny example. You can change your answer as many times as you like.'}
                  </p>
                </div>
              </div>
            )}
            <button
              className="button primary full"
              disabled={choice === null}
              onClick={() =>
                checked && choice === lesson.prediction.correct ? setStep(2) : setChecked(true)
              }
            >
              {checked && choice === lesson.prediction.correct ? 'Let me try it' : 'Check my guess'}{' '}
              <Icon name="arrow" />
            </button>
            <button className="text-button" onClick={() => setStep(0)}>
              <Icon name="left" size={16} /> Look at the idea again
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <p className="lesson-lead">{lesson.task}</p>
            <div className={`practice-layout ${lesson.kind === 'robot' ? 'robot-layout' : ''}`}>
              <div className="practice-main">
                {lesson.kind === 'robot' && lesson.robot ? (
                  <>
                    <RobotBoard {...lesson.robot} position={position} />
                    <div className="command-tray" aria-label="Your instructions" aria-live="polite">
                      {commands.length ? (
                        commands.map((command, i) => (
                          <span className="command-token" key={i}>
                            <span>{i + 1}</span>
                            <Icon name={directionIcons[command]} />
                          </span>
                        ))
                      ) : (
                        <span className="empty-instructions">Tap an arrow below to add a move</span>
                      )}
                    </div>
                    <div className="direction-buttons">
                      {lesson.robot.commands.map((command) => (
                        <button
                          key={command}
                          disabled={running || commands.length >= lesson.robot!.maxCommands}
                          className="direction-button"
                          onClick={() => {
                            setCommands((c) => [...c, command]);
                            setResult(null);
                            setPosition(lesson.robot!.start);
                          }}
                        >
                          <Icon name={directionIcons[command]} />
                          <span>{command[0].toUpperCase() + command.slice(1)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="editor-footer">
                      <span>
                        {commands.length} / {lesson.robot.maxCommands} moves
                      </span>
                      <button
                        className="text-button"
                        disabled={running || !commands.length}
                        onClick={() => {
                          setCommands((c) => c.slice(0, -1));
                          setResult(null);
                          setPosition(lesson.robot!.start);
                        }}
                      >
                        <Icon name="undo" size={16} /> Undo
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="editor">
                    <div className="editor-bar">
                      <span>
                        <i /> {lesson.kind === 'html' ? 'my-page.html' : 'my-first-code.js'}
                      </span>
                      <span>Saved on this device</span>
                    </div>
                    <div className="editor-body">
                      <pre className="line-numbers" aria-hidden="true">
                        {code
                          .split('\n')
                          .map((_, i) => i + 1)
                          .join('\n')}
                      </pre>
                      <textarea
                        aria-label={
                          lesson.kind === 'html' ? 'Your HTML and CSS code' : 'Your JavaScript code'
                        }
                        value={code}
                        disabled={running}
                        onChange={(event) => edit(event.target.value)}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                            event.preventDefault();
                            void run();
                          }
                        }}
                      />
                    </div>
                    <div className="editor-footer">
                      <span>Change it. Try it. See what happens.</span>
                      <button className="text-button" onClick={reset} disabled={running}>
                        <Icon name="reset" size={15} /> Reset
                      </button>
                    </div>
                  </div>
                )}
                <button
                  className="button primary full run-button"
                  onClick={() => void run()}
                  disabled={running}
                >
                  <Icon name="play" size={18} />{' '}
                  {running
                    ? 'Trying your instructions…'
                    : lesson.kind === 'robot'
                      ? 'Move my robot'
                      : lesson.kind === 'html'
                        ? 'Show my page'
                        : 'Run my code'}
                </button>
                {preview && (
                  <div className="preview-panel">
                    <span className="code-label">Your real web page · preview links stay here</span>
                    <iframe title="Your web page preview" sandbox="" srcDoc={preview} />
                  </div>
                )}
                {result && (
                  <div className={`feedback ${result.ok ? 'success' : 'gentle'}`} role="status">
                    <Icon name={result.ok ? 'check' : 'hint'} />
                    <div>
                      <strong>{result.message}</strong>
                      {result.output && (
                        <div className="output">
                          <span className="code-label">What your code says</span>
                          <pre>
                            {result.output.length
                              ? result.output.join('\n')
                              : '(Nothing printed yet)'}
                          </pre>
                        </div>
                      )}
                      {result.checks?.length ? (
                        <ul className="check-list">
                          {result.checks.map((c, i) => (
                            <li key={i}>
                              <Icon name={c.passed ? 'complete' : 'circle'} size={16} /> {c.label}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {result.error && (
                        <details>
                          <summary>Show the computer’s message</summary>
                          <code>{result.error}</code>
                        </details>
                      )}
                    </div>
                  </div>
                )}
                {result?.ok && (
                  <button className="button primary full" onClick={finish}>
                    Finish this lesson <Icon name="sprout" />
                  </button>
                )}
              </div>
              <aside className="practice-help">
                <div className="help-card">
                  <span className="eyebrow">
                    <Icon name="sparkle" size={15} /> Your goal
                  </span>
                  {lesson.expected?.length ? (
                    <pre>{lesson.expected.join('\n')}</pre>
                  ) : (
                    <p>
                      {lesson.kind === 'robot'
                        ? 'Take the robot to the star. One arrow = one square.'
                        : lesson.task}
                    </p>
                  )}
                  <p className="muted">
                    {lesson.kind === 'javascript'
                      ? 'console.log() shows a result here.'
                      : lesson.kind === 'html'
                        ? 'HTML adds the pieces. CSS changes their look.'
                        : 'Your robot follows arrows from left to right.'}
                  </p>
                </div>
                <div className="help-card">
                  <span className="eyebrow">
                    <Icon name="hint" size={15} /> A little help
                  </span>
                  {lesson.hints.slice(0, hints).map((hint, i) => (
                    <p className="hint-text" key={i}>
                      <span>{i + 1}</span>
                      {hint}
                    </p>
                  ))}
                  {hints < lesson.hints.length && (
                    <button
                      className="button secondary full"
                      onClick={() => setHints((h) => h + 1)}
                    >
                      Show {hints ? 'another' : 'one'} hint
                    </button>
                  )}
                  {hints >= lesson.hints.length && (
                    <button
                      className="text-button"
                      disabled={running}
                      onClick={() => {
                        if (lesson.kind === 'robot') {
                          setCommands(lesson.robot?.solutionCommands ?? []);
                          setPosition(lesson.robot!.start);
                        } else edit(lesson.solution);
                        setAssisted(true);
                        setResult(null);
                      }}
                    >
                      Try the example solution
                    </button>
                  )}
                  {assisted && (
                    <p className="small-note">
                      Examples help you learn. Run it, then try changing a piece.
                    </p>
                  )}
                </div>
                <details className="help-card">
                  <summary>The idea, again</summary>
                  <p>{lesson.explanation}</p>
                  <pre>{lesson.example}</pre>
                </details>
              </aside>
            </div>
            <button className="text-button" onClick={() => setStep(0)}>
              <Icon name="left" size={16} /> Back to the tiny idea
            </button>
          </>
        )}
        {step === 3 && (
          <>
            <Garden growth={totalCompleted} />
            <p className="lesson-lead">{lesson.takeaway}</p>
            <div className="earned">
              <span>
                <Icon name="check" /> Lesson complete
              </span>
              <strong>
                <Icon name="zap" size={18} />{' '}
                {wasCompleted.current ? 'Skills refreshed' : '+30 growth points'}
              </strong>
            </div>
            <p className="small-note">
              {assisted
                ? 'You practiced with an example. Come back tomorrow and try it on your own.'
                : 'A small step counts. You can stop here or keep growing.'}
            </p>
            <button className="button primary full" onClick={hasNext ? onNext : onClose}>
              {hasNext ? 'One more tiny lesson' : 'Back to my learning path'} <Icon name="arrow" />
            </button>
            {hasNext && (
              <button className="text-button" onClick={onClose}>
                That’s enough for now
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
